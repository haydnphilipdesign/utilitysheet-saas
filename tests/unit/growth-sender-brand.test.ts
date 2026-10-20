import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
    getIntakeLinkBySlugMock,
    getAccountByIdMock,
    getDefaultBrandProfileMock,
    checkRateLimitMock,
} = vi.hoisted(() => ({
    getIntakeLinkBySlugMock: vi.fn(),
    getAccountByIdMock: vi.fn(),
    getDefaultBrandProfileMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: getIntakeLinkBySlugMock,
    getAccountById: getAccountByIdMock,
    getDefaultBrandProfile: getDefaultBrandProfileMock,
}));
vi.mock('@/lib/rate-limit', () => ({
    growthSenderBrandRatelimit: { limiter: null, limit: 30, windowMs: 60000, prefix: 'test' },
    checkRateLimit: checkRateLimitMock,
    getRateLimitHeaders: () => ({}),
}));

import { GET } from '@/app/api/growth/sender-brand/route';
import { getSenderBrandName } from '@/lib/growth/sender-brand';

function lookup(ref: string) {
    return GET(new Request(`http://localhost/api/growth/sender-brand?ref=${encodeURIComponent(ref)}`));
}

beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0, reason: 'ok' });
    getIntakeLinkBySlugMock.mockResolvedValue({
        account_id: 'acct_1',
        organization_id: 'org_1',
        is_active: true,
        slug: 'tc-team',
    });
    getAccountByIdMock.mockResolvedValue({ id: 'acct_1', role: 'user' });
    getDefaultBrandProfileMock.mockResolvedValue({
        name: 'Precision Leverage Solutions',
        contact_email: 'private@example.com',
    });
});

describe('getSenderBrandName', () => {
    it('resolves the default brand name for an active intake link', async () => {
        await expect(getSenderBrandName('tc-team')).resolves.toBe('Precision Leverage Solutions');
        expect(getDefaultBrandProfileMock).toHaveBeenCalledWith('acct_1', 'org_1');
    });

    it('ignores malformed codes without a lookup', async () => {
        await expect(getSenderBrandName('../unsafe')).resolves.toBeNull();
        await expect(getSenderBrandName(null)).resolves.toBeNull();
        expect(getIntakeLinkBySlugMock).not.toHaveBeenCalled();
    });

    it('does not resolve inactive links', async () => {
        getIntakeLinkBySlugMock.mockResolvedValue({ account_id: 'acct_1', is_active: false, slug: 'tc-team' });

        await expect(getSenderBrandName('tc-team')).resolves.toBeNull();
        expect(getDefaultBrandProfileMock).not.toHaveBeenCalled();
    });

    it('does not resolve banned accounts', async () => {
        getAccountByIdMock.mockResolvedValue({ id: 'acct_1', role: 'banned' });

        await expect(getSenderBrandName('tc-team')).resolves.toBeNull();
        expect(getDefaultBrandProfileMock).not.toHaveBeenCalled();
    });

    it('returns null when the lookup throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        getIntakeLinkBySlugMock.mockRejectedValue(new Error('db down'));

        await expect(getSenderBrandName('tc-team')).resolves.toBeNull();
    });
});

describe('GET /api/growth/sender-brand', () => {
    it('returns only the brand name, uncached', async () => {
        const response = await lookup('tc-team');

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toEqual({ brandName: 'Precision Leverage Solutions' });
    });

    it('answers null for codes that do not resolve', async () => {
        getIntakeLinkBySlugMock.mockResolvedValue(null);

        const response = await lookup('nobody');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ brandName: null });
    });

    it('rate limits before any lookup', async () => {
        checkRateLimitMock.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 0, reason: 'limited' });

        const response = await lookup('tc-team');

        expect(response.status).toBe(429);
        expect(getIntakeLinkBySlugMock).not.toHaveBeenCalled();
    });
});
