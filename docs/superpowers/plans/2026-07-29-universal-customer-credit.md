# Universal Customer Credit Implementation Plan

**Status (2026-07-29):** Tooling complete and validated. The read-only Stripe preview confirmed 7
eligible billing entities, $82.00 total, and no existing incident credits. Live application remains
separately authorization-gated.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare an idempotent, dry-run-first operation that credits every currently active paid billing entity one month of its current subscription amount.

**Architecture:** Keep incident compensation separate from the referral ledger and database schema. A pure JavaScript core validates active monthly Stripe subscriptions, calculates current recurring value, detects an existing incident balance transaction, and builds deterministic credit inputs. A thin CLI loads Pro accounts and Team organizations, performs the dry run by default, and requires explicit confirmation plus expected count/total before applying.

**Tech Stack:** Node.js 20 ESM, Neon serverless SQL, Stripe SDK 20.1.0, Vitest.

---

The verified reference scope is seven active billing entities and $82 total, but the command must
recalculate live state and refuse application if count or total differs. `--apply` is a live financial
mutation and remains separately authorization-gated.

### Task 1: Define and test the credit calculation

**Files:**
- Create: `scripts/incident/customer-credit-core.mjs`
- Create: `tests/unit/incident-customer-credit.test.ts`

- [ ] **Step 1: Write failing subscription-value tests**

Test one Pro subscription and one four-seat Team subscription:

```ts
const pro = {
    id: 'sub_pro',
    status: 'active',
    currency: 'usd',
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
};

const team = {
    id: 'sub_team',
    status: 'active',
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
};

expect(monthlySubscriptionAmount(pro)).toBe(900);
expect(monthlySubscriptionAmount(team)).toBe(2800);
```

Add rejection tests for `past_due`, annual/mixed intervals, non-USD currency, metered/unknown amounts,
zero quantity, and multiple currencies.

- [ ] **Step 2: Write failing idempotency and existing-credit tests**

Assert:

```ts
expect(buildIncidentIdempotencyKey({
    incidentId: 'provider-resolution-2026-07',
    entityType: 'account',
    entityId: 'account_1',
})).toBe('incident-credit-provider-resolution-2026-07-account-account_1');

expect(hasIncidentCredit(balanceTransactions, 'provider-resolution-2026-07')).toBe(true);
```

The existing check must inspect metadata, not descriptions or amount coincidence.

- [ ] **Step 3: Run tests and verify failure**

Run:

```powershell
npm test -- tests/unit/incident-customer-credit.test.ts --run
```

Expected: FAIL because the core module does not exist.

- [ ] **Step 4: Implement strict monthly valuation**

Export:

```js
export const INCIDENT_ID = 'provider-resolution-2026-07';
export const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function monthlySubscriptionAmount(subscription) {
    if (!ACTIVE_STATUSES.has(subscription.status)) {
        throw new Error(`Subscription ${subscription.id} is not active or trialing`);
    }

    let total = 0;
    for (const item of subscription.items.data) {
        const recurring = item.price.recurring;
        if (
            item.price.currency !== 'usd' ||
            !Number.isInteger(item.price.unit_amount) ||
            recurring?.interval !== 'month' ||
            recurring.interval_count !== 1 ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
        ) {
            throw new Error(`Subscription ${subscription.id} is not a fixed monthly USD subscription`);
        }
        total += item.price.unit_amount * item.quantity;
    }
    if (total <= 0) throw new Error(`Subscription ${subscription.id} has no creditable monthly amount`);
    return total;
}
```

Add helpers for stable keys, metadata detection, and PII-free aggregate summaries.

- [ ] **Step 5: Run core tests**

Run:

```powershell
npm test -- tests/unit/incident-customer-credit.test.ts --run
```

Expected: PASS.

### Task 2: Build the dry-run-first credit command

**Files:**
- Create: `scripts/incident/credit-paid-customers.mjs`
- Modify: `package.json`
- Modify: `tests/unit/incident-customer-credit.test.ts`

- [ ] **Step 1: Add the package command**

Add:

```json
{
  "scripts": {
    "incident:credit": "node scripts/incident/credit-paid-customers.mjs"
  }
}
```

- [ ] **Step 2: Query billing entities without customer contact fields**

Load:

```sql
SELECT
    'account' AS entity_type,
    id AS entity_id,
    stripe_customer_id,
    subscription_id
FROM accounts
WHERE subscription_status = 'pro'
  AND stripe_customer_id IS NOT NULL
  AND subscription_id IS NOT NULL
UNION ALL
SELECT
    'organization' AS entity_type,
    id AS entity_id,
    stripe_customer_id,
    subscription_id
FROM organizations
WHERE subscription_status = 'team'
  AND stripe_customer_id IS NOT NULL
  AND subscription_id IS NOT NULL
ORDER BY entity_type, entity_id;
```

Do not select emails, names, addresses, or seller data.

- [ ] **Step 3: Retrieve Stripe state and detect prior credit**

For each entity:

1. Retrieve its subscription with expanded item prices.
2. Compute the strict monthly amount.
3. Page through customer balance transactions until incident metadata is found or pagination ends.
4. Mark an existing incident transaction as `already_applied`; never create a second one.

Build a plan row:

```js
{
    entityType,
    entityId,
    stripeCustomerId,
    subscriptionId,
    amountCents,
    alreadyApplied,
    idempotencyKey,
}
```

Console output may show entity type and opaque IDs but not names/emails.

- [ ] **Step 4: Implement dry-run output and hard apply gates**

Default output:

```text
incident=provider-resolution-2026-07 mode=dry-run
eligible=7 already_applied=0 pending=7
total_pending_cents=8200
No Stripe credits created.
```

Apply requires all flags:

```text
--apply
--confirm provider-resolution-2026-07
--expected-count 7
--expected-total-cents 8200
```

Abort before Stripe writes if live pending count/total differs, any billing entity fails validation, or
an unknown flag is supplied.

- [ ] **Step 5: Create deterministic customer-balance transactions**

For each pending plan row:

```js
await stripe.customers.createBalanceTransaction(
    row.stripeCustomerId,
    {
        amount: -row.amountCents,
        currency: 'usd',
        description: 'UtilitySheet July 2026 service credit',
        metadata: {
            incident_id: INCIDENT_ID,
            entity_type: row.entityType,
            entity_id: row.entityId,
            subscription_id: row.subscriptionId,
        },
    },
    { idempotencyKey: row.idempotencyKey }
);
```

Process sequentially. If Stripe fails, stop immediately and report aggregate completed/remaining counts.
A rerun is safe because every entity uses a stable key and metadata detection.

- [ ] **Step 6: Test CLI orchestration with injected clients**

Keep the orchestration in an exported `runCustomerCreditOperation({ sql, stripe, args, output })`
function. Test:

- dry run never calls `createBalanceTransaction`;
- apply without every gate fails;
- mismatched expected total fails before writes;
- existing incident credit is skipped;
- seven valid entities create seven negative transactions;
- a rerun creates none;
- Stripe failure stops later writes and does not alter earlier idempotency.

- [ ] **Step 7: Run credit tests**

Run:

```powershell
npm test -- tests/unit/incident-customer-credit.test.ts --run
```

Expected: PASS.

### Task 3: Validate the operation without applying credits

**Files:**
- Modify: `.ai/CURRENT.md`
- Modify: `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`

- [ ] **Step 1: Run static and focused validation**

Run:

```powershell
npm test -- tests/unit/incident-customer-credit.test.ts tests/unit/referral-credit-service.test.ts --run
npm exec eslint -- scripts/incident/customer-credit-core.mjs scripts/incident/credit-paid-customers.mjs tests/unit/incident-customer-credit.test.ts
npm exec tsc -- --noEmit
git diff --check
```

Expected: PASS; existing referral behavior is unchanged.

- [ ] **Step 2: Run only the live-state dry run after explicit authorization**

Command:

```powershell
node --env-file=.env.local scripts/incident/credit-paid-customers.mjs
```

Expected from the previously verified snapshot: seven eligible, zero already applied, $82 pending, and
an explicit `No Stripe credits created.` line. If count or total differs, stop and investigate.

- [ ] **Step 3: Update durable handoff**

Record the dry-run aggregate, timestamp, and any drift. Keep the `--apply` command out of execution until
the owner separately authorizes the live financial mutation.
