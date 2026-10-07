# Plan: Teams duplicate-subscription guard and referral trial end date

## Status

Completed (2026-10-07, Claude Opus 5.5): implemented, validated, migration
applied, committed and pushed to main with owner authorization. Deployment not
verified.
Owner asked for both in chat on 2026-10-07. These are the two optional follow-ups from
`.ai/plans/2026-10-07-billing-duplicate-checkout-and-plan-end.md`. Decision
record amended: `.ai/decisions/2026-10-07-one-live-subscription-and-plan-end-date.md`.

## Objective

1. A Teams workspace gets the same protection Pro accounts now have: no second
   subscription from checkout, and an ended subscription that is not the stored
   one cannot set the workspace to Free.
2. A customer on the referral free month sees when it ends and what to do.

## Verified facts (from the code, 2026-10-07)

- `syncOrganizationSubscription` and the customer-lookup fallbacks in
  `app/api/billing/webhook/route.ts` apply any not-paid event to the workspace
  (Free, zero seats) without comparing it with `organizations.subscription_id`.
- `app/api/organization/billing/checkout/route.ts` refuses only when our
  database says the workspace is on Teams. A past-due Teams plan is stored as
  Free, so "Start Teams" is offered again. The Free-to-Teams path also never
  looks at the account's own Stripe customer, so a past-due or not-yet-synced
  Pro can be doubled by a new Teams subscription.
- The referral trial is created in `app/api/billing/checkout/route.ts` with a
  30 day trial, no card required, and cancellation when the trial ends without
  a payment method. The account is stored as `pro` while `trialing`; nothing
  stores that it is a trial.
- Live Stripe had no trialing subscription on 2026-10-07, so no backfill.

## Assumptions (not verified)

- Adding a card in the customer portal does not reliably send a subscription
  event, so the app cannot know whether a trial has a card. The wording works
  either way.
- A trial that converts sends `customer.subscription.updated` with status
  `active`, which clears the stored trial end.

## Scope

Teams guard
- Webhook: in the workspace path and in the customer-lookup fallbacks for
  `updated` and `deleted`, a not-paid event for a subscription other than the
  stored one is acknowledged and ignored. In the metadata path, a paid event
  for a different subscription while the workspace is on Teams records the
  existing `billing_webhook:duplicate_subscription` incident and still updates
  the workspace (same rule as Pro).
- `POST /api/organization/billing/checkout`, Free-to-Teams path only: before a
  Checkout Session is created, refuse (409, `manageBilling`) when the
  account's own Stripe customer or the workspace's Stripe customer has a live
  subscription; refuse (503) when Stripe cannot be read. The Pro-to-Teams
  conversion path is unchanged.
- Billing UI: a refused Teams checkout offers the matching portal button.

Trial end
- New nullable `accounts.subscription_trial_ends_at`
  (`migrations-subscription-trial-ends-at.sql`, mirrored in `schema.sql`),
  written by `updateAccountSubscription` while the subscription is `trialing`,
  cleared otherwise and on a Pro-to-Teams transfer.
- Billing shows "Your free month of Pro ends on <date>" with how to keep Pro,
  unless the plan is already set to cancel (that message wins).

## Out of scope

Pricing, plan limits, referral credits, trial qualification and trial length,
Teams conversion behavior, a trial date for a workspace that converted to Teams
during the free month, knowing whether a card is on file, reminder emails
(Stripe can send those; owner setting).

## Expected files

- `app/api/billing/webhook/route.ts`,
  `app/api/organization/billing/checkout/route.ts`
- `lib/neon/queries/{accounts,organizations}.ts`
- new `migrations-subscription-trial-ends-at.sql`; `schema.sql`
- `components/settings/{billing-section,settings-view}.tsx`
- `app/(admin)/admin/operations/page.tsx` (incident wording)
- tests: `tests/unit/{billing-webhook-subscription-sync,billing-webhook-referral-credits,organization-billing-checkout-route,team-billing-transfer-query,settings-states}.test.ts(x)`,
  `tests/settings.spec.ts`

## Acceptance criteria

- An ended subscription that is not the workspace's stored one changes nothing;
  the stored one ending still sets the workspace to Free with zero seats.
- Free-to-Teams checkout creates no session when either customer has a live
  subscription or Stripe cannot be read; otherwise its parameters are unchanged.
- The Pro-to-Teams conversion tests pass unchanged apart from added fields.
- A trialing Pro stores the trial end; active, ended and converted plans clear it.
- Billing shows the trial line only for Pro with a stored trial end and no
  cancellation date.

## Validation

`tsc`; ESLint on changed files; full Vitest with native PostgreSQL;
`tests/settings.spec.ts` on Desktop Chrome, Mobile Safari and Mobile Chrome;
security scan.

## Risks

- **Deploy order.** `migrations-subscription-trial-ends-at.sql` must be applied
  before this code is live; the account subscription write names the column.
- A permitted Free-to-Teams checkout makes one or two extra Stripe reads.
- If a workspace's stored subscription ended and that event was never
  delivered, a later ended event for another subscription no longer resets it.

## Outcome

Implemented as scoped. Details worth knowing:

- The customer-lookup fallback for `checkout.session.completed` has no guard;
  a completed checkout is a new paid subscription, not an ending one.
- The Teams checkout refusal names which portal applies
  (`manageBilling: 'personal' | 'workspace'`); the Pro route still sends `true`,
  which the page treats as personal.
- The trial line is shown for any trialing Pro, with wording that is true
  whether or not a card is on file.

Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full
Vitest with native PostgreSQL 206 files / 1498 tests passed (an earlier run had
one failure in the unrelated, load-sensitive
`tests/unit/branding-list-page.test.tsx`, which passed alone and in the next
full run); `tests/settings.spec.ts` 33/33 across three device profiles with
service keys blanked in that process only; security scan passed; screenshots of
the free-month and refused-Teams-checkout states reviewed.

Not verified: a signed-in browser, the hosted site, a real checkout, trial or
webhook delivery.

Migration applied to the configured Neon database on 2026-10-07 with owner
authorization, before the push (psql 17, stop-on-error, transaction-local 10s
lock / 180s statement timeouts). Aggregates only: 160 accounts before and
after, row fingerprint ignoring the new column identical, column present and
nullable, no value set.
