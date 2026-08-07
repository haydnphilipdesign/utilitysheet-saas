import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
    claimReferralCodeForAccount,
    ensureAccountActivation,
    getIntakeLinkByAccountId,
    getReferralClaimState,
    getReferralCreditCountsForAccount,
    getUser,
    scheduleReferralCreditAward,
} = vi.hoisted(() => ({
    claimReferralCodeForAccount: vi.fn(),
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    getIntakeLinkByAccountId: vi.fn(),
    getReferralClaimState: vi.fn(),
    getReferralCreditCountsForAccount: vi.fn(),
    scheduleReferralCreditAward: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation }));
vi.mock('@/lib/neon/queries', () => ({
    claimReferralCodeForAccount,
    getIntakeLinkByAccountId,
    getReferralClaimState,
    getReferralCreditCountsForAccount,
}));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward }));

import { GET, POST } from '@/app/api/referrals/route';

function claimRequest(code: unknown) {
    return new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
}

describe('/api/referrals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: 'agent@example.com' });
        ensureAccountActivation.mockResolvedValue({ account: { id: 'account_1' } });
        getIntakeLinkByAccountId.mockResolvedValue({ slug: 'referrer-slug' });
        getReferralCreditCountsForAccount.mockResolvedValue({ earned: 0, applied: 0 });
        getReferralClaimState.mockResolvedValue({ code: null, canClaim: true, status: 'available' });
        claimReferralCodeForAccount.mockResolvedValue({ code: 'friend-code', status: 'claimed' });
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
        ensureAccountActivation.mockResolvedValue({ account: { id: 'account_1', subscription_id: 'sub_123' } });
        getReferralCreditCountsForAccount.mockResolvedValue({ earned: 2, applied: 1 });

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            referralLink: 'https://utilitysheet.com/auth/signup?ref=referrer-slug',
            counts: { earned: 2, applied: 1 },
            isSubscribed: true,
            referralAttribution: { code: null, canClaim: true, status: 'available' },
        });
        expect(ensureAccountActivation).toHaveBeenCalledWith({
            id: 'auth_1',
            primaryEmail: 'agent@example.com',
        });
        expect(getIntakeLinkByAccountId).toHaveBeenCalledWith('account_1');
        expect(getReferralCreditCountsForAccount).toHaveBeenCalledWith('account_1');
    });

    it('returns 404 when activation produces no account state', async () => {
        ensureAccountActivation.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'Account not found' });
        expect(getIntakeLinkByAccountId).not.toHaveBeenCalled();
    });

    it('returns 500 when no intake link can be loaded', async () => {
        getIntakeLinkByAccountId.mockResolvedValue(null);

        const response = await GET();

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Failed to load referral link' });
        expect(getReferralCreditCountsForAccount).not.toHaveBeenCalled();
    });

    it('falls back to the Vercel URL when no public app URL is configured', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
        vi.stubEnv('VERCEL_URL', 'preview.example.com');

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            referralLink: 'https://preview.example.com/auth/signup?ref=referrer-slug',
            counts: { earned: 0, applied: 0 },
            isSubscribed: false,
            referralAttribution: { code: null, canClaim: true, status: 'available' },
        });
    });

    it('catches and logs query failures', async () => {
        getReferralCreditCountsForAccount.mockRejectedValue(new Error('database unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const response = await GET();

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Internal server error' });
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('claims a normalized referral code and schedules a retroactive award check', async () => {
        const response = await POST(claimRequest('  FRIEND-CODE  '));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            referralAttribution: { code: 'friend-code', canClaim: false, status: 'claimed' },
        });
        expect(claimReferralCodeForAccount).toHaveBeenCalledWith('account_1', 'friend-code');
        expect(scheduleReferralCreditAward).toHaveBeenCalledWith('account_1');
    });

    it('rejects anonymous and malformed claim requests before touching account data', async () => {
        getUser.mockResolvedValueOnce(null);
        const anonymousResponse = await POST(claimRequest('friend-code'));
        const invalidResponse = await POST(claimRequest('../unsafe'));

        expect(anonymousResponse.status).toBe(401);
        expect(invalidResponse.status).toBe(400);
        expect(claimReferralCodeForAccount).not.toHaveBeenCalled();
    });

    it.each([
        ['invalid_code', 400, 'Referral code not found. Check the code and try again.'],
        ['already_claimed', 409, 'A referral code is already attached to this account.'],
        ['expired', 409, 'Referral codes can be added within 30 days of signup.'],
        ['unavailable', 503, 'Referral codes are temporarily unavailable.'],
    ])('maps a %s claim result to a safe API error', async (status, expectedStatus, error) => {
        claimReferralCodeForAccount.mockResolvedValue({ code: null, status });

        const response = await POST(claimRequest('friend-code'));

        expect(response.status).toBe(expectedStatus);
        await expect(response.json()).resolves.toEqual({ error });
        expect(scheduleReferralCreditAward).not.toHaveBeenCalled();
    });
});
