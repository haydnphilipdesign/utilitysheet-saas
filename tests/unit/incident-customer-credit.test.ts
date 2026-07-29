import { describe, expect, it, vi } from 'vitest';
import {
    INCIDENT_ID,
    applyCustomerCreditPlan,
    assertCustomerCreditApplyAuthorized,
    buildCustomerCreditPlan,
    buildIncidentIdempotencyKey,
    hasIncidentCredit,
    monthlySubscriptionAmount,
    summarizeCustomerCreditPlan,
} from '@/scripts/incident/customer-credit-core.mjs';

function subscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub_pro',
        status: 'active',
        items: {
            data: [{
                quantity: 1,
                price: {
                    unit_amount: 900,
                    currency: 'usd',
                    recurring: { interval: 'month', interval_count: 1 },
                },
            }],
        },
        ...overrides,
    };
}

describe('incident customer credit core', () => {
    it('calculates one month for Pro and seat-based Team subscriptions', () => {
        expect(monthlySubscriptionAmount(subscription())).toBe(900);
        expect(monthlySubscriptionAmount(subscription({
            id: 'sub_team',
            items: {
                data: [{
                    quantity: 4,
                    price: {
                        unit_amount: 700,
                        currency: 'usd',
                        recurring: { interval: 'month', interval_count: 1 },
                    },
                }],
            },
        }))).toBe(2800);
    });

    it('rejects inactive, annual, non-USD, and unknown-price subscriptions', () => {
        expect(() => monthlySubscriptionAmount(subscription({ status: 'past_due' }))).toThrow();
        expect(() => monthlySubscriptionAmount(subscription({
            items: {
                data: [{
                    quantity: 1,
                    price: {
                        unit_amount: 900,
                        currency: 'usd',
                        recurring: { interval: 'year', interval_count: 1 },
                    },
                }],
            },
        }))).toThrow();
        expect(() => monthlySubscriptionAmount(subscription({
            items: {
                data: [{
                    quantity: 1,
                    price: {
                        unit_amount: 900,
                        currency: 'eur',
                        recurring: { interval: 'month', interval_count: 1 },
                    },
                }],
            },
        }))).toThrow();
        expect(() => monthlySubscriptionAmount(subscription({
            items: {
                data: [{
                    quantity: 1,
                    price: {
                        unit_amount: null,
                        currency: 'usd',
                        recurring: { interval: 'month', interval_count: 1 },
                    },
                }],
            },
        }))).toThrow();
    });

    it('detects incident metadata and creates a stable idempotency key', () => {
        expect(hasIncidentCredit([
            { metadata: { incident_id: INCIDENT_ID } },
        ])).toBe(true);
        expect(buildIncidentIdempotencyKey({
            incidentId: INCIDENT_ID,
            entityType: 'account',
            entityId: 'account_1',
        })).toBe('incident-credit-provider-resolution-2026-07-account-account_1');
    });
});

describe('incident customer credit orchestration', () => {
    function stripeMock(existing = false) {
        return {
            subscriptions: {
                retrieve: vi.fn()
                    .mockResolvedValueOnce(subscription())
                    .mockResolvedValueOnce(subscription({
                        id: 'sub_team',
                        items: {
                            data: [{
                                quantity: 4,
                                price: {
                                    unit_amount: 700,
                                    currency: 'usd',
                                    recurring: { interval: 'month', interval_count: 1 },
                                },
                            }],
                        },
                    })),
            },
            customers: {
                listBalanceTransactions: vi.fn().mockResolvedValue({
                    data: existing
                        ? [{ id: 'cbtxn_existing', metadata: { incident_id: INCIDENT_ID } }]
                        : [],
                    has_more: false,
                }),
                createBalanceTransaction: vi.fn()
                    .mockResolvedValueOnce({ id: 'cbtxn_pro' })
                    .mockResolvedValueOnce({ id: 'cbtxn_team' }),
            },
        };
    }

    const entities = [{
        entityType: 'account',
        entityId: 'account_1',
        stripeCustomerId: 'cus_pro',
        subscriptionId: 'sub_pro',
    }, {
        entityType: 'organization',
        entityId: 'organization_1',
        stripeCustomerId: 'cus_team',
        subscriptionId: 'sub_team',
    }];

    it('builds a PII-free plan and applies negative credits with stable metadata', async () => {
        const stripe = stripeMock();
        const plan = await buildCustomerCreditPlan({ stripe, entities });
        const summary = summarizeCustomerCreditPlan(plan);

        expect(summary).toEqual({
            eligible: 2,
            alreadyApplied: 0,
            pending: 2,
            totalEligibleCents: 3700,
            totalPendingCents: 3700,
        });
        expect(() => assertCustomerCreditApplyAuthorized({
            apply: true,
            confirm: INCIDENT_ID,
            expectedCount: 2,
            expectedTotalCents: 3700,
            summary,
        })).not.toThrow();

        await expect(applyCustomerCreditPlan({ stripe, plan })).resolves.toEqual([
            'cbtxn_pro',
            'cbtxn_team',
        ]);
        expect(stripe.customers.createBalanceTransaction).toHaveBeenNthCalledWith(
            1,
            'cus_pro',
            expect.objectContaining({
                amount: -900,
                metadata: expect.objectContaining({
                    incident_id: INCIDENT_ID,
                    entity_type: 'account',
                    entity_id: 'account_1',
                }),
            }),
            {
                idempotencyKey: 'incident-credit-provider-resolution-2026-07-account-account_1',
            }
        );
    });

    it('skips entities with an existing incident credit', async () => {
        const stripe = stripeMock(true);
        const plan = await buildCustomerCreditPlan({ stripe, entities });

        expect(summarizeCustomerCreditPlan(plan).alreadyApplied).toBe(2);
        await expect(applyCustomerCreditPlan({ stripe, plan })).resolves.toEqual([]);
        expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
    });

    it('requires exact confirmation, live count, and live total before apply', () => {
        const summary = {
            eligible: 7,
            alreadyApplied: 0,
            pending: 7,
            totalEligibleCents: 8200,
            totalPendingCents: 8200,
        };
        expect(() => assertCustomerCreditApplyAuthorized({
            apply: false,
            confirm: null,
            expectedCount: null,
            expectedTotalCents: null,
            summary,
        })).not.toThrow();
        expect(() => assertCustomerCreditApplyAuthorized({
            apply: true,
            confirm: 'wrong',
            expectedCount: 7,
            expectedTotalCents: 8200,
            summary,
        })).toThrow(/--confirm/);
        expect(() => assertCustomerCreditApplyAuthorized({
            apply: true,
            confirm: INCIDENT_ID,
            expectedCount: 6,
            expectedTotalCents: 8200,
            summary,
        })).toThrow(/live count/);
        expect(() => assertCustomerCreditApplyAuthorized({
            apply: true,
            confirm: INCIDENT_ID,
            expectedCount: 7,
            expectedTotalCents: 8100,
            summary,
        })).toThrow(/live total/);
    });
});
