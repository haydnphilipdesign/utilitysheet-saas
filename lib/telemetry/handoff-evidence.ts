/**
 * Email handoff and PDF execution evidence: the shared contract.
 *
 * Evidence is advisory. "Accepted" means the provider took the message, not
 * that it arrived; "delivered" means the provider reports delivery, not that
 * anyone read it. Nothing here holds an email address, name, property address,
 * link, filename or document content: recipients are positions (slots) within
 * one send, in the order the caller attempted them.
 */

export const NOTIFICATION_PURPOSES = ['completion_notification', 'request_invitation'] as const;
export type NotificationPurpose = (typeof NOTIFICATION_PURPOSES)[number];

export const NOTIFICATION_SEND_OUTCOMES = ['accepted', 'failed', 'unknown', 'no_recipients'] as const;
export type NotificationSendOutcome = (typeof NOTIFICATION_SEND_OUTCOMES)[number];

export const NOTIFICATION_ATTACHMENT_STATUSES = ['attached', 'failed', 'disabled', 'skipped', 'not_applicable'] as const;
export type NotificationAttachmentStatus = (typeof NOTIFICATION_ATTACHMENT_STATUSES)[number];

export type HandoffMode = 'live' | 'test';

export const PDF_FAILURE_STAGES = ['data', 'build_html', 'browser_launch', 'page_load', 'render'] as const;
export type PdfFailureStage = (typeof PDF_FAILURE_STAGES)[number];

export const PDF_LAUNCH_STRATEGIES = ['env_executable', 'bin_path', 'pack_url', 'default'] as const;
export type PdfLaunchStrategy = (typeof PDF_LAUNCH_STRATEGIES)[number];

export type PdfSurface = 'download' | 'completion_attachment';

/** Rows kept per request. Past the ceiling nothing more is stored for it. */
export const NOTIFICATION_OBSERVATION_MAX_PER_REQUEST = 200;
export const PDF_OBSERVATION_MAX_PER_REQUEST = 300;
export const MAX_RECIPIENT_SLOTS = 100;

/**
 * What one PDF execution did, reported by the renderer. The request is known
 * only after the caller's link or id resolved to one, so it is null for an
 * unknown link and for a lookup that failed before resolving.
 */
export interface PdfRenderEvidence {
    requestId: string | null;
    isDemo: boolean | null;
    packetMode: 'simple' | 'advanced' | null;
    renderStrategy: 'print_pdf' | 'screenshot' | null;
    launchStrategy: PdfLaunchStrategy | null;
    outcome: 'rendered' | 'failed' | 'skipped';
    skipReason: 'not_found' | 'not_submitted' | 'locked' | null;
    failureStage: PdfFailureStage | null;
    errorName: string | null;
    totalMs: number;
    dataMs: number | null;
    launchMs: number | null;
    renderMs: number | null;
    bytes: number | null;
}

/** The fields of a send result this module reads. Raw error text is only pattern-tested, never stored. */
export type SendResultLike = {
    success: boolean;
    error?: string;
    messageId?: string;
    errorCode?: string;
    threw?: boolean;
    attachmentStatus?: string;
    pdfEvidence?: PdfRenderEvidence | null;
};

/** A send that either returned a result or rejected. A missing result is read as "no response". */
export type SettledSend =
    | { status: 'fulfilled'; value: SendResultLike | null | undefined }
    | { status: 'rejected'; reason?: unknown };

export type NotificationObservationInput = {
    operationId: string;
    requestId: string;
    purpose: NotificationPurpose;
    mode: HandoffMode;
    recipientSlot: number;
    intendedRecipients: number;
    sendOutcome: NotificationSendOutcome;
    providerMessageId: string | null;
    failureCode: string | null;
    attachmentStatus: NotificationAttachmentStatus;
};

export type PdfRenderObservationInput = {
    requestId: string;
    operationId: string | null;
    recipientSlot: number | null;
    surface: PdfSurface;
    mode: HandoffMode;
    packetMode: 'simple' | 'advanced' | null;
    renderStrategy: 'print_pdf' | 'screenshot' | null;
    launchStrategy: PdfLaunchStrategy | null;
    outcome: 'rendered' | 'failed' | 'skipped';
    skipReason: 'not_submitted' | 'locked' | null;
    failureStage: PdfFailureStage | null;
    errorName: string | null;
    httpStatus: number | null;
    totalMs: number | null;
    dataMs: number | null;
    launchMs: number | null;
    renderMs: number | null;
    bytes: number | null;
};

export type HandoffEvidence = {
    notifications: NotificationObservationInput[];
    pdfRenders: PdfRenderObservationInput[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_CONFIGURED = /RESEND_API_KEY environment variable is not set/;

export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID.test(value);
}

/** A short identifier-like label, or null. Free text never passes. */
function safeCode(value: unknown, maxLength = 80): string | null {
    return typeof value === 'string' && value.length <= maxLength && /^[A-Za-z0-9_]+$/.test(value) ? value : null;
}

function safeMessageId(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null;
}

const boundedInt = (value: unknown, max = 2_000_000_000): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, Math.round(value)) : null;

/**
 * Classifies one send.
 *
 * A returned refusal is "failed". A send that threw before any provider
 * response is "unknown" (it may have been accepted), except a missing provider
 * key, where nothing can have been sent.
 */
export function classifySend(settled: SettledSend): Pick<NotificationObservationInput, 'sendOutcome' | 'providerMessageId' | 'failureCode'> {
    if (settled.status === 'rejected' || !settled.value) {
        return { sendOutcome: 'unknown', providerMessageId: null, failureCode: 'threw' };
    }
    const result = settled.value;
    if (result.success) {
        return { sendOutcome: 'accepted', providerMessageId: safeMessageId(result.messageId), failureCode: null };
    }
    if (result.threw) {
        return NOT_CONFIGURED.test(result.error || '')
            ? { sendOutcome: 'failed', providerMessageId: null, failureCode: 'not_configured' }
            : { sendOutcome: 'unknown', providerMessageId: null, failureCode: 'threw' };
    }
    return { sendOutcome: 'failed', providerMessageId: null, failureCode: safeCode(result.errorCode) ?? 'provider_rejected' };
}

function attachmentStatusOf(settled: SettledSend): NotificationAttachmentStatus {
    const status = settled.status === 'fulfilled' ? settled.value?.attachmentStatus : undefined;
    return status === 'attached' || status === 'failed' || status === 'disabled' || status === 'skipped' ? status : 'not_applicable';
}

/** Maps what the renderer reported onto a storable row, or null when no request was resolved. */
export function pdfObservationFromEvidence(
    evidence: PdfRenderEvidence | null | undefined,
    context: {
        surface: PdfSurface;
        requestId?: string | null;
        mode?: HandoffMode | null;
        operationId?: string | null;
        recipientSlot?: number | null;
        httpStatus?: number | null;
    },
): PdfRenderObservationInput | null {
    if (!evidence) return null;
    const requestId = context.requestId ?? evidence.requestId;
    const mode = context.mode ?? (evidence.isDemo === null ? null : evidence.isDemo ? 'test' : 'live');
    // An unknown link resolved nothing, so there is no request to attach evidence to.
    if (!isUuid(requestId) || !mode || evidence.skipReason === 'not_found') return null;
    return {
        requestId,
        operationId: isUuid(context.operationId) ? context.operationId : null,
        recipientSlot: boundedInt(context.recipientSlot, MAX_RECIPIENT_SLOTS - 1),
        surface: context.surface,
        mode,
        packetMode: evidence.packetMode,
        renderStrategy: evidence.renderStrategy,
        launchStrategy: evidence.launchStrategy,
        outcome: evidence.outcome,
        skipReason: evidence.skipReason === 'not_submitted' || evidence.skipReason === 'locked' ? evidence.skipReason : null,
        failureStage: evidence.failureStage,
        errorName: safeCode(evidence.errorName, 60),
        httpStatus: boundedInt(context.httpStatus, 599),
        totalMs: boundedInt(evidence.totalMs),
        dataMs: boundedInt(evidence.dataMs),
        launchMs: boundedInt(evidence.launchMs),
        renderMs: boundedInt(evidence.renderMs),
        bytes: boundedInt(evidence.bytes),
    };
}

/**
 * Evidence for one notification attempt: one row per recipient slot in the
 * order attempted, plus the PDF render made for each slot that asked for one.
 * With nobody eligible it is a single "no_recipients" row, so the attempt is
 * still visible. Returns nothing storable for an invalid request id.
 */
export function buildNotificationEvidence(input: {
    operationId: string;
    requestId: string;
    purpose: NotificationPurpose;
    mode: HandoffMode;
    sends: SettledSend[];
}): HandoffEvidence {
    if (!isUuid(input.requestId) || !isUuid(input.operationId)) return { notifications: [], pdfRenders: [] };
    const base = { operationId: input.operationId, requestId: input.requestId, purpose: input.purpose, mode: input.mode };
    if (input.sends.length === 0) {
        return {
            notifications: [{
                ...base, recipientSlot: 0, intendedRecipients: 0, sendOutcome: 'no_recipients',
                providerMessageId: null, failureCode: null, attachmentStatus: 'not_applicable',
            }],
            pdfRenders: [],
        };
    }
    const sends = input.sends.slice(0, MAX_RECIPIENT_SLOTS);
    const intendedRecipients = Math.min(MAX_RECIPIENT_SLOTS, input.sends.length);
    const pdfRenders: PdfRenderObservationInput[] = [];
    const notifications = sends.map((settled, recipientSlot): NotificationObservationInput => {
        const pdf = pdfObservationFromEvidence(settled.status === 'fulfilled' ? settled.value?.pdfEvidence : null, {
            surface: 'completion_attachment',
            requestId: input.requestId,
            mode: input.mode,
            operationId: input.operationId,
            recipientSlot,
        });
        if (pdf) pdfRenders.push(pdf);
        return { ...base, recipientSlot, intendedRecipients, ...classifySend(settled), attachmentStatus: attachmentStatusOf(settled) };
    });
    return { notifications, pdfRenders };
}

/** The incident reason for a failed PDF, by the stage that failed. */
export function pdfFailureReasonCode(evidence: PdfRenderEvidence | null | undefined): string {
    return evidence?.failureStage ? `${evidence.failureStage}_failed` : 'renderer_failed';
}
