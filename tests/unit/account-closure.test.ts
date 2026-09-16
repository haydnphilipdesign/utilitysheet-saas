import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    acquireLease: vi.fn(),
    advanceStep: vi.fn(),
    completeClosure: vi.fn(),
    deleteBlob: vi.fn(),
    filterLogos: vi.fn(),
    getClosure: vi.fn(),
    getSnapshot: vi.fn(),
    getSoleOrganizations: vi.fn(),
    getStackUser: vi.fn(),
    recordEvent: vi.fn(),
    releaseLease: vi.fn(),
    removeData: vi.fn(),
    retrieveSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    revertClosure: vi.fn(),
    sendClosedEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@vercel/blob', () => ({ del: mocks.deleteBlob }));
vi.mock('@/lib/neon/queries', () => ({
    AccountClosureConflictError: class AccountClosureConflictError extends Error {
        constructor(public readonly code: string) { super(code); }
    },
    acquireAccountClosureLease: mocks.acquireLease,
    advanceAccountClosureStep: mocks.advanceStep,
    completeAccountClosure: mocks.completeClosure,
    filterUnreferencedLogoUrls: mocks.filterLogos,
    getAccountClosure: mocks.getClosure,
    getAccountClosureSnapshot: mocks.getSnapshot,
    getSoleMemberOrganizations: mocks.getSoleOrganizations,
    recordAccountSecurityEvent: mocks.recordEvent,
    releaseAccountClosureLease: mocks.releaseLease,
    removeAccountClosureData: mocks.removeData,
    revertAccountClosure: mocks.revertClosure,
}));
vi.mock('@/lib/email/email-service', () => ({ sendAccountClosedEmail: mocks.sendClosedEmail }));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getStackUser } }));
vi.mock('@/lib/stripe/client', () => ({
    stripe: {
        subscriptions: {
            retrieve: mocks.retrieveSubscription,
            cancel: mocks.cancelSubscription,
        },
    },
}));

import {
    buildAccountClosureReview,
    resolveClosureTransfers,
    runAccountClosure,
} from '@/lib/account/closure';

const baseSnapshot = {
    account: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'user',
        subscription_status: 'free',
        subscription_id: null,
        closure_status: 'active' as const,
    },
    workspaces: [],
    personal: {
        request_count: 2,
        open_request_count: 1,
        profile_count: 1,
        has_seller_form: true,
        unapplied_referral_credits: 1,
        pending_invitations: 1,
    },
};

function closureRecord(step = 'requested') {
    return {
        account_id: 'acct_1',
        auth_user_id: 'stack_1',
        email: 'owner@example.com',
        closure_status: 'closing',
        subscription_id: 'sub_personal',
        step,
        transfers: {},
        pending_blob_urls: ['https://store.blob.vercel-storage.com/brand-logos/logo.png'],
        attempt_count: 1,
        last_error_code: null,
    };
}

describe('account closure eligibility and transfers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSnapshot.mockResolvedValue(structuredClone(baseSnapshot));
        mocks.retrieveSubscription.mockResolvedValue({ status: 'active' });
    });

    it('blocks impersonation, platform admins, unsettled billing, and a shared workspace with no surviving admin', async () => {
        mocks.getSnapshot.mockResolvedValue({
            ...structuredClone(baseSnapshot),
            account: { ...baseSnapshot.account, role: 'admin', subscription_id: 'sub_past_due' },
            workspaces: [{
                id: '22222222-2222-4222-8222-222222222222',
                name: 'Shared workspace',
                role: 'admin',
                subscription_status: 'team',
                subscription_id: null,
                member_count: 2,
                is_sole_member: false,
                owned_request_count: 1,
                owned_profile_count: 0,
                workspace_request_count: 1,
                workspace_open_request_count: 0,
                other_admins: [],
            }],
        });
        mocks.retrieveSubscription.mockResolvedValue({ status: 'past_due' });

        const review = await buildAccountClosureReview({
            accountId: 'acct_1', email: 'owner@example.com', isImpersonation: true,
        });

        expect(review?.eligible).toBe(false);
        expect(review?.blockers.map((blocker) => blocker.code)).toEqual([
            'impersonation', 'platform_admin', 'personal_billing_unsettled', 'sole_admin',
        ]);
        expect(review?.blockers.find((blocker) => blocker.code === 'personal_billing_unsettled')?.action?.href)
            .toBe('/dashboard/settings?tab=billing');
    });

    it('preselects the earliest remaining admin and only accepts a current admin target', async () => {
        const workspace = {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Shared workspace',
            role: 'member',
            subscription_status: 'team',
            subscription_id: 'sub_shared_untouched',
            member_count: 3,
            is_sole_member: false,
            owned_request_count: 2,
            owned_profile_count: 1,
            workspace_request_count: 3,
            workspace_open_request_count: 1,
            other_admins: [
                { accountId: '33333333-3333-4333-8333-333333333333', name: 'First Admin' },
                { accountId: '44444444-4444-4444-8444-444444444444', name: 'Second Admin' },
            ],
        };
        mocks.getSnapshot.mockResolvedValue({ ...structuredClone(baseSnapshot), workspaces: [workspace] });

        const review = await buildAccountClosureReview({
            accountId: 'acct_1', email: 'owner@example.com', isImpersonation: false,
        });

        expect(review?.eligible).toBe(true);
        expect(review?.sharedWorkspaces[0].defaultTransferAccountId).toBe(workspace.other_admins[0].accountId);
        expect(mocks.retrieveSubscription).not.toHaveBeenCalledWith('sub_shared_untouched');

        const valid = resolveClosureTransfers(review!, { [workspace.id]: workspace.other_admins[1].accountId });
        expect(valid).toEqual({ ok: true, transfers: { [workspace.id]: workspace.other_admins[1].accountId } });
        expect(resolveClosureTransfers(review!, { [workspace.id]: '55555555-5555-4555-8555-555555555555' }))
            .toEqual({ ok: false, error: 'Choose who should receive your records in Shared workspace.' });
    });

    it('treats only the closing user as a sole member workspace and blocks orphaned shared work', async () => {
        mocks.getSnapshot.mockResolvedValue({
            ...structuredClone(baseSnapshot),
            workspaces: [{
                id: '22222222-2222-4222-8222-222222222222',
                name: 'Former workspace',
                role: 'member',
                subscription_status: 'free',
                subscription_id: null,
                member_count: 1,
                is_sole_member: false,
                owned_request_count: 1,
                owned_profile_count: 0,
                workspace_request_count: 1,
                workspace_open_request_count: 0,
                other_admins: [],
            }],
        });

        const review = await buildAccountClosureReview({
            accountId: 'acct_1', email: 'owner@example.com', isImpersonation: false,
        });

        expect(review?.deletedWorkspaces).toEqual([]);
        expect(review?.blockers.map((blocker) => blocker.code)).toEqual(['no_transfer_admin']);
    });
});

describe('account closure execution and recovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.acquireLease.mockResolvedValue(true);
        mocks.advanceStep.mockResolvedValue(true);
        mocks.completeClosure.mockResolvedValue({ notifyEmail: 'owner@example.com' });
        mocks.filterLogos.mockResolvedValue(['https://store.blob.vercel-storage.com/brand-logos/logo.png']);
        mocks.getClosure.mockResolvedValue(closureRecord());
        mocks.getSoleOrganizations.mockResolvedValue([]);
        mocks.recordEvent.mockResolvedValue(true);
        mocks.removeData.mockResolvedValue(undefined);
        mocks.retrieveSubscription
            .mockResolvedValueOnce({ status: 'active' })
            .mockResolvedValue({ status: 'canceled' });
        mocks.cancelSubscription.mockResolvedValue({ status: 'canceled' });
        mocks.getStackUser.mockResolvedValue({ delete: vi.fn().mockResolvedValue(undefined) });
        mocks.sendClosedEmail.mockResolvedValue({ success: true });
    });

    it('cancels once with a stable idempotency key, removes data, deletes auth, and completes once', async () => {
        const result = await runAccountClosure('acct_1');

        expect(result).toEqual({ status: 'closed' });
        expect(mocks.cancelSubscription).toHaveBeenCalledWith(
            'sub_personal',
            { prorate: false, invoice_now: false },
            { idempotencyKey: 'account-closure-acct_1-sub_personal' },
        );
        expect(mocks.removeData).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acct_1' }));
        expect(mocks.completeClosure).toHaveBeenCalledTimes(1);
        expect(mocks.sendClosedEmail).toHaveBeenCalledWith({ toEmail: 'owner@example.com' });
    });

    it('returns the account to active when billing cancellation fails before deletion', async () => {
        mocks.cancelSubscription.mockRejectedValue(new Error('Stripe unavailable'));

        const result = await runAccountClosure('acct_1');

        expect(result).toEqual({ status: 'reverted', errorCode: 'billing_cancel_failed' });
        expect(mocks.revertClosure).toHaveBeenCalledWith('acct_1', 'billing_cancel_failed');
        expect(mocks.removeData).not.toHaveBeenCalled();
    });

    it('keeps a data-removed account closing when Stack deletion fails so cron or the user can retry', async () => {
        mocks.getClosure.mockResolvedValue(closureRecord('assets_removed'));
        mocks.getStackUser.mockRejectedValue(new Error('Stack unavailable'));

        const result = await runAccountClosure('acct_1');

        expect(result).toEqual({ status: 'closing', step: 'assets_removed', errorCode: 'auth_delete_failed' });
        expect(mocks.releaseLease).toHaveBeenCalledWith('acct_1', 'auth_delete_failed');
        expect(mocks.revertClosure).not.toHaveBeenCalled();
        expect(mocks.completeClosure).not.toHaveBeenCalled();
    });

    it('reports a repeated completed request as already closed without repeating side effects', async () => {
        mocks.getClosure.mockResolvedValue({ ...closureRecord('completed'), closure_status: 'closed' });

        await expect(runAccountClosure('acct_1')).resolves.toEqual({ status: 'closed' });
        expect(mocks.acquireLease).not.toHaveBeenCalled();
        expect(mocks.cancelSubscription).not.toHaveBeenCalled();
        expect(mocks.removeData).not.toHaveBeenCalled();
    });
});
