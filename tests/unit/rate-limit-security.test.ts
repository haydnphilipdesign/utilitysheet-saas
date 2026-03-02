import { describe, expect, it } from 'vitest';
import { aiRatelimit, checkRateLimit, requestCreationRatelimit } from '@/lib/rate-limit';

describe('rate limit security behavior', () => {
    it('returns unavailable when persistent limit is required but redis is not configured', async () => {
        const result = await checkRateLimit(aiRatelimit, 'security-test-unavailable', {
            requirePersistent: true,
        });
        expect(result.success).toBe(false);
        expect(result.reason).toBe('unavailable');
    });

    it('supports in-memory fallback when persistent limit is not required', async () => {
        const key = `security-test-fallback-${Date.now()}`;
        const first = await checkRateLimit(requestCreationRatelimit, key);
        expect(first.success).toBe(true);
        expect(first.reason).toBe('ok');
    });
});
