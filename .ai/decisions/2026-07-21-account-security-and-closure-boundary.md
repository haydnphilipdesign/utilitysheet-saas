# Account security and closure boundary

- Status: Accepted
- Date: 2026-07-21
- Decision owner: Product owner, after repository-grounded approval gate
- Related plan: `.ai/plans/2026-07-21-account-settings-integration-review.md`

## Context

Stack Auth 2.8.56 supports verified contact channels, password changes, configured sign-in providers,
active-session listing/revocation, and server-side user deletion. UtilitySheet also owns Stripe billing,
workspace memberships and shared assets, public capability links, referrals, and retained audit/financial
records. Stack's direct user deletion does not coordinate those boundaries, and database account deletion
can cascade records that remain useful to other workspace members.

## Decision

UtilitySheet may expose only the approved non-destructive account slice for now:

- configuration-derived sign-in methods;
- recent-authenticated verified-email, password, and other-session controls;
- a no-store personal/application-data export that excludes secrets and unrelated members' records;
- a read-only closure readiness report.

Executable closure remains unavailable. Do not call Stack user deletion, cancel Stripe, delete or transfer
workspace assets, forfeit credits, tombstone an account, or revoke public capabilities until a separately
approved lifecycle defines retention, shared-asset transfer, billing completion, partial-failure recovery,
and external finalization.

## Consequences

- Sensitive Account APIs require a current Stack session created within five minutes and derive identity,
  account, workspace, role, and entitlement on the server.
- Passwords are submitted directly to Stack from the client and never cross a UtilitySheet API boundary.
- The focused `account_security_events` migration provides durable application audit records when applied;
  until separately authorized, security actions retain structured server-log fallback only.
- Primary-email reconciliation updates Stack, the UtilitySheet personal account, and the personal Stripe
  customer email. It never changes organization billing identity or Branding Profile contact fields.
- Closure readiness can identify blockers but cannot represent closure as available or perform a mutation.
