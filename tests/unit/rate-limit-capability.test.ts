import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: class {} }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class {
    limit = limit;
    static slidingWindow = vi.fn();
} }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

async function load(persistent: boolean) {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', persistent ? 'https://redis.invalid' : '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', persistent ? 'synthetic-credential' : '');
    return import('@/lib/rate-limit');
}

describe('capability enforcement at limiter boundary', () => {
    it('passes only the digest to persistent counters/analytics and preserves limited results/headers', async () => {
        const { checkRateLimit, aiRatelimit, getRateLimitHeaders } = await load(true);
        limit.mockResolvedValue({ success: false, limit: 20, remaining: 0, reset: 12345 });
        const key = capabilityRateLimitIdentifier('seller-ai', 'synthetic-secret:1.2.3.4');
        const result = await checkRateLimit(aiRatelimit, key, { requirePersistent: true });
        expect(limit).toHaveBeenCalledWith(key);
        expect(JSON.stringify(limit.mock.calls)).not.toContain('synthetic-secret');
        expect(result).toEqual({ success: false, limit: 20, remaining: 0, reset: 12345, reason: 'limited' });
        expect(getRateLimitHeaders(result)).toEqual({ 'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '12345' });
    });

    it('does not allow SDK timeout success or rejected enforcement', async () => {
        const { checkRateLimit, aiRatelimit } = await load(true);
        limit.mockResolvedValue({ success: true, limit: 0, remaining: 0, reset: 0, reason: 'timeout' });
        expect(await checkRateLimit(aiRatelimit, 'opaque', { requirePersistent: true })).toMatchObject({ success: false, reason: 'unavailable', limit: 20 });
        limit.mockRejectedValue(new Error('synthetic outage'));
        await expect(checkRateLimit(aiRatelimit, 'opaque', { requirePersistent: true })).rejects.toThrow('synthetic outage');
    });

    it('fails closed without persistent configuration', async () => {
        const { checkRateLimit, formSubmissionRatelimit } = await load(false);
        expect(await checkRateLimit(formSubmissionRatelimit, 'opaque', { requirePersistent: true })).toMatchObject({ success: false, reason: 'unavailable' });
        expect(limit).not.toHaveBeenCalled();
    });

    it('preserves all affected thresholds, reset windows and unrelated identifiers in memory', async () => {
        const api = await load(false);
        vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        for (const [scope, policy, threshold, windowMs] of [
            ['seller-submission', api.formSubmissionRatelimit, 5, 60_000],
            ['seller-ai', api.aiRatelimit, 20, 60_000],
            ['packet-pdf', api.packetPdfRatelimit, 5, 60_000],
            ['seller-send-link', api.reminderRatelimit, 3, 900_000],
        ] as const) {
            const key = capabilityRateLimitIdentifier(scope, 'synthetic-secret');
            for (let i = 0; i < threshold; i++) expect((await api.checkRateLimit(policy, key)).success).toBe(true);
            expect((await api.checkRateLimit(policy, key)).reason).toBe('limited');
            vi.mocked(Date.now).mockReturnValue(1_000_000 + windowMs);
            expect((await api.checkRateLimit(policy, key)).success).toBe(true);
            vi.mocked(Date.now).mockReturnValue(1_000_000);
        }
        vi.restoreAllMocks();
        const persistentApi = await load(true);
        limit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 12345 });
        await persistentApi.checkRateLimit(persistentApi.requestCreationRatelimit, 'unchanged-user');
        expect(limit).toHaveBeenLastCalledWith('unchanged-user');
    });
});
