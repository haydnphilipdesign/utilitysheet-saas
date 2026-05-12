import { describe, expect, it } from 'vitest';
import {
    buildCandidateReasons,
    calculateTestimonialCandidateScore,
    isLikelyInternalOrTestAccount,
    type TestimonialCandidateScoringInput,
} from '@/lib/admin/testimonial-candidates';

function candidate(overrides: Partial<TestimonialCandidateScoringInput> = {}): TestimonialCandidateScoringInput {
    return {
        effectivePlan: 'pro',
        totalRequests: 12,
        requestsLast30Days: 4,
        requestsLast90Days: 9,
        activeMonthsLast6: 3,
        uniqueProperties: 10,
        hasCompletedOnboarding: true,
        hasBrandProfile: true,
        hasIntakeLink: true,
        role: 'user',
        email: 'agent@example-realestate.com',
        fullName: 'Avery Agent',
        companyName: 'Example Realty',
        lastActivityAt: '2026-05-10T12:00:00.000Z',
        ...overrides,
    };
}

describe('testimonial candidate scoring', () => {
    it('prioritizes team customers above comparable pro customers', () => {
        const proScore = calculateTestimonialCandidateScore(candidate({ effectivePlan: 'pro' }));
        const teamScore = calculateTestimonialCandidateScore(candidate({ effectivePlan: 'team' }));

        expect(teamScore).toBeGreaterThan(proScore);
    });

    it('rewards request volume, recent usage, consistency, unique properties, and setup completion', () => {
        const strong = calculateTestimonialCandidateScore(candidate());
        const weak = calculateTestimonialCandidateScore(candidate({
            totalRequests: 1,
            requestsLast30Days: 0,
            requestsLast90Days: 0,
            activeMonthsLast6: 1,
            uniqueProperties: 1,
            hasCompletedOnboarding: false,
            hasBrandProfile: false,
            hasIntakeLink: false,
            lastActivityAt: null,
        }));

        expect(strong).toBeGreaterThan(weak);
        expect(strong).toBeLessThanOrEqual(100);
    });

    it('identifies obvious internal, demo, banned, and test accounts', () => {
        expect(isLikelyInternalOrTestAccount(candidate({ role: 'admin' }))).toBe(true);
        expect(isLikelyInternalOrTestAccount(candidate({ role: 'banned' }))).toBe(true);
        expect(isLikelyInternalOrTestAccount(candidate({ email: 'demo@example.com' }))).toBe(true);
        expect(isLikelyInternalOrTestAccount(candidate({ email: 'customer@gmail.com', fullName: 'Real Customer' }))).toBe(false);
    });

    it('explains why a strong candidate ranked highly', () => {
        const reasons = buildCandidateReasons(candidate({ effectivePlan: 'team' }));

        expect(reasons).toContain('Teams customer');
        expect(reasons).toContain('4 requests in the last 30 days');
        expect(reasons).toContain('Used across 3 of the last 6 months');
        expect(reasons).toContain('Branding/setup complete');
    });
});
