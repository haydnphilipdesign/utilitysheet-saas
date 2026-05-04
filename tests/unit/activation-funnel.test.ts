import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { toActivationFunnelStats } from '@/lib/admin/activation-funnel';

describe('activation funnel summary', () => {
    it('computes conversion counts and rates from aggregate rows', () => {
        const stats = toActivationFunnelStats({
            total_accounts: 116,
            onboarding_completed: 63,
            dashboard_ready: 96,
            has_request: 34,
            seller_link_ready: 69,
            no_onboarding_no_request: 48,
            missing_defaults: 20,
        });

        expect(stats.totalAccounts).toBe(116);
        expect(stats.dashboardReady).toBe(96);
        expect(stats.onboardingCompleted).toBe(63);
        expect(stats.hasRequest).toBe(34);
        expect(stats.sellerLinkReady).toBe(69);
        expect(stats.noOnboardingNoRequest).toBe(48);
        expect(stats.missingDefaults).toBe(20);
        expect(stats.dashboardReadyRate).toBe(83);
        expect(stats.onboardingCompletionRate).toBe(54);
        expect(stats.firstRequestRate).toBe(29);
        expect(stats.inactiveRate).toBe(41);
    });

    it('handles empty funnels without dividing by zero', () => {
        const stats = toActivationFunnelStats({});

        expect(stats.totalAccounts).toBe(0);
        expect(stats.dashboardReadyRate).toBe(0);
        expect(stats.onboardingCompletionRate).toBe(0);
        expect(stats.firstRequestRate).toBe(0);
        expect(stats.inactiveRate).toBe(0);
    });
});
