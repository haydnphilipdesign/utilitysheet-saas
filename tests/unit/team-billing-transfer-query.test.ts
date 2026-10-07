import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({ sql: sqlMock }));

import { transferAccountSubscriptionToOrganization, updateOrganizationSubscription } from '@/lib/neon/queries/organizations';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

describe('transferAccountSubscriptionToOrganization', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('atomically moves matching billing identifiers from account to organization', async () => {
        sqlMock.mockResolvedValueOnce([{
            account: { id: 'acct_1', subscription_status: 'free' },
            organization: { id: 'org_1', subscription_status: 'team' },
        }]);

        const result = await transferAccountSubscriptionToOrganization({
            accountId: 'acct_1',
            organizationId: 'org_1',
            stripeCustomerId: 'cus_1',
            subscriptionId: 'sub_1',
            subscriptionEndsAt: new Date('2030-03-17T17:46:40.000Z'),
            subscriptionCancelAt: new Date('2030-03-17T17:46:40.000Z'),
            seatQuantity: 5,
        });

        expect(result).toEqual({
            account: { id: 'acct_1', subscription_status: 'free' },
            organization: { id: 'org_1', subscription_status: 'team' },
        });
        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('FOR UPDATE');
        expect(queryText).toContain('updated_organization');
        expect(queryText).toContain("subscription_status = 'team'");
        expect(queryText).toContain('updated_account');
        expect(queryText).toContain("subscription_status = 'free'");
        expect(queryText).toContain('stripe_customer_id = NULL');
        expect(queryText).toContain('subscription_id = NULL');
        // The cancellation date moves with the plan: set on the workspace, cleared on the account.
        expect(queryText).toContain('subscription_cancel_at = NULL');
        expect(queryText).toContain('subscription_trial_ends_at = NULL');
        expect(sqlMock.mock.calls[0].filter((value) => value === '2030-03-17T17:46:40.000Z')).toHaveLength(2);
        expect(queryText).toContain('row_to_json');
        // A workspace that comes back on Teams no longer says its plan stopped.
        expect(queryText).toContain('subscription_lapse_reason = NULL');
        expect(queryText).toContain('subscription_lapsed_at = NULL');
    });

    it('returns null when the account/organization ownership state is not eligible', async () => {
        sqlMock.mockResolvedValueOnce([]);

        await expect(transferAccountSubscriptionToOrganization({
            accountId: 'acct_1',
            organizationId: 'org_1',
            stripeCustomerId: 'cus_1',
            subscriptionId: 'sub_1',
            subscriptionEndsAt: null,
            subscriptionCancelAt: null,
            seatQuantity: 3,
        })).resolves.toBeNull();
    });
});

describe('updateOrganizationSubscription plan lapse', () => {
    beforeEach(() => {
        sqlMock.mockReset();
        sqlMock.mockResolvedValue([{ id: 'org_1' }]);
    });

    const base = { subscriptionId: null, subscriptionEndsAt: null, subscriptionCancelAt: null, seatQuantity: 0 };

    it('keeps a reason only for a workspace that was on Teams or already has one, and dates it once', async () => {
        await updateOrganizationSubscription('org_1', { ...base, subscriptionStatus: 'free', lapseReason: 'payment_failed' });

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain("(subscription_status = 'team' OR subscription_lapse_reason IS NOT NULL)");
        expect(queryText).toContain('ELSE subscription_lapse_reason');
        // The date is set when Teams stops, not moved by later events about the same lapse.
        expect(queryText).toMatch(/::text IS NOT NULL AND subscription_status = 'team' THEN NOW\(\)\s+ELSE subscription_lapsed_at/);
        expect(sqlMock.mock.calls[0].filter((value) => value === 'payment_failed')).toHaveLength(3);
    });

    it('clears the reason and date when Teams is active, and passes no reason by default', async () => {
        await updateOrganizationSubscription('org_1', { ...base, subscriptionId: 'sub_1', subscriptionStatus: 'team', seatQuantity: 4 });

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText.match(/= 'team' THEN NULL/g)).toHaveLength(2);
        expect(sqlMock.mock.calls[0].slice(1)).not.toContain('payment_failed');
        expect(sqlMock.mock.calls[0].slice(1).filter((value) => value === null).length).toBeGreaterThanOrEqual(3);
    });
});
