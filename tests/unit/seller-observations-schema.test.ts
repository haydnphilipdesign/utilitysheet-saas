// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sellerObservationBodySchema } from '@/lib/validation/schemas';
import { coarseClientFamily, durationBucket, errorCodeForStatus } from '@/lib/telemetry/seller-observations';

const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const body = (events: unknown[], extra: Record<string, unknown> = {}) => ({ v: 1, session: ID, edit_version: 0, events, ...extra });
const viewed = { type: 'seller_step_viewed', id: ID, seq: 0, step: 'utility', category: 'electric', nav: 'linear', visit: 'first' };

describe('seller observation payload contract', () => {
    it('accepts each allowlisted event shape', () => {
        const events = [
            viewed,
            { type: 'seller_step_completed', id: ID, seq: 1, step: 'advanced', section: 'mailbox_access', nav: 'catch_up', duration: '3_10s' },
            { type: 'seller_submission_attempted', id: ID, seq: 2, attempt: 1 },
            { type: 'seller_submission_failed', id: ID, seq: 3, attempt: 2, error_code: 'stale_session', status: 409, duration: 'lt_1s' },
            { type: 'seller_submission_failed', id: ID, seq: 4, attempt: 3, error_code: 'offline' },
            { type: 'seller_suggestions_rendered', id: ID, seq: 5, category: 'water', source: 'initial', result_count: 0, empty_reason: 'load_failed' },
            { type: 'seller_suggestions_failed', id: ID, seq: 6, category: 'trash', source: 'search', error_code: 'rate_limited', status: 429 },
        ];
        expect(sellerObservationBodySchema.safeParse(body(events)).success).toBe(true);
    });

    it.each([
        ['an address', { ...viewed, address: '12 Sentinel Street' }],
        ['a provider name', { ...viewed, display_name: 'Sentinel Electric' }],
        ['a search query', { type: 'seller_suggestions_rendered', id: ID, seq: 0, category: 'water', source: 'search', result_count: 1, query: 'sentinel' }],
        ['a raw error', { type: 'seller_submission_failed', id: ID, seq: 0, attempt: 1, error_code: 'server_error', message: 'connection string sentinel' }],
        ['a free-text error code', { type: 'seller_submission_failed', id: ID, seq: 0, attempt: 1, error_code: 'ECONNRESET at 10.0.0.1' }],
        ['a free-text step', { ...viewed, step: 'utility_12 Sentinel Street' }],
        ['an unknown event type', { type: 'seller_answer_changed', id: ID, seq: 0 }],
        ['a URL-shaped identifier', { ...viewed, id: 'https://example.test/s/secret-token' }],
        ['an out-of-range status', { type: 'seller_submission_failed', id: ID, seq: 0, attempt: 1, error_code: 'unknown', status: 200 }],
        ['an oversized count', { type: 'seller_suggestions_rendered', id: ID, seq: 0, category: 'water', source: 'search', result_count: 5000 }],
        ['a negative sequence', { ...viewed, seq: -1 }],
    ])('rejects %s', (_label, event) => {
        expect(sellerObservationBodySchema.safeParse(body([event])).success).toBe(false);
    });

    it('rejects client-supplied identity, mode and envelope extras, and bounds the batch', () => {
        for (const extra of [{ request_id: 'r1' }, { account_id: 'a1' }, { mode: 'live' }, { token: 'secret' }, { url: '/s/secret' }]) {
            expect(sellerObservationBodySchema.safeParse(body([viewed], extra)).success).toBe(false);
        }
        expect(sellerObservationBodySchema.safeParse(body([])).success).toBe(false);
        expect(sellerObservationBodySchema.safeParse(body(Array.from({ length: 11 }, () => viewed))).success).toBe(false);
        expect(sellerObservationBodySchema.safeParse({ ...body([viewed]), v: 2 }).success).toBe(false);
        expect(sellerObservationBodySchema.safeParse({ ...body([viewed]), session: 'short' }).success).toBe(false);
    });
});

describe('seller observation helpers', () => {
    it('buckets durations and classifies statuses without free text', () => {
        expect([0, 999, 1000, 2999, 9999, 29_999, 119_999, 120_000, Number.NaN].map(durationBucket)).toEqual(
            ['lt_1s', 'lt_1s', '1_3s', '1_3s', '3_10s', '10_30s', '30_120s', 'gt_120s', 'lt_1s']);
        expect([400, 403, 404, 409, 429, 500, 503, 418].map(errorCodeForStatus)).toEqual(
            ['validation', 'forbidden', 'not_found', 'conflict', 'rate_limited', 'server_error', 'unavailable', 'unknown']);
    });

    it('reduces a user agent to two coarse labels', () => {
        expect(coarseClientFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'))
            .toEqual({ device: 'mobile', browser: 'safari' });
        expect(coarseClientFamily('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'))
            .toEqual({ device: 'mobile', browser: 'chrome' });
        expect(coarseClientFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0'))
            .toEqual({ device: 'desktop', browser: 'edge' });
        expect(coarseClientFamily('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1'))
            .toEqual({ device: 'tablet', browser: 'safari' });
        expect(coarseClientFamily('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'))
            .toEqual({ device: 'desktop', browser: 'firefox' });
        expect(coarseClientFamily(null)).toEqual({ device: 'unknown', browser: 'unknown' });
        expect(coarseClientFamily('sentinel-custom-agent/1.0 (private build 42)')).toEqual({ device: 'desktop', browser: 'other' });
    });
});
