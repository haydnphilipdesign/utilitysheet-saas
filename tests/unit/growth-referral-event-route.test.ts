import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { recordEvent, checkRateLimitMock } = vi.hoisted(() => ({
    recordEvent: vi.fn(),
    checkRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/neon/queries', () => ({ recordGrowthReferralEvent: recordEvent }));
vi.mock('@/lib/rate-limit', () => ({
    growthReferralEventRatelimit: { limiter: null, limit: 30, windowMs: 60000, prefix: 'test' },
    checkRateLimit: checkRateLimitMock,
    getRateLimitHeaders: () => ({}),
}));

import { POST } from '@/app/api/growth/referral-event/route';

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/growth/referral-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: 0,
        reason: 'ok',
    });
});

describe('POST /api/growth/referral-event', () => {
    it('records a validated impression and returns 204', async () => {
        const response = await POST(makeRequest({
            eventType: 'impression',
            surface: 'packet_share_page',
            referralCode: 'tc-team',
        }));

        expect(response.status).toBe(204);
        expect(recordEvent).toHaveBeenCalledWith({
            eventType: 'impression',
            surface: 'packet_share_page',
            referralCode: 'tc-team',
        });
    });

    it('accepts a null referral code', async () => {
        const response = await POST(makeRequest({
            eventType: 'click',
            surface: 'packet_share_page',
            referralCode: null,
        }));

        expect(response.status).toBe(204);
        expect(recordEvent).toHaveBeenCalledWith({
            eventType: 'click',
            surface: 'packet_share_page',
            referralCode: null,
        });
    });

    it('rejects unknown event types and unsafe referral codes', async () => {
        const badType = await POST(makeRequest({
            eventType: 'purchase',
            surface: 'packet_share_page',
            referralCode: null,
        }));
        expect(badType.status).toBe(400);

        const badCode = await POST(makeRequest({
            eventType: 'impression',
            surface: 'packet_share_page',
            referralCode: '../unsafe',
        }));
        expect(badCode.status).toBe(400);
        expect(recordEvent).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limited without recording', async () => {
        checkRateLimitMock.mockResolvedValue({
            success: false,
            limit: 30,
            remaining: 0,
            reset: 0,
            reason: 'limited',
        });

        const response = await POST(makeRequest({
            eventType: 'impression',
            surface: 'packet_share_page',
            referralCode: null,
        }));

        expect(response.status).toBe(429);
        expect(recordEvent).not.toHaveBeenCalled();
    });

    it('never surfaces a counter write failure to the packet viewer', async () => {
        recordEvent.mockRejectedValue(new Error('db down'));

        const response = await POST(makeRequest({
            eventType: 'impression',
            surface: 'packet_share_page',
            referralCode: null,
        }));

        expect(response.status).toBe(204);
    });
});
