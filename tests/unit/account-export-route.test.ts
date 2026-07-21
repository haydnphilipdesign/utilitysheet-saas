import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getContext: vi.fn(),
    getExport: vi.fn(),
    recordEvent: vi.fn(),
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(),
    isRateLimitUnavailable: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/account/security', () => ({
    getAccountSecurityContext: mocks.getContext,
    accountSecurityErrorResponse: () => null,
}));
vi.mock('@/lib/neon/queries', () => ({
    getAccountDataExport: mocks.getExport,
    recordAccountSecurityEvent: mocks.recordEvent,
}));
vi.mock('@/lib/rate-limit', () => ({
    accountExportRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: mocks.getRateLimitHeaders,
    isRateLimitUnavailable: mocks.isRateLimitUnavailable,
}));

import { GET } from '@/app/api/account/export/route';

describe('/api/account/export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getContext.mockResolvedValue({ user: { id: 'stack_1' }, account: { id: 'acct_1' } });
        mocks.checkRateLimit.mockResolvedValue({ success: true, reason: 'ok', limit: 3, remaining: 2, reset: 1000 });
        mocks.getRateLimitHeaders.mockReturnValue({});
        mocks.isRateLimitUnavailable.mockReturnValue(false);
        mocks.recordEvent.mockResolvedValue(true);
        mocks.getExport.mockResolvedValue({
            account: { id: 'acct_1', email: 'owner@example.com' },
            requests: [{ id: 'req_1', property_address: '123 Main St' }],
            requestTimeline: [{ request_id: 'req_1', event_type: 'submitted' }],
        });
    });

    it('requires recent authentication and returns a no-store attachment without credential fields', async () => {
        const response = await GET();
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(mocks.getContext).toHaveBeenCalledWith({ requireRecentAuth: true });
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(response.headers.get('content-disposition')).toContain('attachment');
        expect(body).toContain('personal-account-and-account-owned-records');
        expect(body).not.toMatch(/seller_token|public_token|stripe_customer_id|auth_user_id|ip_address|user_agent/);
        expect(mocks.recordEvent).toHaveBeenCalledWith({ accountId: 'acct_1', action: 'account_data_exported' });
    });
});
