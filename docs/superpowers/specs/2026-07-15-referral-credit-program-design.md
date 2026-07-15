# Referral Credit Program Design

## Goal

Implement UtilitySheet's "Give a month of Pro, get a month of Pro" program. A valid referred account receives a one-time 30-day Pro trial at its first checkout, and its referrer earns a $9 Pro credit when the referred account reaches its first real seller submission.

## Scope

The feature covers the referral-credit ledger, activation-time awards, automatic Stripe redemption, referred-user checkout trials, a settings referral card, typed analytics, and focused unit coverage. It does not change the packet referral CTA, `/from-a-closing`, white-label behavior, or Teams billing. The migration will be produced and mirrored into `schema.sql` but will not be run.

## Data Model

Add `referral_credits` with:

- `id UUID PRIMARY KEY`
- `referrer_account_id UUID NOT NULL REFERENCES accounts(id)`
- `referred_account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE`
- `amount_cents INT NOT NULL DEFAULT 900`
- `status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'applied'))`
- `stripe_balance_transaction_id TEXT`
- `earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `applied_at TIMESTAMPTZ`

Index `referrer_account_id` and the status lookup used to retrieve unapplied credits. The unique referred-account constraint is the durable at-most-once award guardrail.

## Award Architecture

`lib/neon/queries/referral-credits.ts` owns ledger persistence. Its award operation accepts the referred account ID and performs the following in SQL:

1. Confirm the account has exactly one request satisfying the canonical activation predicate: `status = 'submitted'`, `deleted_at IS NULL`, and `COALESCE(is_demo, FALSE) = FALSE`.
2. Resolve `growth_attributions.referral_code` through `intake_links.slug`.
3. Reject a candidate whose intake link belongs to the referred account.
4. Serialize awards for the resolved referrer while counting credits earned during the preceding 365 days.
5. Insert only when the rolling count is below 12, using the unique referred-account constraint and conflict handling for duplicate delivery.

The query returns the inserted credit and the referrer's billing identifiers when an award occurs. It returns no award for an invalid attribution, repeat activation, duplicate referred account, self-referral, or capped referrer.

After the seller route stores a successful submission, it calls the award operation. If a credit is returned, it asks the shared redemption service to apply eligible earned credits for that referrer. This entire referral block is wrapped in `try/catch`; failures are logged and never change the seller submission response.

## Stripe Redemption

Create a focused server-side referral redemption service shared by seller activation and the billing webhook. It loads the account and its earned credits, then creates one Stripe customer balance transaction per credit:

- amount: `-900` cents (or the persisted `amount_cents` negated)
- currency: `usd`
- metadata: the ledger credit ID and account ID
- idempotency key: stable and derived from the ledger credit ID

After Stripe succeeds, the service conditionally marks that credit `applied` and stores the balance transaction ID and application timestamp. If Stripe succeeds but the database update fails, a retry reuses the idempotency key and therefore does not create another balance adjustment.

Activation-time redemption runs only when the referrer has its own Stripe customer and an active/trialing Pro subscription. Otherwise, the ledger row remains `earned`. On account-level `checkout.session.completed`, the webhook updates the Pro subscription first and then applies every earned credit. Teams checkout and organization subscriptions do not redeem these credits.

Webhook redemption errors are allowed to fail the webhook so Stripe can retry. Stable Stripe idempotency and conditional database updates make those retries safe.

## Referred User Trial

The account qualifies for the 30-day trial only when:

- its saved referral code resolves to another account's intake slug; and
- its Stripe customer has no subscription history.

Stripe subscription history is authoritative. Checkout queries subscriptions for the customer with `status: 'all'` and a one-item limit. This prevents previously canceled subscribers from receiving another referral trial even though the existing deletion webhook clears `accounts.subscription_id`.

For a qualified account, the Pro Checkout Session adds:

```ts
payment_method_collection: 'if_required',
subscription_data: {
  trial_period_days: 30,
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel',
    },
  },
},
```

All existing line items, metadata, and redirect behavior remain unchanged.

## Settings Experience

Add an authenticated referral-summary endpoint that returns:

- the user's referral signup URL, built as `/auth/signup?ref=<intake-slug>` against the configured application base URL;
- the number of ledger rows still `earned`;
- the number already `applied`.

The settings page fetches this summary and renders a card near subscription management. The card uses existing Card, Input, and Button primitives; the existing slate-blue primary color carries the icon and primary emphasis, while emerald is reserved for the applied-credit success state. It includes the program title, a short activation-based explanation, the read-only referral URL, a copy button, and earned/applied counts.

The card records `referral_credit_card_viewed` once after valid data loads. A successful clipboard write records `referral_credit_link_copied`; failed copies show the existing error toast and do not record a copied event.

## Query and Service Interfaces

The new query barrel exports:

- the activation award operation;
- list earned credits for redemption;
- list/count credits for an account summary;
- conditionally mark a credit applied;
- determine whether a referred account has valid non-self attribution.

The shared Stripe service exposes a single account-oriented application function with an option controlling whether an existing active Pro subscription is required. The seller hook uses the guarded mode; checkout completion uses the post-checkout mode.

## Error Handling and Idempotency

- Seller submission is never rolled back or failed by referral attribution, award, or Stripe errors.
- The unique ledger constraint prevents duplicate awards for one referred account.
- Serialized SQL cap checks prevent concurrent awards from exceeding 12 credits in a rolling year.
- Stable Stripe idempotency keys prevent duplicate balance transactions.
- Conditional `earned` to `applied` updates prevent state regression during retries.
- Checkout omits trial parameters if qualification cannot be established.
- Referral-summary failures leave the settings card unavailable without affecting the rest of settings.

## Verification

Unit tests will cover:

- self-referral rejection;
- duplicate referred-account protection;
- the rolling 365-day cap;
- valid activation award behavior;
- Stripe-history-based trial qualification and exact Checkout Session trial parameters;
- application of all earned credits on Pro checkout completion;
- stable balance-transaction inputs and applied-state persistence;
- referral card link rendering, view analytics, clipboard behavior, and copy analytics.

Final verification will run the complete Vitest suite, `npx tsc --noEmit`, and ESLint limited to changed TypeScript and TSX files. No live migration or push is part of the work.
