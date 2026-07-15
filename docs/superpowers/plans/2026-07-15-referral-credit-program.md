# Referral Credit Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver UtilitySheet's activation-based "Give a month of Pro, get a month of Pro" referral program with a one-time referred-user trial, an idempotent $9 referrer credit, and a settings sharing surface.

**Architecture:** PostgreSQL is the source of truth for award eligibility and the credit ledger. A shared server-only service applies ledger credits to Stripe with per-credit idempotency keys, while thin seller, checkout, webhook, API, and settings integrations call those focused units.

**Tech Stack:** Next.js 16 App Router, TypeScript, Neon Postgres via `@neondatabase/serverless`, Stripe Checkout/Billing, React 19, shadcn/ui, Vercel Analytics, Vitest, Testing Library.

---

## File Structure

- Create `migrations-referral-credits.sql`: deployable referral ledger migration.
- Modify `schema.sql`: mirror the ledger table and indexes.
- Create `lib/neon/queries/referral-credits.ts`: award, attribution, listing, and applied-state SQL.
- Modify `lib/neon/queries/index.ts`: export the new query API.
- Create `lib/referrals/referral-credit-service.ts`: idempotent Stripe balance application.
- Create `lib/referrals/referral-trial.ts`: non-self attribution plus Stripe-history qualification.
- Create `lib/referrals/award-referral-credit.ts`: seller-safe award/redemption orchestration.
- Modify `app/api/seller/[token]/route.ts`: invoke the safe orchestrator after submission persistence.
- Modify `app/api/billing/checkout/route.ts`: conditionally add trial Checkout parameters.
- Modify `app/api/billing/webhook/route.ts`: redeem all earned credits after account checkout.
- Create `app/api/referrals/route.ts`: authenticated referral link and ledger summary.
- Modify `app/dashboard/settings/page.tsx`: referral card, copy behavior, and view tracking.
- Modify `lib/analytics/events.ts`: typed referral events.
- Create focused tests in `tests/unit/referral-*.test.ts(x)` and `tests/unit/billing-*.test.ts`.

### Task 1: Referral Ledger Migration

**Files:**
- Create: `tests/unit/referral-credit-migration.test.ts`
- Create: `migrations-referral-credits.sql`
- Modify: `schema.sql`

- [ ] **Step 1: Write the failing migration mirror test**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('referral credit migration', () => {
  it('keeps the migration and canonical schema aligned', async () => {
    const [migration, schema] = await Promise.all([
      readFile('migrations-referral-credits.sql', 'utf8'),
      readFile('schema.sql', 'utf8'),
    ]);

    for (const sqlFragment of [
      'CREATE TABLE IF NOT EXISTS referral_credits',
      'referred_account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE',
      "CHECK (status IN ('earned', 'applied'))",
      'stripe_balance_transaction_id TEXT',
      'idx_referral_credits_referrer_account_id',
      'idx_referral_credits_earned',
    ]) {
      expect(migration).toContain(sqlFragment);
      expect(schema).toContain(sqlFragment);
    }
  });
});
```

- [ ] **Step 2: Run the migration test and confirm it fails**

Run: `npx vitest run tests/unit/referral-credit-migration.test.ts`

Expected: FAIL because `migrations-referral-credits.sql` does not exist.

- [ ] **Step 3: Add the migration and mirror it into `schema.sql`**

```sql
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

CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer_account_id
    ON referral_credits(referrer_account_id);

CREATE INDEX IF NOT EXISTS idx_referral_credits_earned
    ON referral_credits(referrer_account_id, earned_at)
    WHERE status = 'earned';
```

Place the table beside `growth_attributions` in `schema.sql` and place the indexes with the other schema indexes. Do not execute the migration.

- [ ] **Step 4: Run the migration test**

Run: `npx vitest run tests/unit/referral-credit-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the ledger schema**

```bash
git add migrations-referral-credits.sql schema.sql tests/unit/referral-credit-migration.test.ts
git commit -m "feat: add referral credit ledger"
```

### Task 2: SQL Award Guardrails and Ledger Queries

**Files:**
- Create: `tests/unit/referral-credits-query.test.ts`
- Create: `lib/neon/queries/referral-credits.ts`
- Modify: `lib/neon/queries/index.ts`

- [ ] **Step 1: Write failing query tests for every guardrail**

Mock `sql` as a tagged function with a `transaction` property. Assert the two transaction statements contain:

```ts
expect(lockSql).toContain('FOR UPDATE OF referrer');
expect(lockSql).toContain('il.account_id <> ga.account_id');
expect(insertSql).toContain("status = 'submitted'");
expect(insertSql).toContain('deleted_at IS NULL');
expect(insertSql).toContain('COALESCE(is_demo, FALSE) = FALSE');
expect(insertSql).toContain('= 1');
expect(insertSql).toContain("NOW() - INTERVAL '365 days'");
expect(insertSql).toContain('< 12');
expect(insertSql).toContain('ON CONFLICT (referred_account_id) DO NOTHING');
```

Also make the transaction mock return `[[], []]` for duplicate/capped/self candidates and assert `awardReferralCreditForActivation()` returns `null`. Return an inserted row in the second result and assert it is returned unchanged.

- [ ] **Step 2: Run the query tests and confirm they fail**

Run: `npx vitest run tests/unit/referral-credits-query.test.ts`

Expected: FAIL because the query module is absent.

- [ ] **Step 3: Implement the typed query module**

Define:

```ts
export type ReferralCreditStatus = 'earned' | 'applied';

export interface ReferralCredit {
  id: string;
  referrer_account_id: string;
  referred_account_id: string;
  amount_cents: number;
  status: ReferralCreditStatus;
  stripe_balance_transaction_id: string | null;
  earned_at: string;
  applied_at: string | null;
}

export interface AwardedReferralCredit extends ReferralCredit {
  referrer_stripe_customer_id: string | null;
  referrer_subscription_id: string | null;
  referrer_subscription_status: string;
}
```

Implement these public functions:

```ts
awardReferralCreditForActivation(referredAccountId: string): Promise<AwardedReferralCredit | null>
getReferralCreditsForAccount(accountId: string): Promise<ReferralCredit[]>
getEarnedReferralCredits(accountId: string): Promise<ReferralCredit[]>
markReferralCreditApplied(creditId: string, stripeBalanceTransactionId: string): Promise<ReferralCredit | null>
getValidReferralReferrerAccountId(referredAccountId: string): Promise<string | null>
```

The award function must submit a two-statement Neon transaction. Statement one resolves the same candidate and locks the referrer's `accounts` row with `FOR UPDATE OF referrer`. Statement two repeats eligibility in an `INSERT ... SELECT`, counts all credits earned in the rolling window regardless of current status, and returns the ledger row joined to the referrer's Stripe fields. Use `ON CONFLICT (referred_account_id) DO NOTHING` as the final duplicate guard.

`markReferralCreditApplied` must update only `WHERE id = ${creditId} AND status = 'earned'`, set `applied_at = NOW()`, and return the updated row.

- [ ] **Step 4: Export the new API from the barrel**

```ts
export type {
  AwardedReferralCredit,
  ReferralCredit,
  ReferralCreditStatus,
} from './referral-credits';
export {
  awardReferralCreditForActivation,
  getEarnedReferralCredits,
  getReferralCreditsForAccount,
  getValidReferralReferrerAccountId,
  markReferralCreditApplied,
} from './referral-credits';
```

- [ ] **Step 5: Run the query tests**

Run: `npx vitest run tests/unit/referral-credits-query.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit SQL guardrails**

```bash
git add lib/neon/queries/referral-credits.ts lib/neon/queries/index.ts tests/unit/referral-credits-query.test.ts
git commit -m "feat: enforce referral award guardrails"
```

### Task 3: Idempotent Stripe Credit Redemption

**Files:**
- Create: `tests/unit/referral-credit-service.test.ts`
- Create: `lib/referrals/referral-credit-service.ts`

- [ ] **Step 1: Write failing redemption-service tests**

Mock `stripe`, `getAccountById`, `getEarnedReferralCredits`, and `markReferralCreditApplied`. Cover:

```ts
expect(createBalanceTransaction).toHaveBeenCalledWith(
  'cus_referrer',
  expect.objectContaining({
    amount: -900,
    currency: 'usd',
    metadata: { referral_credit_id: 'credit_1', account_id: 'acct_referrer' },
  }),
  { idempotencyKey: 'referral-credit-credit_1' }
);
expect(markReferralCreditApplied).toHaveBeenCalledWith('credit_1', 'cbtxn_1');
```

Add cases proving guarded activation-time redemption returns without loading credits when the account lacks a Stripe customer/subscription, accepts Stripe statuses `active` and `trialing`, rejects an inactive status, and applies every returned earned credit when `requireActiveSubscription` is false.

- [ ] **Step 2: Run the service test and confirm it fails**

Run: `npx vitest run tests/unit/referral-credit-service.test.ts`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement the server-only redemption service**

```ts
export async function applyEarnedReferralCredits(
  accountId: string,
  options: { requireActiveSubscription?: boolean } = {}
): Promise<string[]>;
```

Load the account, return `[]` when it has no Stripe customer, and by default require its own subscription ID plus an authoritative Stripe retrieve whose status is `active` or `trialing`. When `requireActiveSubscription` is `false`, skip the retrieve because checkout completion has just established the account subscription.

For each earned credit, call `stripe.customers.createBalanceTransaction` with the persisted amount negated, `usd`, a concise description, ledger/account metadata, and idempotency key `referral-credit-${credit.id}`. Mark applied only after Stripe returns an ID. Return the IDs of credits successfully marked applied; let failures throw so the seller wrapper can suppress them and the webhook can retry them.

- [ ] **Step 4: Run the service tests**

Run: `npx vitest run tests/unit/referral-credit-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit redemption behavior**

```bash
git add lib/referrals/referral-credit-service.ts tests/unit/referral-credit-service.test.ts
git commit -m "feat: redeem referral credits through Stripe"
```

### Task 4: First-Time Referred Checkout Trial

**Files:**
- Create: `tests/unit/referral-trial.test.ts`
- Create: `tests/unit/billing-checkout-referral-trial.test.ts`
- Create: `lib/referrals/referral-trial.ts`
- Modify: `app/api/billing/checkout/route.ts`

- [ ] **Step 1: Write failing qualification tests**

Mock `getValidReferralReferrerAccountId` and `stripe.subscriptions.list`. Assert qualification is false for missing/self-invalid attribution and any subscription history, and true only for a valid referrer plus an empty Stripe history. The Stripe call must be:

```ts
expect(listSubscriptions).toHaveBeenCalledWith({
  customer: 'cus_referred',
  status: 'all',
  limit: 1,
});
```

Also assert provider/query failures return false and log rather than failing Checkout.

- [ ] **Step 2: Implement `qualifiesForReferralTrial`**

```ts
export async function qualifiesForReferralTrial(
  accountId: string,
  stripeCustomerId: string
): Promise<boolean>;
```

Resolve a valid non-self referrer first, then ask Stripe for all subscription history with a one-item limit. Return true only when `data.length === 0`; catch and log qualification errors and return false.

- [ ] **Step 3: Write the failing Checkout route test**

Mock authentication, account lookup, Stripe customer/session creation, and qualification. For a qualified account assert `stripe.checkout.sessions.create` receives:

```ts
expect.objectContaining({
  payment_method_collection: 'if_required',
  subscription_data: {
    trial_period_days: 30,
    trial_settings: {
      end_behavior: { missing_payment_method: 'cancel' },
    },
  },
})
```

For an unqualified account assert both fields are absent.

- [ ] **Step 4: Add conditional trial parameters to Checkout**

After the customer exists, compute `const referralTrial = await qualifiesForReferralTrial(account.id, stripeCustomerId)`. Build the existing Checkout payload with:

```ts
...(referralTrial
  ? {
      payment_method_collection: 'if_required' as const,
      subscription_data: {
        trial_period_days: 30,
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' as const },
        },
      },
    }
  : {}),
```

Do not alter price, metadata, success URL, cancellation URL, or Teams checkout.

- [ ] **Step 5: Run trial and Checkout tests**

Run: `npx vitest run tests/unit/referral-trial.test.ts tests/unit/billing-checkout-referral-trial.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit trial qualification**

```bash
git add lib/referrals/referral-trial.ts app/api/billing/checkout/route.ts tests/unit/referral-trial.test.ts tests/unit/billing-checkout-referral-trial.test.ts
git commit -m "feat: grant first-time referral trials"
```

### Task 5: Safe Activation Award Hook

**Files:**
- Create: `tests/unit/award-referral-credit.test.ts`
- Create: `lib/referrals/award-referral-credit.ts`
- Modify: `app/api/seller/[token]/route.ts`

- [ ] **Step 1: Write failing safe-orchestrator tests**

Mock the award query and redemption service. Assert no redemption occurs when no row is inserted, redemption targets the returned referrer on an award, and both award and redemption failures resolve without throwing while logging an error.

```ts
await expect(awardAndRedeemReferralCredit('acct_referred')).resolves.toBeUndefined();
expect(applyEarnedReferralCredits).toHaveBeenCalledWith('acct_referrer');
```

- [ ] **Step 2: Implement the safe orchestrator**

```ts
export async function awardAndRedeemReferralCredit(referredAccountId: string) {
  try {
    const awarded = await awardReferralCreditForActivation(referredAccountId);
    if (!awarded) return;
    await applyEarnedReferralCredits(awarded.referrer_account_id);
  } catch (error) {
    console.error('Failed to award or redeem referral credit:', error);
  }
}
```

- [ ] **Step 3: Hook the orchestrator into seller submission**

Import it in `app/api/seller/[token]/route.ts` and call:

```ts
await awardAndRedeemReferralCredit(requestData.account_id);
```

immediately after the `requests` update sets `status = 'submitted'`. The query owns first-activation and non-demo detection, and the helper owns the non-breaking `try/catch` boundary.

- [ ] **Step 4: Run the safe-hook tests**

Run: `npx vitest run tests/unit/award-referral-credit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the activation hook**

```bash
git add lib/referrals/award-referral-credit.ts app/api/seller/[token]/route.ts tests/unit/award-referral-credit.test.ts
git commit -m "feat: award credits on seller activation"
```

### Task 6: Checkout Webhook Redemption

**Files:**
- Create: `tests/unit/billing-webhook-referral-credits.test.ts`
- Modify: `app/api/billing/webhook/route.ts`

- [ ] **Step 1: Write the failing webhook test**

Mock signature construction to return an account-level `checkout.session.completed` event, mock account lookup and subscription retrieval, and assert the order is subscription update followed by:

```ts
expect(applyEarnedReferralCredits).toHaveBeenCalledWith('acct_referrer', {
  requireActiveSubscription: false,
});
```

Add a Teams-customer case and assert the referral service is not called. Add an application failure case and assert the webhook returns 500 so Stripe can retry.

- [ ] **Step 2: Add account-only webhook redemption**

After `updateAccountSubscription` completes in `checkout.session.completed`, call:

```ts
await applyEarnedReferralCredits(account.id, {
  requireActiveSubscription: false,
});
```

Leave it inside the existing top-level webhook error boundary. Do not call it for an organization customer or any subscription update/deletion event.

- [ ] **Step 3: Run the webhook test**

Run: `npx vitest run tests/unit/billing-webhook-referral-credits.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit webhook redemption**

```bash
git add app/api/billing/webhook/route.ts tests/unit/billing-webhook-referral-credits.test.ts
git commit -m "feat: apply earned credits after checkout"
```

### Task 7: Referral Summary API and Settings Card

**Files:**
- Create: `tests/unit/referrals-route.test.ts`
- Create: `tests/unit/settings-referral-credit-card.test.tsx`
- Create: `app/api/referrals/route.ts`
- Modify: `app/dashboard/settings/page.tsx`
- Modify: `lib/analytics/events.ts`

- [ ] **Step 1: Write failing authenticated API tests**

Mock Stack Auth, `ensureAccountActivation`, `getOrCreateIntakeLink`, and `getReferralCreditsForAccount`. Cover 401 for anonymous access and a successful response:

```ts
expect(await response.json()).toEqual({
  referralLink: 'https://utilitysheet.com/auth/signup?ref=referrer-slug',
  counts: { earned: 2, applied: 1 },
});
```

The test data must include two `earned` rows and one `applied` row.

- [ ] **Step 2: Implement the referral summary route**

Authenticate, call `ensureAccountActivation`, get/create the account intake link, list its referral credits, and count rows by current status. Build the link with `URL` and `searchParams.set('ref', intakeLink.slug)` against `NEXT_PUBLIC_APP_URL`, then Vercel URL, then localhost. Return only the link and counts.

- [ ] **Step 3: Add typed analytics events**

```ts
referral_credit_card_viewed: BasePayload & {
  earned_count: number;
  applied_count: number;
};
referral_credit_link_copied: BasePayload;
```

- [ ] **Step 4: Write the failing settings-card test**

Follow the existing settings test mocks for `/api/account` and `/api/intake-link`, add `/api/referrals`, and assert:

```ts
expect(await screen.findByText('Give a month of Pro, get a month of Pro')).toBeInTheDocument();
expect(screen.getByDisplayValue('https://utilitysheet.com/auth/signup?ref=referrer-slug')).toBeReadOnly();
expect(screen.getByText('2 available')).toBeInTheDocument();
expect(screen.getByText('1 applied')).toBeInTheDocument();
expect(trackEvent).toHaveBeenCalledWith('referral_credit_card_viewed', {
  location: 'dashboard_settings',
  earned_count: 2,
  applied_count: 1,
});
```

Click the referral card's copy button and assert the exact URL reaches `navigator.clipboard.writeText`, a success toast appears, and `referral_credit_link_copied` fires only after clipboard success.

- [ ] **Step 5: Implement the settings card**

Add `referralSummary` state, a fetch effect, and a view-tracked ref. Add a `handleCopyReferralLink` that mirrors existing clipboard/toast behavior and records the copy event only after success.

Render the card immediately before Subscription. Use the existing primitives, `Gift`/`Copy` icons, `text-primary` for program emphasis, neutral surfaces for the available count, and emerald only for the applied count. Explain that a credit is earned after the referred user receives their first real seller submission.

- [ ] **Step 6: Run API and component tests**

Run: `npx vitest run tests/unit/referrals-route.test.ts tests/unit/settings-referral-credit-card.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the settings experience**

```bash
git add app/api/referrals/route.ts app/dashboard/settings/page.tsx lib/analytics/events.ts tests/unit/referrals-route.test.ts tests/unit/settings-referral-credit-card.test.tsx
git commit -m "feat: add referral credit settings card"
```

### Task 8: Integrated Verification

**Files:**
- Review all files changed since `aee6b33`.

- [ ] **Step 1: Run the complete test suite**

Run: `npx vitest run`

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Run ESLint on changed TypeScript files**

Build the file list from `git diff --name-only aee6b33 -- '*.ts' '*.tsx'` and run `npx eslint` with those paths only.

Expected: exit code 0 with no warnings or errors.

- [ ] **Step 4: Inspect scope and migration safety**

Run:

```bash
git status --short
git diff --stat aee6b33
git diff --check aee6b33
git diff aee6b33 -- components/packet/transaction-referral-cta.tsx 'app/(marketing)/from-a-closing' app/api/organization
```

Expected: only intended referral-program files plus the user's pre-existing `docs/growth/community-content-bank.md` and `playwright-report/` artifacts; the forbidden-scope diff is empty; no migration command has been executed.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required code changes, stage only those intended files and commit:

```bash
git commit -m "test: complete referral program verification"
```

Do not push.
