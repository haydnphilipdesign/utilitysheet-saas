import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { toActivationFunnelStats, toGrowthSourceStats, toReferralLoopStats } from '@/lib/admin/activation-funnel';

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
            first_live_submission: 22,
            habitual_accounts: 9,
            paid_accounts: 7,
            first_live_submission_last_7d: 4,
        });

        expect(stats.totalAccounts).toBe(116);
        expect(stats.dashboardReady).toBe(96);
        expect(stats.onboardingCompleted).toBe(63);
        expect(stats.hasRequest).toBe(34);
        expect(stats.sellerLinkReady).toBe(69);
        expect(stats.noOnboardingNoRequest).toBe(48);
        expect(stats.missingDefaults).toBe(20);
        expect(stats.firstLiveSubmission).toBe(22);
        expect(stats.habitualAccounts).toBe(9);
        expect(stats.paidAccounts).toBe(7);
        expect(stats.firstLiveSubmissionLast7d).toBe(4);
        expect(stats.dashboardReadyRate).toBe(83);
        expect(stats.onboardingCompletionRate).toBe(54);
        expect(stats.firstRequestRate).toBe(29);
        expect(stats.inactiveRate).toBe(41);
        expect(stats.signupToActivationRate).toBe(19);
        expect(stats.activationToHabitRate).toBe(41);
    });

    it('handles empty funnels without dividing by zero', () => {
        const stats = toActivationFunnelStats({});

        expect(stats.totalAccounts).toBe(0);
        expect(stats.dashboardReadyRate).toBe(0);
        expect(stats.onboardingCompletionRate).toBe(0);
        expect(stats.firstRequestRate).toBe(0);
        expect(stats.inactiveRate).toBe(0);
        expect(stats.signupToActivationRate).toBe(0);
        expect(stats.activationToHabitRate).toBe(0);
    });

    it('maps acquisition sources and their activation rates', () => {
        expect(toGrowthSourceStats([
            { source: 'facebook', signups: 20, activated: 8 },
            { source: null, signups: 5, activated: 1 },
        ])).toEqual([
            { source: 'facebook', signups: 20, activated: 8, activationRate: 40 },
            { source: 'unknown', signups: 5, activated: 1, activationRate: 20 },
        ]);
    });

    it('computes referral loop conversion rates stage by stage', () => {
        expect(toReferralLoopStats({
            impressions: 500,
            clicks: 12,
            signups: 3,
            activated: 1,
        })).toEqual({
            impressions: 500,
            clicks: 12,
            signups: 3,
            activated: 1,
            clickRate: 2,
            signupRate: 25,
            activationRate: 33,
        });
    });

    it('handles an empty referral loop without dividing by zero', () => {
        expect(toReferralLoopStats({})).toEqual({
            impressions: 0,
            clicks: 0,
            signups: 0,
            activated: 0,
            clickRate: 0,
            signupRate: 0,
            activationRate: 0,
        });
    });
});
