import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const requiredReferralCreditSql = [
    'CREATE TABLE IF NOT EXISTS referral_credits',
    'referred_account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE',
    "CHECK (status IN ('earned', 'applied'))",
    'stripe_balance_transaction_id TEXT',
    'idx_referral_credits_referrer_account_id',
    'idx_referral_credits_earned',
];

describe('referral credit ledger SQL', () => {
    it.each(['migrations-referral-credits.sql', 'schema.sql'])(
        '%s contains the referral credit ledger table and indexes',
        async (filePath) => {
            const sql = await readFile(filePath, 'utf8');

            for (const requiredSql of requiredReferralCreditSql) {
                expect(sql).toContain(requiredSql);
            }
        },
    );
});
