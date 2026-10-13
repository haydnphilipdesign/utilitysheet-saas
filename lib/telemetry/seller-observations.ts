/**
 * Seller diagnostic observation contract (schema version 1), shared by the
 * browser helper, the public observation route and the Admin reader.
 *
 * Every field is a finite enum, a bounded integer or a random identifier.
 * Addresses, answers, provider/seller text, search queries, URLs, raw errors
 * and capability tokens never belong here. Browser evidence is advisory: it
 * can be lost, blocked or forged by anyone holding the seller link.
 */
export const SELLER_OBSERVATION_SCHEMA_VERSION = 1;

export const SELLER_OBSERVATION_EVENT_TYPES = [
    'seller_step_viewed', 'seller_step_completed',
    'seller_submission_attempted', 'seller_submission_failed',
    'seller_suggestions_rendered', 'seller_suggestions_failed',
] as const;
export type SellerObservationEventType = typeof SELLER_OBSERVATION_EVENT_TYPES[number];

export const SELLER_OBSERVATION_STEPS = ['welcome', 'home_basics', 'utility', 'advanced', 'review', 'success'] as const;
export type SellerObservationStep = typeof SELLER_OBSERVATION_STEPS[number];

export const SELLER_OBSERVATION_NAVIGATION = ['linear', 'review_edit', 'catch_up'] as const;
export const SELLER_OBSERVATION_VISITS = ['first', 'revisit'] as const;
export const SELLER_OBSERVATION_DURATIONS = ['lt_1s', '1_3s', '3_10s', '10_30s', '30_120s', 'gt_120s'] as const;
export type SellerObservationDuration = typeof SELLER_OBSERVATION_DURATIONS[number];

export const SELLER_OBSERVATION_ERROR_CODES = [
    'validation', 'already_submitted', 'stale_session', 'conflict', 'rate_limited',
    'unavailable', 'not_found', 'forbidden', 'server_error', 'offline', 'network', 'unknown',
] as const;
export type SellerObservationErrorCode = typeof SELLER_OBSERVATION_ERROR_CODES[number];

export const SELLER_SUGGESTION_SOURCES = ['initial', 'search'] as const;
export const SELLER_SUGGESTION_EMPTY_REASONS = ['no_suggestions', 'no_results', 'load_failed'] as const;

export const SELLER_OBSERVATION_MAX_BATCH = 10;
export const SELLER_OBSERVATION_MAX_BODY_BYTES = 8192;
/** Browser-side ceiling for one tab session of one editing session. */
export const SELLER_OBSERVATION_MAX_PER_SESSION = 150;
/** Server-side ceiling of stored diagnostic rows for one request. */
export const SELLER_OBSERVATION_MAX_PER_REQUEST = 600;
export const SELLER_OBSERVATION_MAX_RESULT_COUNT = 50;
export const SELLER_OBSERVATION_MAX_ATTEMPT = 50;
export const SELLER_OBSERVATION_ID_PATTERN = /^[A-Za-z0-9-]{16,40}$/;

export function durationBucket(milliseconds: number): SellerObservationDuration {
    if (!Number.isFinite(milliseconds) || milliseconds < 1_000) return 'lt_1s';
    if (milliseconds < 3_000) return '1_3s';
    if (milliseconds < 10_000) return '3_10s';
    if (milliseconds < 30_000) return '10_30s';
    if (milliseconds < 120_000) return '30_120s';
    return 'gt_120s';
}

/** Coarse family for an HTTP status. The response body is never read for this. */
export function errorCodeForStatus(status: number): SellerObservationErrorCode {
    if (status === 400 || status === 413 || status === 422) return 'validation';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 429) return 'rate_limited';
    if (status === 503) return 'unavailable';
    if (status >= 500 && status <= 599) return 'server_error';
    return 'unknown';
}

export type ClientFamily = {
    device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'other' | 'unknown';
};

/** Two coarse labels from the User-Agent header; the header itself is not stored. */
export function coarseClientFamily(userAgent: string | null | undefined): ClientFamily {
    const ua = typeof userAgent === 'string' ? userAgent.slice(0, 512) : '';
    if (!ua) return { device: 'unknown', browser: 'unknown' };
    const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)
        ? 'tablet'
        : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'mobile' : 'desktop';
    const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'edge'
        : /SamsungBrowser\//.test(ua) ? 'samsung'
        : /Firefox\/|FxiOS\//.test(ua) ? 'firefox'
        : /OPR\/|Opera/.test(ua) ? 'other'
        : /Chrome\/|CriOS\//.test(ua) ? 'chrome'
        : /Safari\//.test(ua) ? 'safari'
        : 'other';
    return { device, browser };
}
