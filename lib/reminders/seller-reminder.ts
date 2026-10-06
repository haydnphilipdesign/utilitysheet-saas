/**
 * Seller reminder orchestration shared by the Admin action and the customer
 * reminder endpoint.
 *
 *   prepare  -> build the exact payload and its fingerprint
 *   claim    -> durable operation + cooldown, serialized per request (committed first)
 *   send     -> provider call outside any transaction, keyed by the operation ID
 *   finalize -> accepted state, `reminder_sent` event and Admin audit in one statement
 *
 * A database transaction cannot roll back an email, so each stage leaves a
 * state that a retry can recognise instead of sending again.
 */
import { createHash } from 'node:crypto';
import {
    buildSellerReminderEmail,
    sendBuiltSellerReminderEmail,
    type SellerReminderEmail,
    type SellerReminderSendResult,
} from '@/lib/email/email-service';
import { getBrandProfile, getRequestById } from '@/lib/neon/queries';
import {
    claimReminderOperation,
    finalizeReminderAccepted,
    recordReminderOutcome,
    type ReminderActor,
    type ReminderClaimOutcome,
} from '@/lib/neon/queries/reminder-operations';
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';
import type { BrandProfile, Request } from '@/types';

export type PreparedSellerReminder = {
    request: Request;
    email: SellerReminderEmail;
    fingerprint: string;
};

export type ReminderIneligibleCode =
    | 'NOT_FOUND'
    | 'REQUEST_DELETED'
    | 'REQUEST_SUBMITTED'
    | 'NO_SELLER_EMAIL'
    | 'INVALID_SELLER_EMAIL'
    | 'OWNER_INELIGIBLE';

export const REMINDER_INELIGIBLE_MESSAGES: Record<ReminderIneligibleCode, string> = {
    NOT_FOUND: 'Request not found',
    REQUEST_DELETED: 'This request was deleted. Reminders cannot be sent for deleted requests.',
    REQUEST_SUBMITTED: 'The seller already submitted this request, so a reminder is not appropriate.',
    NO_SELLER_EMAIL: 'Seller email is required to send a reminder',
    INVALID_SELLER_EMAIL: 'The seller email on this request is not a valid address.',
    OWNER_INELIGIBLE: 'The owning account is banned or closing, so reminders are not sent on its behalf.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** SHA-256 over the exact fields handed to the provider. Stored instead of the body. */
export function fingerprintReminderEmail(email: SellerReminderEmail): string {
    return createHash('sha256')
        .update(JSON.stringify([email.from, email.to, email.subject, email.html, email.replyTo]))
        .digest('hex');
}

export function buildReminderForRequest(
    request: Request,
    brandProfile: BrandProfile | null,
    fallbackAgentName: string | undefined
): { email: SellerReminderEmail; fingerprint: string } {
    const email = buildSellerReminderEmail({
        sellerEmail: (request.seller_email || '').trim(),
        sellerName: request.seller_name || undefined,
        propertyAddress: request.property_address,
        closingDate: request.closing_date || undefined,
        agentName: brandProfile?.contact_name || fallbackAgentName || undefined,
        brandProfile: brandProfile || undefined,
        sellerToken: request.seller_token || request.public_token,
    });
    return { email, fingerprint: fingerprintReminderEmail(email) };
}

/**
 * Loads the request and renders the reminder exactly as it would be sent.
 * `adminPolicy` applies the Admin eligibility rules (unsubmitted or reopened for
 * the seller, owner in good standing); the customer path keeps its existing rules.
 */
export async function prepareSellerReminder(input: {
    requestId: string;
    adminPolicy: boolean;
    /** Customer path: the already-authorized request and agent name. */
    request?: Request;
    fallbackAgentName?: string;
    owner?: { role: string; closure_status?: string | null; full_name: string | null } | null;
}): Promise<{ ok: true; prepared: PreparedSellerReminder } | { ok: false; code: ReminderIneligibleCode }> {
    const request = input.request ?? await getRequestById(input.requestId, { includeDeleted: true });
    if (!request) return { ok: false, code: 'NOT_FOUND' };
    if (request.deleted_at) return { ok: false, code: 'REQUEST_DELETED' };

    if (input.adminPolicy) {
        // A recorded submission ends Admin reminders, unless a coordinator reopened
        // the request for the seller. The claim statement applies the same rule.
        const reopenedForSeller = request.status === 'in_progress' && Number(request.seller_edit_version ?? 0) > 0;
        if (request.status === 'submitted' || (request.metered_at && !reopenedForSeller)) {
            return { ok: false, code: 'REQUEST_SUBMITTED' };
        }
        if (!input.owner || input.owner.role === 'banned' || (input.owner.closure_status ?? 'active') !== 'active') {
            return { ok: false, code: 'OWNER_INELIGIBLE' };
        }
    }

    const sellerEmail = (request.seller_email || '').trim();
    if (!sellerEmail) return { ok: false, code: 'NO_SELLER_EMAIL' };
    if (input.adminPolicy && !EMAIL_PATTERN.test(sellerEmail)) return { ok: false, code: 'INVALID_SELLER_EMAIL' };

    const brandProfile = request.brand_profile_id ? await getBrandProfile(request.brand_profile_id) : null;
    const fallbackAgentName = input.fallbackAgentName ?? input.owner?.full_name ?? undefined;
    const { email, fingerprint } = buildReminderForRequest(request, brandProfile, fallbackAgentName);
    return { ok: true, prepared: { request, email, fingerprint } };
}

export type ProviderOutcome =
    | { kind: 'accepted'; messageId: string | null }
    /** The provider definitively did not send this message. */
    | { kind: 'rejected'; code: string }
    /** Another request with this key is still running; nothing new was sent by this call. */
    | { kind: 'in_progress' }
    /** Timeout, network failure or provider fault: the message may or may not have been sent. */
    | { kind: 'unknown'; code: string };

const DEFINITIVE_REJECTIONS = new Set([
    'validation_error',
    'missing_required_field',
    'invalid_parameter',
    'invalid_from_address',
    'invalid_attachment',
    'invalid_access',
    'invalid_region',
    'invalid_idempotency_key',
    'missing_api_key',
    'invalid_api_key',
    'restricted_api_key',
    'security_error',
    'monthly_quota_exceeded',
    'daily_quota_exceeded',
    'rate_limit_exceeded',
    'not_found',
    'method_not_allowed',
]);

export function classifyProviderResult(result: SellerReminderSendResult): ProviderOutcome {
    if (result.success) return { kind: 'accepted', messageId: result.messageId ?? null };

    if (result.threw) {
        // Thrown before any request was made: nothing could have been sent.
        if (/RESEND_API_KEY environment variable is not set/.test(result.error || '')) {
            return { kind: 'rejected', code: 'email_not_configured' };
        }
        return { kind: 'unknown', code: 'provider_request_failed' };
    }

    const code = result.errorCode || 'provider_error';
    if (code === 'concurrent_idempotent_requests') return { kind: 'in_progress' };
    if (DEFINITIVE_REJECTIONS.has(code)) return { kind: 'rejected', code };
    // Includes `invalid_idempotent_request`: an earlier attempt with this key may have been sent.
    return { kind: 'unknown', code };
}

export type SellerReminderResult =
    | { status: 'accepted'; operationId: string; alreadyAccepted: boolean }
    /** Provider accepted the message but the local record could not be completed. Retry completes it without resending. */
    | { status: 'accepted_unrecorded'; operationId: string }
    | { status: 'failed'; operationId: string; code: string }
    | { status: 'unknown'; operationId: string; code: string }
    | { status: 'blocked'; code: Exclude<ReminderClaimOutcome, 'CLAIMED' | 'RESUMED' | 'ALREADY_ACCEPTED'>; blockingOperationId: string | null; retryAfterSeconds: number | null };

type SendFn = typeof sendBuiltSellerReminderEmail;

/**
 * Claims, sends and finalizes one reminder operation. Calling it again with the
 * same `operationId` resumes that operation with the same provider idempotency
 * key and never produces a second accepted reminder, event or audit entry.
 */
export async function executeSellerReminder(input: {
    operationId: string;
    prepared: PreparedSellerReminder;
    actor: ReminderActor;
    db?: StatementExecutor;
    send?: SendFn;
}): Promise<SellerReminderResult> {
    const db = input.db ?? getStatementExecutor();
    const send = input.send ?? sendBuiltSellerReminderEmail;
    const { operationId, prepared, actor } = input;

    const claim = await claimReminderOperation({
        db,
        operationId,
        requestId: prepared.request.id,
        actor,
        recipientEmail: prepared.email.to,
        payloadFingerprint: prepared.fingerprint,
    });

    if (claim.outcome === 'ALREADY_ACCEPTED') {
        return { status: 'accepted', operationId, alreadyAccepted: true };
    }
    if (claim.outcome !== 'CLAIMED' && claim.outcome !== 'RESUMED') {
        return {
            status: 'blocked',
            code: claim.outcome,
            blockingOperationId: claim.blockingOperationId,
            retryAfterSeconds: claim.retryAfterSeconds,
        };
    }

    // The claim and attempt audit are committed. No transaction is open across this call.
    const outcome = classifyProviderResult(
        await send(prepared.email, { idempotencyKey: `seller-reminder/${operationId}` })
    );

    if (outcome.kind === 'in_progress') {
        return { status: 'blocked', code: 'IN_FLIGHT', blockingOperationId: operationId, retryAfterSeconds: null };
    }

    if (outcome.kind === 'accepted') {
        const context = actor.type === 'admin'
            ? { ipAddress: actor.admin.ipAddress, userAgent: actor.admin.userAgent }
            : { ipAddress: actor.ipAddress, userAgent: actor.userAgent };
        try {
            await finalizeReminderAccepted({
                db,
                operationId,
                providerMessageId: outcome.messageId,
                admin: actor.type === 'admin' ? actor.admin : null,
                auditReason: actor.type === 'admin' ? actor.reason : null,
                ...context,
            });
            return { status: 'accepted', operationId, alreadyAccepted: false };
        } catch (error) {
            // The operation stays pending, so no ordinary fresh send is possible.
            console.error('[reminder][finalize_failed]', {
                operationId,
                errorName: error instanceof Error ? error.name : typeof error,
            });
            return { status: 'accepted_unrecorded', operationId };
        }
    }

    const state = outcome.kind === 'rejected' ? 'failed' : 'unknown';
    try {
        await recordReminderOutcome({ db, operationId, state, failureCode: outcome.code });
    } catch (error) {
        // Left pending; it ages into `unknown`, which is the conservative reading.
        console.error('[reminder][outcome_record_failed]', {
            operationId,
            state,
            errorName: error instanceof Error ? error.name : typeof error,
        });
        return { status: 'unknown', operationId, code: outcome.code };
    }
    return { status: state, operationId, code: outcome.code };
}
