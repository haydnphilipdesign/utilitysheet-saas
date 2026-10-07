# Teams seats are changed inside the app

Date: 2026-10-07. Status: Accepted (owner decision in chat on 2026-10-07, on the recommendation in `.ai/plans/2026-10-07-teams-plan-review.md`, slice 4). Builds on `.ai/decisions/2026-08-27-team-billing-ownership-and-workspace-isolation.md` and `.ai/decisions/2026-10-07-one-live-subscription-and-plan-end-date.md`.

## Context

Seats were chosen at checkout and changed only in the Stripe portal. The portal knows nothing about members, so an admin could lower seats below the number of people in the workspace: everyone kept access and the workspace paid for fewer seats, with nothing flagging it. Seats are otherwise enforced only when an invitation is created, renewed or accepted.

## Decision

1. **A workspace admin changes seats in Settings, Billing.** `POST /api/organization/billing/seats` applies the same rule as checkout: a whole number, at least the Teams minimum, and at least the seats in use (members plus pending invitations).
2. **The app changes the quantity on the existing Stripe subscription.** Same subscription, customer and billing date; prorations go on the next invoice (`create_prorations`), as the Pro-to-Teams conversion already does. The route first checks that the stored subscription is the workspace's own, is `active` or `trialing`, and has exactly one item at the Teams price; anything else is refused.
3. **Our seat count never runs ahead of what is paid for.** Lowering: the stored count is lowered first, under a lock on the workspace row with the seats-in-use check, then Stripe is updated; if Stripe fails the stored count is put back. Raising: Stripe is updated first, then the stored count. The webhook continues to write the count from Stripe in every case.
4. **No idempotency key on the quantity update.** Setting the same quantity twice is harmless, and a key would make a repeated change (4 to 5, back to 4, to 5 again) return a cached response without applying.
5. **Quantity changes are turned off in the Stripe "Teams Portal" configuration** (owner action in the Stripe dashboard). The portal keeps invoices, payment methods and cancelling.
6. **Seats below members is still detected.** If Stripe ever reports fewer seats than the workspace has members (a change made directly in Stripe), the webhook records a `billing_webhook:seats_below_members` operational event and Workspace & Team tells the admin. Access is not removed automatically.

## Alternatives considered

- Leave seat changes in the portal and only flag the problem: rejected, it leaves the hole open and depends on a portal setting the app cannot see.
- Charge the prorated amount immediately on an increase: rejected for now; an immediate off-session charge can need customer authentication, and the conversion path already defers prorations.
- Remove or suspend members automatically when seats are below members: rejected; removing someone's access is the admin's decision.

## Consequences

- The seat minimum and the price shown come from the same sources as checkout (`TEAM_MIN_SEATS`, `TEAM_PRICE_PER_SEAT_USD`). No pricing or minimum change.
- A workspace whose subscription is past due cannot change seats until the payment is fixed in the portal.
- If the portal setting in item 5 is left on, both ways work; the detection in item 6 covers the gap.
