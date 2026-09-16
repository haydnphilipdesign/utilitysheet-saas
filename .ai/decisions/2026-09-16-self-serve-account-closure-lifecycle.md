# Self-Serve Account Closure Lifecycle

- Status: Accepted (owner approved 2026-09-16)
- Decision owner: Product owner; implemented by Claude Code
- Related plan: `.ai/plans/2026-09-16-account-closure-and-password-confirmation.md`
- Supersedes: the "executable closure remains unavailable" clause of `2026-07-21-account-security-and-closure-boundary.md`. All other parts of that record still apply.

## Context

A user can export their data but cannot close their account. Deleting the Stack Auth user alone would leave UtilitySheet records behind, and `ensureAccountRecord` would recreate the account on the next sign-in. Deleting the `accounts` row would cascade into shared workspace records. It is also blocked by `NO ACTION` references from `referral_credits` and `admin_audit_logs`.

## Decision

1. **Timing.** Closure is immediate and permanent. There is no recovery window, and support cannot restore deleted data. Before closing, the user may export their data, and must confirm recently, type their sign-in email, and acknowledge that closure is permanent.
2. **Billing.** Closure cancels the user's subscriptions in Stripe immediately, with no proration and no refund:
   - the user's personal Pro subscription;
   - the Team subscription of any workspace where the user is the only member.

   Team subscriptions of shared workspaces are not touched. Closure is blocked while any of those subscriptions is `past_due`, `unpaid`, or `incomplete`, and the user is sent to Billing to settle it first. UtilitySheet never deletes or edits Stripe customers, invoices, or balances.
3. **Shared work.** In a workspace that has other members, the user's requests and Branding Profiles for that workspace move to a remaining workspace admin that the user picks. The earliest-joined admin is preselected. If the user is the workspace's only admin, closure is blocked until they promote someone else.
4. **Retention.**
   - **Kept:** a pseudonymous `accounts` row (id, auth id, Stripe references, role, timestamps, closure state). Name, company, and phone are cleared, and the email becomes `closed+<id>@closed.utilitysheet.invalid`. The referral ledger, admin audit logs, account security events, and redacted AI telemetry are also kept.
   - **Forfeited:** unapplied referral credits (they get the status `forfeited`).
   - **Deleted:** everything else the account owns, as listed in the plan.
   - **Email:** a closure confirmation goes to the former address, best effort.
5. **Blocking.** An account in the `closing` or `closed` state never passes `ensureAccountRecord`, so it cannot be recreated or claimed. After closure, the same email can sign up as a brand-new account.

## Rationale

- Keeping a stub row avoids cascading into shared records and keeps the financial and audit links intact, while holding no contact details.
- Cancelling at closure removes a step the user would otherwise have to complete in the Stripe portal. Refusing closure while a balance is outstanding avoids walking away from an unpaid invoice.
- Letting the user choose who receives their shared work keeps that work under a known, current admin, so its public links and seller notifications keep working.

## Alternatives considered

- **A 14-day recovery window.** Rejected: it keeps personal and seller data live and needs a finalizer and a cancel path.
- **Waiting for the subscription to end, or requiring the user to cancel it first.** Rejected by the owner in favor of cancelling at closure.
- **Leaving shared records under the closed account.** Rejected: owner notifications would stop, and Free metering would count against a closed account.
- **Hard-deleting the `accounts` row.** Rejected: blocked by foreign keys, and it would cascade into shared records.

## Consequences

- Schema: `migrations-account-closure.sql` adds `accounts.closure_status`, `closure_requested_at`, and `closed_at`, the `account_closures` table, and the `forfeited` referral status. The migration must be applied before the feature is deployed.
- The Stripe webhook acknowledges non-paid subscription events whose organization no longer exists, instead of throwing.
- A cron retries stuck `closing` accounts. Support sees the closure state and can ask the user to retry. Deleted data cannot be recovered.
