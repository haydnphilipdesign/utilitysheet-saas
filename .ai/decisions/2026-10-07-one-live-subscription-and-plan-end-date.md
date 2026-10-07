# One Live Subscription per Customer, and a Stored Plan End Date

Date: 2026-10-07. Status: Accepted (owner decision in chat; implemented, migration applied, pushed to `origin/main` on 2026-10-07). Plan: `.ai/plans/2026-10-07-billing-duplicate-checkout-and-plan-end.md`. Builds on `.ai/decisions/2026-08-27-team-billing-ownership-and-workspace-isolation.md`.

## Context

Pro checkout created a new subscription without checking for an existing one, and the webhook applied any subscription event to the account whichever subscription it was about. A second subscription was therefore possible (most plausibly after a failed renewal, because a past-due Pro is stored as Free), would bill twice, and could set a paying account to Free when either one ended. Separately, nothing recorded that a plan was set to cancel, so Billing could not say when it ends.

## Decision

1. **Stripe is asked before a Pro checkout starts.** `POST /api/billing/checkout` refuses (409) when the account is Pro, when the account's active workspace is on Teams, or when the Stripe customer has a subscription that is `active`, `trialing`, `past_due`, `unpaid` or `paused`. If Stripe cannot be read, checkout is refused (503). `incomplete` does not block, so a failed first payment can be retried.
2. **Teams is judged by the active workspace only.** Pro is personal and follows the account into its other workspaces, so membership of a Teams workspace elsewhere does not block Pro. This matches what Billing shows.
3. **The account webhook path only lets the stored subscription end the plan.** An event that is not paid and is for a different subscription than `accounts.subscription_id` is acknowledged and ignored. A paid event for a different subscription while the account is already Pro still updates the account and records a critical `billing_webhook:duplicate_subscription` operational event for the owner.
4. **A plan's scheduled end is stored, not fetched.** `subscription_cancel_at` on `accounts` and `organizations` holds Stripe's `cancel_at` (or the period end when only `cancel_at_period_end` is set) while the plan is paid, and is NULL otherwise. It moves to the workspace in a Pro-to-Teams conversion. `subscription_ends_at` keeps its meaning (current period end).

## Alternatives considered

- Trusting only our database in the checkout guard: rejected, it misses webhook delay and the past-due case.
- Allowing checkout when the Stripe read fails: rejected, a duplicate charge is worse than asking the customer to retry.
- Reading the cancellation date from Stripe on each account load: rejected, it slows every load and adds a failure mode.
- Reusing an open Checkout Session instead of creating another: not done; rare path, extra Stripe calls. Stripe's "Limit customers to 1 subscription" setting is the backstop.

## Consequences

- The Stripe dashboard setting "Limit customers to 1 subscription" should stay on, pointing at `/dashboard/settings?tab=billing`.
- The migration that adds the columns must be applied before the code that writes them is deployed.
- Account closure still cancels only the stored subscription ID; the duplicate incident is what tells the owner about any other.

## Amendment (2026-10-07, same day)

Plan: `.ai/plans/2026-10-07-teams-subscription-guard-and-trial-end.md`. Implemented; see that plan for release state.

1. **Workspaces follow the same rule as accounts.** In the webhook, only `organizations.subscription_id` ending can end a Teams plan, and a second paid Teams subscription records the same `duplicate_subscription` incident. This supersedes the consequence above that said the Teams path had no guard.
2. **Free-to-Teams checkout asks Stripe about both customers**, the account's own and the workspace's, and refuses when either has a live subscription or Stripe cannot be read. The Pro-to-Teams conversion is unchanged.
3. **A trial's end is stored on the account** as `subscription_trial_ends_at` while the Stripe subscription is `trialing`. The app does not know whether a card is on file, so the Billing wording is true either way. A workspace that converts to Teams during the free month does not show a trial date.
