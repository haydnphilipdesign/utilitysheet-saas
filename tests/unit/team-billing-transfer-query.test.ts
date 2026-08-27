import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({ sql: sqlMock }));

import { transferAccountSubscriptionToOrganization } from '@/lib/neon/queries/organizations';

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
        expect(queryText).toContain('row_to_json');
    });

    it('returns null when the account/organization ownership state is not eligible', async () => {
        sqlMock.mockResolvedValueOnce([]);

        await expect(transferAccountSubscriptionToOrganization({
            accountId: 'acct_1',
            organizationId: 'org_1',
            stripeCustomerId: 'cus_1',
            subscriptionId: 'sub_1',
            subscriptionEndsAt: null,
            seatQuantity: 3,
        })).resolves.toBeNull();
    });
});
