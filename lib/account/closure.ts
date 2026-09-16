import 'server-only';

import { del } from '@vercel/blob';
import {
    AccountClosureConflictError,
    acquireAccountClosureLease,
    advanceAccountClosureStep,
    completeAccountClosure,
    filterUnreferencedLogoUrls,
    getAccountClosure,
    getAccountClosureSnapshot,
    getSoleMemberOrganizations,
    recordAccountSecurityEvent,
    releaseAccountClosureLease,
    removeAccountClosureData,
    revertAccountClosure,
    type AccountClosureStep,
    type ClosureTransfers,
} from '@/lib/neon/queries';
import { sendAccountClosedEmail } from '@/lib/email/email-service';
import { stackServerApp } from '@/lib/stack/server';
import { stripe } from '@/lib/stripe/client';

/** Published contact on the privacy and terms pages. */
export const ACCOUNT_SUPPORT_EMAIL = 'haydn@multimedium.dev';

const SETTINGS = '/dashboard/settings';

export type ClosureBlocker = {
    code: string;
    message: string;
    action?: { label: string; href: string };
};

export type AccountClosureReview = {
    eligible: boolean;
    blockers: ClosureBlocker[];
    confirmationEmail: string;
    billing: {
        cancelsPersonalPlan: boolean;
        cancelsWorkspacePlans: string[];
    };
    personal: {
        requestCount: number;
        openRequestCount: number;
        profileCount: number;
        hasSellerForm: boolean;
    };
    deletedWorkspaces: Array<{
        id: string;
        name: string;
        requestCount: number;
        openRequestCount: number;
    }>;
    sharedWorkspaces: Array<{
        id: string;
        name: string;
        ownedRequestCount: number;
        ownedProfileCount: number;
        needsTransfer: boolean;
        adminOptions: Array<{ accountId: string; name: string }>;
        defaultTransferAccountId: string | null;
    }>;
    forfeitedReferralCredits: number;
    pendingInvitations: number;
    supportEmail: string;
};

type SubscriptionState = 'ended' | 'cancelable' | 'unsettled' | 'unavailable';

const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired']);
const UNSETTLED_STATUSES = new Set(['past_due', 'unpaid', 'incomplete']);

async function inspectSubscription(subscriptionId: string): Promise<SubscriptionState> {
    if (!stripe) return 'unavailable';
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (ENDED_STATUSES.has(subscription.status)) return 'ended';
        if (UNSETTLED_STATUSES.has(subscription.status)) return 'unsettled';
        return 'cancelable';
    } catch (error) {
        if (isMissingStripeResource(error)) return 'ended';
        console.error('Account closure could not read a subscription', { subscriptionId });
        return 'unavailable';
    }
}

function isMissingStripeResource(error: unknown) {
    return Boolean(
        error
        && typeof error === 'object'
        && 'code' in error
        && (error as { code?: string }).code === 'resource_missing',
    );
}

export async function buildAccountClosureReview(input: {
    accountId: string;
    email: string;
    isImpersonation: boolean;
}): Promise<AccountClosureReview | null> {
    const snapshot = await getAccountClosureSnapshot(input.accountId, input.email);
    if (!snapshot) return null;

    const blockers: ClosureBlocker[] = [];
    const billingAction = { label: 'Open Billing', href: `${SETTINGS}?tab=billing` };
    const workspaceAction = { label: 'Open Workspace & Team', href: `${SETTINGS}?tab=workspace` };
    const supportAction = { label: 'Email support', href: `mailto:${ACCOUNT_SUPPORT_EMAIL}` };

    if (input.isImpersonation) {
        blockers.push({
            code: 'impersonation',
            message: 'A support session can’t close this account. The account owner has to sign in and do it themselves.',
        });
    }
    if (snapshot.account.role === 'admin') {
        blockers.push({
            code: 'platform_admin',
            message: 'You have UtilitySheet admin access. Ask another UtilitySheet admin to remove it before you close your account.',
            action: supportAction,
        });
    }

    const billing = { cancelsPersonalPlan: false, cancelsWorkspacePlans: [] as string[] };
    const unavailableBlocker: ClosureBlocker = {
        code: 'billing_unavailable',
        message: 'We couldn’t check your billing just now, so closure is paused. Try again in a few minutes.',
    };

    if (snapshot.account.subscription_id) {
        const state = await inspectSubscription(snapshot.account.subscription_id);
        if (state === 'cancelable') billing.cancelsPersonalPlan = true;
        if (state === 'unsettled') {
            blockers.push({
                code: 'personal_billing_unsettled',
                message: 'Your Pro plan has an unpaid balance. Pay it in Billing, then come back to close your account.',
                action: billingAction,
            });
        }
        if (state === 'unavailable') blockers.push(unavailableBlocker);
    }

    const deletedWorkspaces: AccountClosureReview['deletedWorkspaces'] = [];
    const sharedWorkspaces: AccountClosureReview['sharedWorkspaces'] = [];

    for (const workspace of snapshot.workspaces) {
        const name = workspace.name || 'Your workspace';
        if (workspace.is_sole_member) {
            deletedWorkspaces.push({
                id: workspace.id,
                name,
                requestCount: Number(workspace.workspace_request_count) || 0,
                openRequestCount: Number(workspace.workspace_open_request_count) || 0,
            });
            if (workspace.subscription_id) {
                const state = await inspectSubscription(workspace.subscription_id);
                if (state === 'cancelable') billing.cancelsWorkspacePlans.push(name);
                if (state === 'unsettled') {
                    blockers.push({
                        code: 'workspace_billing_unsettled',
                        message: `The Team plan for ${name} has an unpaid balance. Switch to ${name} and pay it in Billing, then come back.`,
                        action: billingAction,
                    });
                }
                if (state === 'unavailable' && !blockers.includes(unavailableBlocker)) {
                    blockers.push(unavailableBlocker);
                }
            }
            continue;
        }

        const adminOptions = Array.isArray(workspace.other_admins) ? workspace.other_admins : [];
        const ownedRequestCount = Number(workspace.owned_request_count) || 0;
        const ownedProfileCount = Number(workspace.owned_profile_count) || 0;
        const needsTransfer = ownedRequestCount > 0 || ownedProfileCount > 0;

        if (workspace.role === 'admin' && adminOptions.length === 0) {
            blockers.push({
                code: 'sole_admin',
                message: `You’re the only admin of ${name}, which has other members. Switch to ${name}, make another member an admin in Workspace & Team, then come back.`,
                action: workspaceAction,
            });
        } else if (needsTransfer && adminOptions.length === 0) {
            blockers.push({
                code: 'no_transfer_admin',
                message: `${name} has no admin who can take over your requests and Branding Profiles. Ask a member to become an admin, or email support.`,
                action: supportAction,
            });
        }

        sharedWorkspaces.push({
            id: workspace.id,
            name,
            ownedRequestCount,
            ownedProfileCount,
            needsTransfer,
            adminOptions,
            defaultTransferAccountId: adminOptions[0]?.accountId ?? null,
        });
    }

    return {
        eligible: blockers.length === 0,
        blockers,
        confirmationEmail: input.email,
        billing,
        personal: {
            requestCount: Number(snapshot.personal.request_count) || 0,
            openRequestCount: Number(snapshot.personal.open_request_count) || 0,
            profileCount: Number(snapshot.personal.profile_count) || 0,
            hasSellerForm: Boolean(snapshot.personal.has_seller_form),
        },
        deletedWorkspaces,
        sharedWorkspaces,
        forfeitedReferralCredits: Number(snapshot.personal.unapplied_referral_credits) || 0,
        pendingInvitations: Number(snapshot.personal.pending_invitations) || 0,
        supportEmail: ACCOUNT_SUPPORT_EMAIL,
    };
}

/**
 * Checks a submitted transfer map against the review. Every shared workspace
 * that holds the user's records needs exactly one current admin target.
 */
export function resolveClosureTransfers(
    review: AccountClosureReview,
    submitted: Record<string, string>,
): { ok: true; transfers: ClosureTransfers } | { ok: false; error: string } {
    const transfers: ClosureTransfers = {};
    const known = new Map(review.sharedWorkspaces.map((workspace) => [workspace.id, workspace]));

    for (const organizationId of Object.keys(submitted)) {
        const workspace = known.get(organizationId);
        if (!workspace || !workspace.needsTransfer) {
            return { ok: false, error: 'Choose an admin only for workspaces that hold your records.' };
        }
    }
    for (const workspace of review.sharedWorkspaces) {
        if (!workspace.needsTransfer) continue;
        const target = submitted[workspace.id];
        if (!target || !workspace.adminOptions.some((admin) => admin.accountId === target)) {
            return { ok: false, error: `Choose who should receive your records in ${workspace.name}.` };
        }
        transfers[workspace.id] = target;
    }
    return { ok: true, transfers };
}

export type AccountClosureRunResult =
    | { status: 'closed' }
    | { status: 'closing'; step: AccountClosureStep; errorCode: string | null }
    | { status: 'busy' }
    | { status: 'reverted'; errorCode: string }
    | { status: 'not_found' };

class ClosureStepError extends Error {
    constructor(public readonly code: string) {
        super(code);
    }
}

function isVercelLogoBlob(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:'
            && parsed.hostname.endsWith('.blob.vercel-storage.com')
            && parsed.pathname.startsWith('/brand-logos/');
    } catch {
        return false;
    }
}

async function cancelClosureSubscriptions(accountId: string, personalSubscriptionId: string | null) {
    const soleOrganizations = await getSoleMemberOrganizations(accountId);
    const subscriptionIds = [...new Set([
        personalSubscriptionId,
        ...soleOrganizations.map((organization) => organization.subscription_id),
    ].filter((id): id is string => Boolean(id)))];

    for (const subscriptionId of subscriptionIds) {
        const state = await inspectSubscription(subscriptionId);
        if (state === 'ended') continue;
        if (state === 'unsettled') throw new AccountClosureConflictError('billing_unsettled');
        if (state === 'unavailable' || !stripe) throw new AccountClosureConflictError('billing_unavailable');
        try {
            await stripe.subscriptions.cancel(
                subscriptionId,
                { prorate: false, invoice_now: false },
                { idempotencyKey: `account-closure-${accountId}-${subscriptionId}` },
            );
        } catch (error) {
            if (isMissingStripeResource(error)) continue;
            console.error('Account closure could not cancel a subscription', { subscriptionId });
            throw new AccountClosureConflictError('billing_cancel_failed');
        }
    }
    return subscriptionIds.length;
}

async function removeLogoBlobs(accountId: string, candidates: string[]) {
    const urls = (await filterUnreferencedLogoUrls(candidates.filter(isVercelLogoBlob)));
    if (urls.length === 0) return;
    try {
        await del(urls);
    } catch {
        // Logos are best effort: record it and keep closing the account.
        await recordAccountSecurityEvent({
            accountId,
            action: 'account_closure_failed',
            status: 'failure',
            metadata: { step: 'assets_removed', code: 'logo_cleanup_failed', count: urls.length },
        });
    }
}

async function deleteStackUser(authUserId: string | null) {
    if (!authUserId) return;
    try {
        const stackUser = await stackServerApp.getUser(authUserId);
        if (stackUser) await stackUser.delete();
    } catch {
        throw new ClosureStepError('auth_delete_failed');
    }
}

/**
 * Runs, or resumes, a claimed closure. Safe to call repeatedly: each step is
 * guarded by the recorded step, and a lease keeps two runners apart. Failures
 * before data removal return the account to active; later failures keep it
 * closing for a retry.
 */
export async function runAccountClosure(accountId: string): Promise<AccountClosureRunResult> {
    const initial = await getAccountClosure(accountId);
    if (!initial) return { status: 'not_found' };
    if (initial.closure_status === 'closed' || initial.step === 'completed') return { status: 'closed' };
    if (initial.closure_status !== 'closing') return { status: 'not_found' };
    if (!(await acquireAccountClosureLease(accountId))) return { status: 'busy' };

    let step: AccountClosureStep = initial.step;
    try {
        if (step === 'requested') {
            const cancelled = await cancelClosureSubscriptions(accountId, initial.subscription_id);
            await advanceAccountClosureStep(accountId, 'requested', 'billing_canceled');
            step = 'billing_canceled';
            await recordAccountSecurityEvent({
                accountId,
                action: 'account_closure_started',
                metadata: { subscriptionsChecked: cancelled },
            });
        }

        if (step === 'billing_canceled') {
            // Recheck immediately before destructive work. This covers a
            // checkout or membership change that was already in flight when
            // the account was claimed and keeps retries idempotent.
            await cancelClosureSubscriptions(accountId, initial.subscription_id);
            const soleOrganizations = await getSoleMemberOrganizations(accountId);
            await removeAccountClosureData({
                accountId,
                email: initial.email,
                soleOrganizationIds: soleOrganizations.map((organization) => organization.id),
                transfers: initial.transfers || {},
            });
            step = 'data_removed';
        }

        if (step === 'data_removed') {
            const record = await getAccountClosure(accountId);
            await removeLogoBlobs(accountId, Array.isArray(record?.pending_blob_urls) ? record.pending_blob_urls : []);
            await advanceAccountClosureStep(accountId, 'data_removed', 'assets_removed');
            step = 'assets_removed';
        }

        if (step === 'assets_removed') {
            await deleteStackUser(initial.auth_user_id);
            await advanceAccountClosureStep(accountId, 'assets_removed', 'auth_deleted');
            step = 'auth_deleted';
        }

        if (step === 'auth_deleted') {
            const completed = await completeAccountClosure(accountId);
            if (!completed) return { status: 'closed' };
            await recordAccountSecurityEvent({ accountId, action: 'account_closed' });
            if (completed.notifyEmail) {
                const sent = await sendAccountClosedEmail({ toEmail: completed.notifyEmail }).catch(() => ({ success: false }));
                if (!sent.success) {
                    console.error(JSON.stringify({ level: 'error', message: 'Account closed email failed', accountId }));
                }
            }
            return { status: 'closed' };
        }

        await releaseAccountClosureLease(accountId, null);
        return { status: 'closing', step, errorCode: null };
    } catch (error) {
        const code = error instanceof AccountClosureConflictError || error instanceof ClosureStepError
            ? error.code
            : `${step}_failed`;
        if (step === 'requested' || step === 'billing_canceled') {
            // Nothing was deleted yet, so give the user their account back.
            await revertAccountClosure(accountId, code);
            await recordAccountSecurityEvent({
                accountId,
                action: 'account_closure_failed',
                status: 'failure',
                metadata: { step, code, reverted: true },
            });
            return { status: 'reverted', errorCode: code };
        }
        await releaseAccountClosureLease(accountId, code);
        await recordAccountSecurityEvent({
            accountId,
            action: 'account_closure_failed',
            status: 'failure',
            metadata: { step, code, reverted: false },
        });
        if (!(error instanceof ClosureStepError)) {
            console.error('Account closure step failed', { accountId, step });
        }
        return { status: 'closing', step, errorCode: code };
    }
}
