/** Operational diagnostics only: never pass business payloads to console. */
const EVENTS = [
    'auxiliary_write_failed',
    'email_demo_redirect', 'email_attachment_attempted', 'email_attachment_generated',
    'email_attachment_skipped', 'email_attachment_failed', 'email_send_started',
    'email_send_accepted', 'email_send_failed', 'email_not_configured',
    'pdf_launch', 'pdf_readability_warning', 'pdf_attachment_failed',
    'gemini_invalid_thinking_level', 'gemini_thinking_unsupported', 'gemini_timeout',
    'gemini_api_failed', 'gemini_retry', 'gemini_parse_failed',
    'contact_resolved', 'contact_telemetry_failed', 'suggestion_outcome', 'suggestion_telemetry_failed',
    'intake_metadata_failed', 'intake_start_failed', 'intake_address_incomplete',
    'seller_read_failed', 'seller_submit_failed', 'seller_selection_telemetry_failed',
    'seller_membership_failed', 'seller_delivery_telemetry_failed', 'seller_email_failed',
    'seller_contact_alert_failed', 'seller_search_failed', 'seller_suggestions_failed',
    'seller_self_link_failed', 'seller_observation_failed', 'packet_read_failed', 'packet_pdf_failed',
] as const;

type DiagnosticEvent = typeof EVENTS[number];
const ENUM_FIELDS: Record<string, readonly string[]> = {
    observation: ['request_created', 'seller_opened', 'seller_self_send_link', 'suggestions_fetched',
        'suggestions_search', 'test_drive_invitation_succeeded', 'test_drive_invitation_failed',
        'test_drive_delivery_succeeded', 'test_drive_delivery_failed', 'ai_run', 'ai_selection',
        'operational_event', 'operational_success', 'job_start', 'job_finish', 'seller_observation'],
    reasonCode: ['ai_unconfigured', 'ai_provider_error', 'ai_parse_error', 'ai_empty',
        'quality_gate_failed', 'state_mismatch_rejected', 'fallback_used'],
    upstreamReasonCode: ['ai_unconfigured', 'ai_provider_error', 'ai_parse_error', 'ai_empty',
        'quality_gate_failed', 'state_mismatch_rejected', 'fallback_used'],
    operation: ['seller_notification', 'seller_reminder', 'organization_invite', 'invitation_accepted',
        'feedback', 'completion_notification', 'referral_credit', 'contact_resolution_alert',
        'weekly_summary', 'activation_reminder', 'account_closed'],
    reason: ['not_found', 'not_submitted', 'locked', 'disabled', 'non_retryable', 'attempts_exhausted', 'deadline', 'write_failed'],
    category: ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable'],
    source: ['ai_primary', 'ai_verify', 'ai_recovery', 'history_blend', 'fallback', 'cache'],
    strategy: ['env_executable', 'bin_path', 'pack_url', 'default'],
    renderStrategy: ['print_pdf', 'screenshot'],
    mode: ['simple', 'advanced'],
    headless: ['shell'],
    limitingDimension: ['width', 'height'],
    failureKind: ['unconfigured', 'circuit_open', 'deadline', 'timeout', 'rate_limited', 'empty_response', 'api_error'],
};
const NUMBER_FIELDS = new Set([
    'bytes', 'attempt', 'attemptCount', 'delayMs', 'latencyMs', 'suggestionCount',
    'sourceWidth', 'sourceHeight', 'effectiveBaselineFontPt', 'missingFieldCount',
]);
const ERROR_NAMES = new Set([
    'Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError',
    'AbortError', 'TimeoutError', 'GeminiTimeoutError', 'GeminiEmptyResponseError',
    'APIError', 'ApiError', 'DatabaseError', 'PostgresError',
]);

/** Names classify exceptions, not root causes. Messages, stacks and causes are never read. */
function errorFields(error: unknown): Record<string, string | number> {
    if (error === undefined) return {};
    const value = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    const nested = typeof value.error === 'object' && value.error !== null
        ? value.error as Record<string, unknown> : {};
    const status = [value.status, value.statusCode, nested.status, value.code, nested.code]
        .find(candidate => typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599);
    return {
        errorName: typeof value.name === 'string' && ERROR_NAMES.has(value.name) ? value.name : 'UnknownError',
        errorFamily: status === 429 ? 'rate_limit' : typeof status === 'number' && status >= 500
            ? 'upstream_server' : typeof status === 'number' && status >= 400 ? 'upstream_request' : 'unclassified',
        ...(typeof status === 'number' ? { status } : {}),
    };
}

/** Reconstruct a bounded flat payload; arbitrary strings/objects and unknown keys are dropped. */
export function logDiagnostic(
    level: 'log' | 'warn' | 'error',
    event: DiagnosticEvent,
    properties: Record<string, unknown> = {},
    error?: unknown,
): void {
    try {
        if (!(EVENTS as readonly string[]).includes(event)) return;
        const safe: Record<string, string | number | boolean> = errorFields(error);
        for (const [key, choices] of Object.entries(ENUM_FIELDS)) {
            const value = properties[key];
            if (typeof value === 'string' && choices.includes(value)) safe[key] = value;
        }
        for (const key of NUMBER_FIELDS) {
            const value = properties[key];
            if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000) safe[key] = value;
        }
        for (const key of ['headless', 'retryable']) {
            if (typeof properties[key] === 'boolean') safe[key] = properties[key];
        }
        // Internal UUID only. Public tokens, provider IDs and user-controlled correlation strings are excluded.
        const requestId = properties.requestId;
        if (typeof requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) safe.requestId = requestId;
        console[level](`[diagnostic] ${event}`, safe);
    } catch {
        // Diagnostics must not change the primary action if a sink or unusual exception getter fails.
    }
}
