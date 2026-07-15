import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

const referralCreditsTable = normalizeSql(`
    CREATE TABLE IF NOT EXISTS referral_credits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        referrer_account_id UUID NOT NULL REFERENCES accounts(id),
        referred_account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
        amount_cents INT NOT NULL DEFAULT 900,
        status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'applied')),
        stripe_balance_transaction_id TEXT,
        earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_at TIMESTAMPTZ
    );
`);

const referralCreditsIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer_account_id ON referral_credits(referrer_account_id);',
    "CREATE INDEX IF NOT EXISTS idx_referral_credits_earned ON referral_credits(referrer_account_id, earned_at) WHERE status = 'earned';",
];

describe('referral credit ledger SQL', () => {
    it.each(['migrations-referral-credits.sql', 'schema.sql'])(
        '%s contains the referral credit ledger table and indexes',
        async (filePath) => {
            const sql = normalizeSql(await readFile(filePath, 'utf8'));

            expect(sql).toContain(referralCreditsTable);
            for (const indexDefinition of referralCreditsIndexes) {
                expect(sql).toContain(indexDefinition);
            }
        },
    );
});
