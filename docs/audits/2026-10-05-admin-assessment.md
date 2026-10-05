# Admin assessment for the owner

Date: 2026-10-05. Source reviewed: main at 84f984c. Read-only assessment; no application or live changes.

## Verdict

A strong early-stage operator foundation. Customer/request/workspace search and drilldowns, guarded writes, readable audit evidence, separate daily operations and growth reports, and carefully defined telemetry are all valuable. The next investment should improve detection and resolution of failures, rather than add more aggregate charts.

## Confirmed strengths

- Admin layout authenticates server-side; reviewed support actions independently require Admin, a reason, and the write safety catch.
- Role policies block self-ban/self-demotion, protect the last Admin in the sequential case, and disallow promotion through the ordinary user-management flow.
- Product Update publication and testimonial outreach have explicit review/confirmation controls; impersonation is disabled by default and documented as incomplete.
- Overview links to useful filtered lists; requests expose lifecycle events; account pages combine requests and audit context.
- Telemetry documents cohorts, denominators, exclusions, missing data and limitations. Existing SQL tests exercise real PGlite queries.

## Priority findings and recommendations

1. **Make support writes and their audit evidence reliable together.** In `app/(admin)/admin/users/actions.ts` and `app/(admin)/admin/requests/actions.ts`, mutation precedes a separate audit write. A later failure can return an error after the change already succeeded. Use a database transaction for local mutation plus audit evidence; test audit failure/rollback. For external email effects, persist an operation identity and outcome and make retries idempotent; a database transaction alone cannot roll back an email.
2. **Harden seller reminders.** `sendSellerReminderAdminAction` accepts deleted requests via `includeDeleted: true`, checks for an email but does not reject already-submitted/deleted requests or enforce a cooldown. The email helper calls Resend without an idempotency key and the action logs only after sending. A logging failure followed by an operator retry can duplicate email. Add explicit eligibility, recent-send visibility, deliberate exceptions where justified, and safe retry behavior. Unlike testimonial outreach, its dialog does not show the actual message body.
3. **Clarify Paid.** `lib/admin/operations-overview.ts` counts customer accounts with Pro access or an active Team workspace. Complimentary overrides can count, and several members can represent one subscription. Rename this figure to paid-plan access/accounts, or show a separately defined Stripe-backed paying-customer count. Do not use it to derive revenue. A link to the relevant Stripe record and visibility into billing/access mismatches would be useful; a full billing console is unnecessary.
4. **Turn Needs attention into a manageable queue.** Current chips describe cumulative inactive sellers, unstarted accounts and missing defaults. Add acknowledgement/resolution/snooze and a short support note if the owner is repeatedly investigating the same records. Separate urgent service failures from ordinary customer inactivity; inactivity alone is not an incident or a reason to contact a seller.
5. **Surface operational failures and send actionable alerts.** No central Admin view was found for email delivery failures, PDF failures, billing webhook failures or job freshness. `app/api/health/route.ts` executes a database probe but only checks AI/rate-limit configuration. It cannot establish that the seller-to-packet workflow is working. Verify external monitoring first, then add a compact failure view or links to existing tools rather than duplicate them. Resend supports delivery/bounce/complaint events: https://resend.com/blog/webhooks .
6. **Define status correction semantics.** Admin's generic status selector calls `updateRequestStatus`, which changes status and activity time only. Selecting submitted does not perform the normal submission workflow or set `metered_at`, while telemetry uses `metered_at` as first-submission evidence. Explicitly distinguish a display-status repair from a true submission; validate transitions and inputs on the server. Do not simply set metering timestamps in Admin without considering quota and downstream behavior.

## Operational practices to verify outside the repository

- MFA and recovery access for privileged provider accounts, a written incident response path, alert recipients and thresholds, and a tested database restore procedure.
- Verify the actual Neon restore window and rehearse recovery into an isolated branch; provider capability is not proof the project's recovery is configured or tested. Background: https://neon.com/blog/announcing-point-in-time-restore .
- A daily review of real failures and customer support; weekly activation, completion, repeat use and customer feedback; monthly actual revenue, cancellations and operating costs.
- Start with links to existing provider tools and a short runbook. Defer broad impersonation, bulk writes, custom accounting, or a full internal ticketing system until demonstrated need.

## Validation and limits

- 48 tests passed across six files using Node 20: admin-policies, admin-sensitive-actions, admin-operations-overview, admin-operations-dashboard, admin-telemetry and admin-telemetry-page.
- Source review, not an authenticated browser/visual review, full security audit, production configuration inspection or live data analysis. No claim that external alerts, MFA or backups are absent.
- Tests demonstrate existing coverage; they do not establish that the identified partial-failure paths are covered or safe.
- Assessment complete. Implementation suggestions are optional follow-up requiring a new scoped task; no required assessment work remains.
