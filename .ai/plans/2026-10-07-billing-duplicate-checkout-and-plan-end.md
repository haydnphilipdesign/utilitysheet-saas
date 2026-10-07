# Plan: Block a second Pro checkout (P4) and show when a canceled plan ends (P5)

## Status

Completed (2026-10-07, Claude Opus 5.5): implemented, validated, migration
applied, committed and pushed to main with owner authorization. Deployment not
verified.
Owner approved the recommendations in chat on 2026-10-07 after a read-only
investigation. Deferred items P4 and P5 from
`.ai/plans/2026-10-07-settings-ux-polish.md`. Decision:
`.ai/decisions/2026-10-07-one-live-subscription-and-plan-end-date.md`.

## Objective

1. An account that already has a live Pro subscription, or whose active
   workspace is on Teams, cannot start another Pro checkout, and a stray
   second subscription can no longer silently downgrade a paying account.
2. Settings > Billing says when a plan that is set to cancel will end, for Pro
   and for Teams.

## Verified facts (from the code, 2026-10-07)

- `app/api/billing/checkout/route.ts` had no subscription or workspace check
  and always created a subscription Checkout Session on the account's existing
  Stripe customer. Non-trial sessions have no idempotency key.
- `syncAccountSubscription` in `app/api/billing/webhook/route.ts` never compared
  the event's subscription with `accounts.subscription_id`.
- Only `active` and `trialing` count as paid. A past-due Pro is stored as Free
  with no subscription ID, so Billing offers "Upgrade to Pro" again.
- The plan card kept the Upgrade button while a checkout return was
  "confirming".
- `lib/account/closure.ts` cancels only the stored subscription ID.
- Nothing stored a cancellation schedule. The webhook already handles
  `customer.subscription.updated`. `/api/account` and
  `/api/organization/members` return whole rows, so a new column reaches the
  client without a route change. Stripe SDK 22.6.0 types expose `cancel_at`
  and `cancel_at_period_end`.
- Billing webhook alerts count `billing_webhook` failures in the last 24 hours
  that have no success row with the same provider event ID.

## Assumptions (not verified; no live Stripe or database access used)

- Stripe sets `cancel_at` when a subscription is canceled at period end. The
  code falls back to the period end when only `cancel_at_period_end` is true.
- Stripe Checkout does not itself block a second subscription unless the
  dashboard setting "Limit customers to 1 subscription" is on. The owner
  reported it was off and is turning it on, pointing at Settings > Billing.
- The portal cancels at period end. If it cancels immediately there is never a
  date to show.

## Owner decisions

- P4: database guard, Stripe guard and webhook hardening; no open-session reuse.
- If the Stripe read fails, refuse checkout.
- Block Pro checkout when the **active** workspace is on Teams (matches the UI),
  not when any workspace of the account is.
- P5: a stored column. Members see the Teams end date; only admins get the
  manage button.

## Scope

P4
- `POST /api/billing/checkout`: 409 when the account is Pro; 409 when the
  account is a member of its active workspace and that workspace is on Teams;
  then list the Stripe customer's subscriptions and 409 when one is `active`,
  `trialing`, `past_due`, `unpaid` or `paused`; 503 when that read fails. The
  Stripe refusal carries `manageBilling: true`.
- Webhook, account path only: an event for a subscription that is not paid and
  is not the account's stored subscription is acknowledged and ignored. A paid
  event for a different subscription while the account is Pro on another one
  still updates the account (unchanged behavior) and records a critical
  `billing_webhook:duplicate_subscription` operational event.
- UI: checkout buttons are disabled while a checkout return is confirming; a
  refusal that carries `manageBilling` shows a "Manage subscription" button.

P5
- New nullable `subscription_cancel_at TIMESTAMPTZ` on `accounts` and
  `organizations` (`migrations-subscription-cancel-at.sql`, mirrored in
  `schema.sql`).
- Written by `updateAccountSubscription`, `updateOrganizationSubscription` and
  `transferAccountSubscriptionToOrganization` (moves to the workspace, cleared
  on the account); cleared whenever the plan is not paid.
- Billing plan card shows the end date for Pro and Teams.

## Out of scope

Pricing, plan limits, referral credits and trial qualification
(`lib/referrals/referral-trial.ts` is untouched), Teams conversion behavior,
the same "not the current subscription" guard on the Teams webhook path,
reusing open checkout sessions, a backfill for plans already set to cancel,
trials that end for lack of a card, account closure.

## Deviation from the investigation report

`incomplete` is not treated as a live subscription in the checkout guard. A
first payment that failed inside Checkout can leave an incomplete subscription
for up to a day, and refusing checkout for that time would leave the customer
with no way to pay. The webhook change makes its later expiry harmless.

## Expected files

- `app/api/billing/checkout/route.ts`, `app/api/billing/webhook/route.ts`,
  `app/api/organization/billing/checkout/route.ts`
- new `lib/stripe/subscriptions.ts`
- `lib/neon/queries/{accounts,organizations}.ts`
- new `migrations-subscription-cancel-at.sql`; `schema.sql`
- `components/settings/{billing-section,settings-view,types}.tsx`
- `app/(admin)/admin/operations/page.tsx` (incident label)
- tests: `tests/unit/billing-checkout-referral-trial.test.ts`, new
  `tests/unit/billing-checkout-guards.test.ts`,
  `tests/unit/billing-webhook-referral-credits.test.ts`, new
  `tests/unit/billing-webhook-subscription-sync.test.ts`,
  `tests/unit/{organization-billing-checkout-route,team-billing-transfer-query,settings-states}.test.ts(x)`,
  `tests/settings.spec.ts`

## Acceptance criteria

- A Pro account, an account whose active workspace is on Teams, and a Free
  account whose Stripe customer has a live subscription each get 409 and no
  Checkout Session is created. A failed Stripe read gives 503 and no session.
- A Free account with no live subscription gets the same Checkout Session
  parameters as before, including the referral trial variant.
- An ended or expired subscription that is not the account's stored one does
  not change the account. The stored one ending still downgrades it.
- Signature verification, the closing/closed account rule, credit redemption
  order and the 500-for-retry behavior are unchanged.
- A paid plan with a cancellation date stores it; removing the schedule or
  losing paid status clears it; a Pro-to-Teams conversion carries it over.
- Billing shows the end date only when the loaded account or workspace has one.

## Validation

`tsc`; ESLint on changed files; full Vitest (with the native PostgreSQL binary
if available); `tests/settings.spec.ts` on Desktop Chrome, Mobile Safari and
Mobile Chrome; security scan.

## Risks

- **Deploy order.** The migration must be applied before this code is live.
  The subscription writers reference the new column, so without it every
  subscription webhook write fails (Stripe retries, and the billing alert
  fires). The migration is additive and safe to apply before the code.
- Plans already set to cancel show no date until Stripe next sends an event
  for them.
- If the stored subscription ended and its event was never delivered, a later
  ended event for another subscription no longer resets the account. Stripe
  retries events for days, so this needs two separate failures.
- The duplicate-subscription event has no provider event ID so that the
  handler's own success row does not mark it recovered; it therefore shows in
  the billing alert for 24 hours under the generic "failed processing" summary.

## Outcome

Implemented as scoped, with the one deviation recorded above (`incomplete` does
not block checkout). The checkout guard makes its own Stripe list call and
leaves `qualifiesForReferralTrial` untouched, so a permitted checkout now makes
two subscription reads.

Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full
Vitest with the native PostgreSQL binary, 206 files / 1478 tests passed;
`tests/settings.spec.ts` 27/27 across Desktop Chrome, Mobile Safari and Mobile
Chrome with service keys blanked in that process only; security scan passed;
screenshots of the plan-ending and refused-checkout states reviewed on desktop
and phone.

Live Stripe read (owner-authorized in chat, list calls only, aggregates
recorded): 12 subscriptions, 10 active and 2 canceled; no customer with more
than one live subscription; none set to cancel, so no backfill is needed.

Not verified: a signed-in browser, the hosted site, a real checkout, portal or
webhook delivery, dark mode.

Migration applied to the configured Neon database on 2026-10-07 with owner
authorization, before the push (psql 17, stop-on-error, transaction-local 10s
lock / 180s statement timeouts). Aggregates only: 160 accounts and 141
organizations before and after, row fingerprints ignoring the new column
identical, both columns present and nullable, no value set.

Optional follow-up: the same guard on the Teams webhook path; the end
of a card-less referral trial.
