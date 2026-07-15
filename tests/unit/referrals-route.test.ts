import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser, ensureAccountActivation, getOrCreateIntakeLink, getReferralCreditsForAccount } = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    getOrCreateIntakeLink: vi.fn(),
    getReferralCreditsForAccount: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation }));
vi.mock('@/lib/neon/queries', () => ({ getOrCreateIntakeLink, getReferralCreditsForAccount }));

import { GET } from '@/app/api/referrals/route';

describe('GET /api/referrals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: 'agent@example.com' });
        ensureAccountActivation.mockResolvedValue({ account: { id: 'account_1' } });
        getOrCreateIntakeLink.mockResolvedValue({ slug: 'referrer-slug' });
        getReferralCreditsForAccount.mockResolvedValue([]);
    });

    it('rejects anonymous requests', async () => {
        getUser.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
        expect(ensureAccountActivation).not.toHaveBeenCalled();
    });

    it('returns the exact referral link and current credit counts', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://utilitysheet.com/base/path');
        getReferralCreditsForAccount.mockResolvedValue([
            { id: 'credit_1', status: 'earned' },
            { id: 'credit_2', status: 'applied' },
            { id: 'credit_3', status: 'earned' },
        ]);

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            referralLink: 'https://utilitysheet.com/auth/signup?ref=referrer-slug',
            counts: { earned: 2, applied: 1 },
        });
        expect(ensureAccountActivation).toHaveBeenCalledWith({
            id: 'auth_1',
            primaryEmail: 'agent@example.com',
        });
        expect(getOrCreateIntakeLink).toHaveBeenCalledWith('account_1');
        expect(getReferralCreditsForAccount).toHaveBeenCalledWith('account_1');
    });

    it('returns 404 when activation produces no account state', async () => {
        ensureAccountActivation.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'Account not found' });
        expect(getOrCreateIntakeLink).not.toHaveBeenCalled();
    });

    it('returns 500 when no intake link can be loaded', async () => {
        getOrCreateIntakeLink.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Failed to load referral link' });
        expect(getReferralCreditsForAccount).not.toHaveBeenCalled();
    });

    it('falls back to the Vercel URL when no public app URL is configured', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', 'preview.example.com');

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            referralLink: 'https://preview.example.com/auth/signup?ref=referrer-slug',
            counts: { earned: 0, applied: 0 },
        });
    });

    it('catches and logs query failures', async () => {
        getReferralCreditsForAccount.mockRejectedValue(new Error('database unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const response = await GET();

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Internal server error' });
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
