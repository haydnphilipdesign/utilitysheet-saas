'use server';

import { getUserById, requireAdmin } from '@/lib/admin';
import {
    AdminActionRefusal,
    STALE_EDIT_MESSAGE,
    adminActionFailure,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import { requestSellerRefusal, requestStatusRefusal } from '@/lib/admin/refusals';
import { getRequestById } from '@/lib/neon/queries';
import { correctRequestStatus, updateRequestSellerContact } from '@/lib/neon/queries/admin-writes';
import {
    REMINDER_COOLDOWN_SECONDS,
    REMINDER_RETRY_WINDOW_SECONDS,
    REMINDER_UNKNOWN_BLOCK_SECONDS,
    finalizeReminderAccepted,
    getReminderHistory,
    getReminderOperation,
    resolveReminderNotSent,
    type ReminderOperationRow,
} from '@/lib/neon/queries/reminder-operations';
import { isMissingRelationError } from '@/lib/neon/statements';
import {
    REMINDER_INELIGIBLE_MESSAGES,
    executeSellerReminder,
    prepareSellerReminder,
} from '@/lib/reminders/seller-reminder';
import {
    adminReminderPreviewSchema,
    adminReminderResolveSchema,
    adminReminderSendSchema,
    adminRequestSellerSchema,
    adminRequestStatusSchema,
} from '@/lib/validation/admin-schemas';

type AdminActionResult = { success: true } | AdminActionFailure;

/**
 * Support-only status correction. It never performs a submission: metering,
 * quota, referral credits, completion email and packet generation are untouched.
 */
export async function updateRequestStatusAdminAction(input: {
    requestId: string;
    status: string;
    expectedStatus: string;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminRequestStatusSchema.parse(input);

        const { outcome } = await correctRequestStatus({
            actor,
            reason: parsed.reason,
            requestId: parsed.requestId,
            nextStatus: parsed.status,
            expectedStatus: parsed.expectedStatus,
        });
        if (outcome !== 'OK') throw requestStatusRefusal(outcome);
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'request_status_correction');
    }
}

type SellerContactInput = { sellerName?: string | null; sellerEmail?: string | null; sellerPhone?: string | null };

export async function updateRequestSellerAdminAction(input: {
    requestId: string;
    seller: SellerContactInput;
    expected: SellerContactInput;
    reason: string;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminRequestSellerSchema.parse(input);

        const { outcome } = await updateRequestSellerContact({
            actor,
            reason: parsed.reason,
            requestId: parsed.requestId,
            seller: parsed.seller,
            expected: parsed.expected,
        });
        if (outcome !== 'OK') throw requestSellerRefusal(outcome);
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'request_seller_update');
    }
}

const REMINDER_MIGRATION_PENDING =
    'Reminder tracking is not available yet (database migration pending). No reminder was sent.';

export type SellerReminderPreview = {
    eligible: boolean;
    ineligibleReason: string | null;
    recipient: string | null;
    from: string | null;
    replyTo: string | null;
    subject: string | null;
    /** Exact HTML that will be sent. Rendered in a sandboxed frame; never stored. */
    html: string | null;
    fingerprint: string | null;
    lastSentAt: string | null;
    cooldownSecondsRemaining: number;
    /** An operation whose outcome must be settled before a fresh reminder. */
    unresolved: (Pick<ReminderOperationRow, 'id' | 'state' | 'createdAt' | 'failureCode'> & { canRetry: boolean }) | null;
    recent: Array<Pick<ReminderOperationRow, 'id' | 'state' | 'actorType' | 'createdAt' | 'deliveryStatus' | 'failureCode'>>;
};

async function loadOwner(requestId: string) {
    const request = await getRequestById(requestId, { includeDeleted: true });
    return request ? getUserById(request.account_id) : null;
}

/** Read-only: renders the reminder exactly as it would be sent, plus recent history. */
export async function getSellerReminderPreviewAdminAction(
    requestId: string
): Promise<{ success: true; preview: SellerReminderPreview } | AdminActionFailure> {
    try {
        await requireAdmin();
        const parsed = adminReminderPreviewSchema.parse({ requestId });

        const prepared = await prepareSellerReminder({
            requestId: parsed.requestId,
            adminPolicy: true,
            owner: await loadOwner(parsed.requestId),
        });
        if (!prepared.ok && prepared.code === 'NOT_FOUND') {
            throw new AdminActionRefusal('NOT_FOUND', 'Request not found');
        }

        let history: Awaited<ReturnType<typeof getReminderHistory>>;
        try {
            history = await getReminderHistory({ requestId: parsed.requestId });
        } catch (error) {
            if (isMissingRelationError(error)) throw new AdminActionRefusal('MIGRATION_PENDING', REMINDER_MIGRATION_PENDING);
            throw error;
        }

        const now = Date.now();
        const lastSentMs = history.lastSentAt ? Date.parse(history.lastSentAt) : NaN;
        const cooldownSecondsRemaining = Number.isFinite(lastSentMs)
            ? Math.max(0, Math.ceil((lastSentMs + REMINDER_COOLDOWN_SECONDS * 1000 - now) / 1000))
            : 0;
        const email = prepared.ok ? prepared.prepared.email : null;
        const fingerprint = prepared.ok ? prepared.prepared.fingerprint : null;
        const open = history.operations.find((operation) => operation.state === 'pending' || operation.state === 'unknown');
        const openAgeMs = open ? now - Date.parse(open.createdAt) : 0;
        const unresolved = open && (open.state === 'pending' || openAgeMs < REMINDER_UNKNOWN_BLOCK_SECONDS * 1000)
            ? {
                id: open.id,
                state: open.state,
                createdAt: open.createdAt,
                failureCode: open.failureCode,
                // Same payload inside the provider idempotency window: the same key can be retried safely.
                canRetry: fingerprint === open.payloadFingerprint && openAgeMs < REMINDER_RETRY_WINDOW_SECONDS * 1000,
            }
            : null;

        return {
            success: true,
            preview: {
                eligible: prepared.ok,
                ineligibleReason: prepared.ok ? null : REMINDER_INELIGIBLE_MESSAGES[prepared.code],
                recipient: email?.to ?? null,
                from: email?.from ?? null,
                replyTo: email?.replyTo ?? null,
                subject: email?.subject ?? null,
                html: email?.html ?? null,
                fingerprint,
                lastSentAt: history.lastSentAt,
                cooldownSecondsRemaining,
                unresolved,
                recent: history.operations.map(({ id, state, actorType, createdAt, deliveryStatus, failureCode }) => ({
                    id, state, actorType, createdAt, deliveryStatus, failureCode,
                })),
            },
        };
    } catch (error) {
        return adminActionFailure(error, 'request_reminder_preview');
    }
}

export type SellerReminderSendResult =
    | { success: true; state: 'accepted'; alreadyAccepted: boolean; message: string }
    | { success: true; state: 'accepted_unrecorded'; message: string }
    | AdminActionFailure;

const BLOCKED_MESSAGES: Record<string, string> = {
    NOT_FOUND: 'Request not found',
    ACTOR_NOT_ADMIN: 'Admin access required',
    REQUEST_DELETED: REMINDER_INELIGIBLE_MESSAGES.REQUEST_DELETED,
    REQUEST_SUBMITTED: REMINDER_INELIGIBLE_MESSAGES.REQUEST_SUBMITTED,
    OWNER_INELIGIBLE: REMINDER_INELIGIBLE_MESSAGES.OWNER_INELIGIBLE,
    RECIPIENT_CHANGED: STALE_EDIT_MESSAGE,
    PAYLOAD_CHANGED:
        'The message no longer matches what was originally attempted, so that attempt cannot be retried safely. Verify it with the email provider, settle it, then review a new reminder.',
    RETRY_WINDOW_EXPIRED:
        'This attempt is too old to retry safely. Verify it with the email provider and settle it before sending a new reminder.',
    OPERATION_FAILED: 'This attempt already failed. Close this dialog and review a new reminder.',
    OPERATION_MISMATCH: 'This operation belongs to a different request. Close this dialog and review again.',
    IN_FLIGHT: 'A reminder for this request is being sent right now. Wait a minute and refresh before trying again.',
    UNRESOLVED:
        'An earlier reminder has an unknown outcome. Verify it with the email provider and settle it before sending another.',
    COOLDOWN: 'A reminder was sent recently. Wait for the cooldown before sending another.',
};

/**
 * Sends the reviewed reminder. The preview fingerprint must still match, the
 * attempt is audited before the provider is contacted, and resubmitting the
 * same `operationId` resumes that operation instead of sending again.
 */
export async function sendSellerReminderAdminAction(input: {
    requestId: string;
    operationId: string;
    reason: string;
    confirmed: boolean;
    expectedFingerprint: string;
}): Promise<SellerReminderSendResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminReminderSendSchema.parse(input);

        const prepared = await prepareSellerReminder({
            requestId: parsed.requestId,
            adminPolicy: true,
            owner: await loadOwner(parsed.requestId),
        });
        if (!prepared.ok) throw new AdminActionRefusal(prepared.code, REMINDER_INELIGIBLE_MESSAGES[prepared.code]);
        if (prepared.prepared.fingerprint !== parsed.expectedFingerprint) {
            throw new AdminActionRefusal(
                'STALE_PREVIEW',
                'The recipient, branding or message changed after this preview was shown. Nothing was sent. Review the updated preview before sending.'
            );
        }

        let result: Awaited<ReturnType<typeof executeSellerReminder>>;
        try {
            result = await executeSellerReminder({
                operationId: parsed.operationId,
                prepared: prepared.prepared,
                actor: { type: 'admin', admin: actor, reason: parsed.reason },
            });
        } catch (error) {
            if (isMissingRelationError(error)) throw new AdminActionRefusal('MIGRATION_PENDING', REMINDER_MIGRATION_PENDING);
            throw error;
        }

        switch (result.status) {
            case 'accepted':
                return {
                    success: true,
                    state: 'accepted',
                    alreadyAccepted: result.alreadyAccepted,
                    message: result.alreadyAccepted
                        ? 'This reminder was already accepted by the email provider. Nothing was sent again.'
                        : 'The email provider accepted the reminder. Acceptance is not proof of delivery.',
                };
            case 'accepted_unrecorded':
                return {
                    success: true,
                    state: 'accepted_unrecorded',
                    message:
                        'The email provider accepted the reminder, but recording it failed. Do not start a new reminder: retry this one to finish recording it. It cannot be sent twice.',
                };
            case 'failed':
                throw new AdminActionRefusal(
                    'REMINDER_REJECTED',
                    'The email provider rejected the reminder, so it was not sent. Reference code: ' + result.code + '.'
                );
            case 'unknown':
                throw new AdminActionRefusal(
                    'REMINDER_OUTCOME_UNKNOWN',
                    'The email provider did not confirm the outcome, so the reminder may or may not have been sent. Retry this same operation (it cannot send twice), or verify it with the provider and settle it.'
                );
            case 'blocked':
                throw new AdminActionRefusal(
                    result.code === 'ACTOR_NOT_ADMIN' ? 'UNAUTHORIZED' : result.code,
                    BLOCKED_MESSAGES[result.code] || 'The reminder could not be sent.'
                );
        }
    } catch (error) {
        return adminActionFailure(error, 'request_reminder_send');
    }
}

/**
 * Settles a reminder whose outcome is unknown after the operator has checked
 * the email provider. `accepted` records the single timeline event; `failed`
 * frees the request for a new reviewed reminder. Either way it is audited.
 */
export async function resolveSellerReminderAdminAction(input: {
    operationId: string;
    resolution: string;
    reason: string;
    confirmed: boolean;
}): Promise<AdminActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminReminderResolveSchema.parse(input);

        const operation = await getReminderOperation({ operationId: parsed.operationId });
        if (!operation) throw new AdminActionRefusal('NOT_FOUND', 'Reminder operation not found');

        const settled = parsed.resolution === 'accepted'
            ? (await finalizeReminderAccepted({
                operationId: parsed.operationId,
                providerMessageId: null,
                admin: actor,
                auditAction: 'request_reminder_resolved',
                auditReason: parsed.reason,
                verifiedManually: true,
                ipAddress: actor.ipAddress,
                userAgent: actor.userAgent,
            })).finalized
            : (await resolveReminderNotSent({ operationId: parsed.operationId, admin: actor, reason: parsed.reason })).resolved;

        if (!settled) {
            throw new AdminActionRefusal('STALE', 'This reminder was already settled. Refresh to see its current state.');
        }
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'request_reminder_resolve');
    }
}
