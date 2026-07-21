import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getContext: vi.fn(),
    getReadiness: vi.fn(),
    recordEvent: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/account/security', () => ({
    getAccountSecurityContext: mocks.getContext,
    accountSecurityErrorResponse: () => null,
}));
vi.mock('@/lib/neon/queries', () => ({
    getAccountClosureReadiness: mocks.getReadiness,
    recordAccountSecurityEvent: mocks.recordEvent,
}));

import { GET } from '@/app/api/account/closure-readiness/route';

describe('/api/account/closure-readiness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getContext.mockResolvedValue({
            user: { primaryEmail: 'owner@example.com' },
            account: { id: 'acct_1' },
        });
        mocks.recordEvent.mockResolvedValue(true);
    });

    it('reports billing, sole-admin, shared-asset, and referral blockers without exposing a destructive action', async () => {
        mocks.getReadiness.mockResolvedValue({
            personalSubscription: { subscription_status: 'pro', subscription_id: 'sub_personal' },
            workspaces: [{
                id: 'org_1',
                name: 'Acme Team',
                role: 'admin',
                subscription_status: 'team',
                subscription_id: 'sub_team',
                member_count: 2,
                admin_count: 1,
                owned_profile_count: 1,
                owned_request_count: 2,
            }],
            assets: { request_count: 2, profile_count: 1, seller_form_count: 1 },
            pendingInvitationsAddressedToEmail: 0,
            referralRecords: { unapplied_earned_count: 1 },
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.executableClosureAvailable).toBe(false);
        expect(body.readyForFutureClosure).toBe(false);
        expect(body.blockers).toHaveLength(4);
        expect(JSON.stringify(body)).not.toContain('deleteAccount');
    });
});
