import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser, ensureAccountActivation, saveAttribution } = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    saveAttribution: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation }));
vi.mock('@/lib/neon/queries', () => ({ saveFirstTouchGrowthAttribution: saveAttribution }));

import { POST } from '@/app/api/growth/attribution/route';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/growth/attribution', () => {
    it('rejects anonymous requests', async () => {
        getUser.mockResolvedValue(null);
        const response = await POST(new Request('http://localhost/api/growth/attribution', {
            method: 'POST',
            body: JSON.stringify({ source: 'facebook', landingPath: '/' }),
        }));

        expect(response.status).toBe(401);
    });

    it('rejects invalid referral codes', async () => {
        getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: 'tc@example.com' });
        const response = await POST(new Request('http://localhost/api/growth/attribution', {
            method: 'POST',
            body: JSON.stringify({
                source: 'facebook',
                medium: null,
                campaign: null,
                content: null,
                referralCode: '../unsafe',
                landingPath: '/',
            }),
        }));

        expect(response.status).toBe(400);
        expect(ensureAccountActivation).not.toHaveBeenCalled();
    });

    it('persists validated first-touch data for the activated account', async () => {
        getUser.mockResolvedValue({ id: 'auth_1', primaryEmail: 'tc@example.com' });
        ensureAccountActivation.mockResolvedValue({ account: { id: 'acct_1' } });
        const body = {
            source: 'facebook',
            medium: 'social',
            campaign: 'handoff-kit',
            content: null,
            referralCode: 'tc-team',
            landingPath: '/auth/signup',
        };
        const response = await POST(new Request('http://localhost/api/growth/attribution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }));

        expect(response.status).toBe(204);
        expect(saveAttribution).toHaveBeenCalledWith('acct_1', body);
    });
});
