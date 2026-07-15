import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlTagMock = vi.hoisted(() => vi.fn());
const sqlTransactionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: Object.assign(sqlTagMock, {
        transaction: sqlTransactionMock,
    }),
}));

import {
    awardReferralCreditForActivation,
    getEarnedReferralCredits,
    getReferralCreditsForAccount,
    getValidReferralReferrerAccountId,
    markReferralCreditApplied,
} from '@/lib/neon/queries/referral-credits';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

function expectCandidateIdentityAndActivation(queryText: string): void {
    expect(queryText).toContain('FROM growth_attributions ga');
    expect(queryText).toContain('JOIN intake_links il ON ga.referral_code = il.slug');
    expect(queryText).toContain('WHERE ga.account_id = ');
    expect(queryText).toContain('il.account_id <> ga.account_id');
    expect(queryText).toContain("status = 'submitted'");
    expect(queryText).toContain('deleted_at IS NULL');
    expect(queryText).toContain('COALESCE(is_demo, FALSE) = FALSE');
    expect(queryText).toContain('= 1');
    expect(queryText).toContain("NOW() - INTERVAL '365 days'");
    expect(queryText).toContain('< 12');
    expect(queryText).not.toContain('existing_credit.status');
}

const awardedCredit = {
    id: 'credit_1',
    referrer_account_id: 'account_referrer',
    referred_account_id: 'account_referred',
    amount_cents: 900,
    status: 'earned' as const,
    stripe_balance_transaction_id: null,
    earned_at: '2026-07-15T12:00:00.000Z',
    applied_at: null,
    referrer_stripe_customer_id: 'cus_referrer',
    referrer_subscription_id: 'sub_referrer',
    referrer_subscription_status: 'pro',
};

describe('referral credit queries', () => {
    beforeEach(() => {
        sqlTagMock.mockReset();
        sqlTransactionMock.mockReset();
        sqlTagMock.mockResolvedValue([]);
        sqlTransactionMock.mockResolvedValue([[], []]);
    });

    it('awards through a locked two-statement transaction with every eligibility guardrail', async () => {
        sqlTransactionMock.mockResolvedValue([[], [awardedCredit]]);

        const result = await awardReferralCreditForActivation('account_referred');

        expect(sqlTagMock).toHaveBeenCalledTimes(2);
        expect(sqlTransactionMock).toHaveBeenCalledTimes(1);
        expect(sqlTransactionMock.mock.calls[0][0]).toHaveLength(2);

        const lockSql = callSqlText(sqlTagMock.mock.calls[0]);
        const insertSql = callSqlText(sqlTagMock.mock.calls[1]);

        expectCandidateIdentityAndActivation(lockSql);
        expectCandidateIdentityAndActivation(insertSql);
        expect(lockSql).toContain('FOR UPDATE OF referrer, il');
        expect(insertSql).toContain('ON CONFLICT (referred_account_id) DO NOTHING');
        expect(result).toEqual(awardedCredit);
    });

    it.each([
        ['invalid', [[], []]],
        ['duplicate', [[{ id: 'account_referrer' }], []]],
        ['capped', [[], []]],
        ['self', [[], []]],
    ])(
        'returns null when the %s candidate produces no inserted credit',
        async (_candidate, transactionResult) => {
            sqlTransactionMock.mockResolvedValue(transactionResult);

            await expect(awardReferralCreditForActivation('account_referred')).resolves.toBeNull();
        }
    );

    it('looks up a referral through the intake slug and rejects self-referrals', async () => {
        sqlTagMock.mockResolvedValue([{ referrer_account_id: 'account_referrer' }]);

        await expect(getValidReferralReferrerAccountId('account_referred')).resolves.toBe('account_referrer');

        const queryText = callSqlText(sqlTagMock.mock.calls[0]);
        expect(queryText).toContain('ga.referral_code = il.slug');
        expect(queryText).toContain('il.account_id <> ga.account_id');
    });

    it('lists account credits and earned credits with stable earned-at ordering', async () => {
        sqlTagMock.mockResolvedValue([awardedCredit]);

        await expect(getReferralCreditsForAccount('account_referrer')).resolves.toEqual([awardedCredit]);
        await expect(getEarnedReferralCredits('account_referrer')).resolves.toEqual([awardedCredit]);

        const allSql = callSqlText(sqlTagMock.mock.calls[0]);
        const earnedSql = callSqlText(sqlTagMock.mock.calls[1]);
        expect(allSql).toContain('ORDER BY earned_at DESC, id DESC');
        expect(earnedSql).toContain("status = 'earned'");
        expect(earnedSql).toContain('ORDER BY earned_at DESC, id DESC');
    });

    it('marks only an earned credit as applied and returns the updated row', async () => {
        sqlTagMock.mockResolvedValue([{ ...awardedCredit, status: 'applied' }]);

        const result = await markReferralCreditApplied('credit_1', 'txn_1');

        const queryText = callSqlText(sqlTagMock.mock.calls[0]);
        expect(queryText).toContain("WHERE id = ");
        expect(queryText).toContain("AND status = 'earned'");
        expect(queryText).toContain('stripe_balance_transaction_id = ');
        expect(queryText).toContain('applied_at = NOW()');
        expect(result?.status).toBe('applied');
    });
});
