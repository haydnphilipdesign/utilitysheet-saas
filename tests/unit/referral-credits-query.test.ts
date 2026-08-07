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
    claimReferralCodeForAccount,
    getEarnedReferralCredits,
    getReferralClaimState,
    getReferralCreditCountsForAccount,
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
    expect(queryText).toContain('>= 1');
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

    it('reports whether a post-signup referral code can still be claimed', async () => {
        sqlTagMock
            .mockResolvedValueOnce([{
                referral_code: null,
                within_claim_window: true,
            }])
            .mockResolvedValueOnce([{
                referral_code: 'friend-code',
                within_claim_window: false,
            }])
            .mockResolvedValueOnce([{
                referral_code: null,
                within_claim_window: false,
            }]);

        await expect(getReferralClaimState('account_new')).resolves.toEqual({
            code: null,
            canClaim: true,
            status: 'available',
        });
        await expect(getReferralClaimState('account_claimed')).resolves.toEqual({
            code: 'friend-code',
            canClaim: false,
            status: 'claimed',
        });
        await expect(getReferralClaimState('account_old')).resolves.toEqual({
            code: null,
            canClaim: false,
            status: 'expired',
        });

        expect(callSqlText(sqlTagMock.mock.calls[0])).toContain("INTERVAL '30 days'");
    });

    it('claims a valid non-self code once while preserving existing first-touch fields', async () => {
        sqlTagMock.mockResolvedValue([{ status: 'claimed', referral_code: 'friend-code' }]);

        await expect(
            claimReferralCodeForAccount('account_referred', 'friend-code')
        ).resolves.toEqual({ code: 'friend-code', status: 'claimed' });

        const queryText = callSqlText(sqlTagMock.mock.calls[0]);
        expect(queryText).toContain("INTERVAL '30 days'");
        expect(queryText).toContain('JOIN account_state state ON il.account_id <> state.id');
        expect(queryText).toContain('FOR UPDATE OF a');
        expect(queryText).toContain('ON CONFLICT (account_id) DO UPDATE');
        expect(queryText).toContain('SET referral_code = EXCLUDED.referral_code');
        expect(queryText).toContain('WHERE growth_attributions.referral_code IS NULL');
        expect(sqlTagMock.mock.calls[0].slice(1)).toEqual(['account_referred', 'friend-code']);
    });

    it.each(['invalid_code', 'already_claimed', 'expired'] as const)(
        'returns the %s claim outcome without inventing a code',
        async (status) => {
            sqlTagMock.mockResolvedValue([{ status, referral_code: null }]);

            await expect(
                claimReferralCodeForAccount('account_referred', 'friend-code')
            ).resolves.toEqual({ code: null, status });
        }
    );

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

    it('returns constant-size earned and applied counts for an account', async () => {
        sqlTagMock.mockResolvedValue([{ earned: 2, applied: 1 }]);

        await expect(getReferralCreditCountsForAccount('account_referrer')).resolves.toEqual({
            earned: 2,
            applied: 1,
        });

        const queryText = callSqlText(sqlTagMock.mock.calls[0]);
        expect(queryText).toContain("COUNT(*) FILTER (WHERE status = 'earned')");
        expect(queryText).toContain("COUNT(*) FILTER (WHERE status = 'applied')");
        expect(queryText).toContain('WHERE referrer_account_id = ');
        expect(queryText).not.toContain('SELECT *');
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
