# Admin Panel (UtilitySheet)

## Routes
- `/admin` business totals, recent request and signup activity, standing backlogs, and request lifecycle
- `/admin/operations` service issues, reminder email evidence, scheduled job status, customer follow-up and triage (nav label `Issues & Triage`)
- `/admin/users` user search, account inspection, and audited controls
- `/admin/requests` request search, lifecycle inspection, and audited support actions
- `/admin/growth` activation funnel, acquisition sources, and packet referral instrumentation
- `/admin/telemetry` saved-form inventory and usage, request-event counts, and AI run summaries (7/30/90 days)
- `/admin/question-requests` read-only triage of seller-form questions customers requested but could not find
- `/admin/feedback` customer feedback inbox: messages from the dashboard Feedback button with page context, and an audited review status (nav label `Feedback`, under Customers)
- `/admin/organizations` workspace search and Team/personal workspace totals; Team organizations are distinguished from personal/default workspaces in Admin copy. A workspace's page (`/admin/organizations/[id]`) is read-only: members, seats in use (members plus pending invitations, with a warning when members exceed seats), the date a plan is set to end, why and when a Teams plan stopped, and every invitation sent with its status (the join token is never read)
- `/admin/abandonment` seller-progress monitoring (route retained for compatibility). Requests a coordinator reopened are counted like any in-progress request and their rows are marked Reopened.
- `/admin/testimonial-candidates` customer outreach and advocacy-candidate review (route retained for compatibility)
- `/admin/updates` draft, review, publication, and deletion of customer-facing Product Updates
- `/admin/audit-logs` audit log viewer

## Navigation

Admin uses a left sidebar grouped as Operations, Customers, Growth & Content, and Security. `Growth`
sits in Growth & Content alongside Requested Questions, Customer Outreach, and Updates. Below the `lg`
breakpoint the same sidebar becomes a slide-over opened from the header. Routes are unchanged; several nav
labels intentionally differ from their URL (`Seller Progress` → `/admin/abandonment`, `Workspaces` →
`/admin/organizations`, `Customer Outreach` → `/admin/testimonial-candidates`).

## Overview and Growth Split

`/admin` carries only what an operator checks daily: total customer accounts, accounts with paid-plan access, total
requests, seller submissions in the last 7 days, the newest requests and signups, the standing backlog
chips, and the request lifecycle bar. Analysis that is consulted occasionally lives on `/admin/growth`:
the full activation funnel, acquisition sources, and packet referral instrumentation. Adding a metric to
`/admin` means removing one, or it belongs on `/admin/growth`.

The backlog chips on `/admin` are headed **Customer follow-up backlog**. They are cumulative
totals, not failures. Service problems and triage live on `/admin/operations`; no metric was added to
the overview for them.

### Paid-plan access is not paying customers

The figure labelled **Paid-plan access** (overview, Growth, Users, Requested Questions) counts customer
accounts with a Pro entitlement or an active workspace on Team. Complimentary overrides count, and
every member of a Team workspace counts separately, so two Team members are two access accounts on one
subscription. It is not a count of paying subscriptions and must not be used to derive revenue. Use
Stripe for revenue. The internal names (`paid_accounts`, `plan=paying`) are unchanged.

Account and workspace detail pages show the account entitlement and the workspace entitlement
separately, plus a **Billing context** card from `lib/admin/billing-context.ts`:

- It states what is stored and what that does not prove. A stored Stripe subscription ID is not proof
  of an active, paid subscription.
- A missing Stripe ID is not flagged for complimentary Pro or Team-managed accounts. Only stored data
  that disagrees with itself is highlighted for review.
- Stripe customer and subscription IDs link to the Stripe dashboard only when the ID is well formed
  and the dashboard mode can be read from this environment's Stripe key prefix. Otherwise the ID is
  shown as text. Nothing calls Stripe, and there is no MRR calculation or automatic repair. A live
  Stripe comparison would be an optional later read-only integration.

Business totals come from `lib/admin/operations-overview.ts`. Its `paid_accounts` predicate deliberately
mirrors the `paid_accounts` predicate in `lib/admin/activation-funnel.ts` and the `plan=paying` list
filter, so the overview, the growth funnel, and the user list cannot disagree. Both modules count only
`role = 'user'` accounts.

## Telemetry

`/admin/telemetry?days=30` supports rolling 7, 30 and 90 day windows (30 by default).
Queries authorize with `requireAdmin` before database access and render dynamically. The page shows
aggregates only; it never reads event payloads, seller answers, form names/intros, or capability tokens.

- **Inventory** is a current snapshot of forms owned by `role = 'user'` accounts, including paused and
  automatically provisioned forms. Multiple-form adoption counts distinct accounts with at least two
  forms within one creator/workspace scope; separate workspace defaults do not count. The adoption
  denominator is accounts with forms, not all accounts or paid/eligible accounts.
- **Actual use** is a cohort of requests created within the selected rolling window, excluding demo,
  deleted and admin-owned requests. Distinct `source_form_id` values measure used forms. Multiple-form
  users have requests from at least two forms in the same creator/workspace scope. Completion counts
  attributed requests with `metered_at` present as of viewing, divided by attributed requests; this is
  not the count of submissions arriving during the window. NULL provenance remains unattributed.
- **Request events** counts event occurrences and distinct requests by event type, using event time,
  including events on older requests. The top 50 types are shown. Repeated events are not unique users.
- **AI runs** groups recorded runs by feature and outcome using run time, counts cache hits, and averages
  latency across fresh runs only. Both event and AI summaries require a retained, non-demo customer
  request; unlinked AI runs are excluded. No observations and unavailable data have different states.

The source is existing `intake_links`, `requests`, `event_logs`, and `ai_generation_runs` data, queried
under `lib/neon/queries/admin-telemetry.ts`. No new collection or migration is required. Records deleted
through existing lifecycle policies stop contributing; this is not an immutable historical warehouse.
Friday's saved-form release provided request attribution, but not dedicated create/duplicate/copy-link
action history. Vercel browser analytics is a separate source and is not imported into this page.
Growth and Seller Progress retain their existing reports. Future telemetry sections should define
their cohort, denominator, timestamp, exclusions and privacy rules just as explicitly.

### Product usage reports

The same page adds these database-backed reports, without new collection or migrations:

- **Seller completion:** real requests created within the selected window; distinct recorded opens,
  first submissions (`metered_at`), and median hours from first recorded open to first submission.
  Only nonnegative, matched intervals contribute to the median; the sample count and completions
  without recorded opens are shown. Endpoint access is not verified human viewing, and elapsed time
  is not active form-filling time. Recent cohorts have less opportunity to complete.
- **Workflow preferences:** earliest recorded `request_created` event classifies reusable intake
  (`source=intake_link`) or agent creation (`actor=agent`), otherwise unknown. Only these allowlisted
  metadata fields are read. Current request mode and distinct enabled modules show configuration
  usage, not whether sellers answered a section. Module percentages use Handoff Packet requests.
- **Provider assistance outcomes:** current utility entries on requests first submitted in the
  selected window (regardless of creation date), grouped by category and entry method. Each category's
  denominator includes unknown, NULL/unclassified and not-applicable entries. This measures final
  entry-method mix, not AI impression acceptance. Later edits can change results; names/text are not read.
- **Repeat usage:** distinct accounts creating real requests in adjacent equal rolling windows;
  returning accounts belong to both, divided by the previous window's accounts. This is request
  creation activity, not login retention or weekly cohort retention.
- **Follow-up/corrections:** distinct requests in the creation cohort with reminders, seller return
  link sends or edits after first submission. Completion after reminder requires the first submission
  to follow the earliest reminder; its denominator is reminded requests. Edit rate uses submitted
  requests. Neither sequence nor association establishes causation.
- **Test-drive conversion:** accounts whose earliest recorded completion of an explicitly marked
  self-serve demo falls within the window; count those with a later real submission through now.
  Other demos are excluded; repeated submissions do not reset the first-completion cohort. Follow-up
  time varies and this is not evidence of a causal lift. Retained-record limitations still apply.

Zero denominators and missing timing samples display a dash. All reports use customer-owned retained
records; real-use reports exclude demos/deleted requests. Test-drive analysis is the explicit exception
for marked demos. Counts reflect records through viewing time and respect existing deletion policies.

## List Filters

Every clickable metric on `/admin` and `/admin/growth` links to a list filtered to the rows it counted.
The predicates behind these filters mirror `lib/admin/activation-funnel.ts` and
`lib/admin/operations-overview.ts`; changing one side requires changing the other.

`/admin/users` accepts `q`, `role`, `plan`, `activation`, `sort`, `dir`, `page`, `pageSize`.

- `plan=paying` matches a Pro entitlement override **or** an active workspace on Team billing. It is
  deliberately broader than `plan=pro`.
- `activation=no-setup` matches accounts with no completed onboarding and no non-deleted, non-demo request.
- `activation=missing-defaults` matches accounts missing an active workspace, brand profile, or intake link.
- `activation=activated-7d` matches accounts whose first live seller submission landed in the last 7 days.
- `activation=habitual` matches accounts with 3 or more submitted requests in the last 30 days.

Overview links to these filters also carry `role=user`, because the activation funnel counts only
`role = 'user'` accounts.

`/admin/requests` accepts `q`, `status`, `activity`, `page`, `pageSize`. The `activity` windows (`7d`, `30d`,
`stale7d`, `stale30d`) are measured over `COALESCE(metered_at, last_activity_at, created_at)`.

`/admin/organizations` accepts `q`, `billing`, `page`, `pageSize`. The `billing` filter (`team`, `non-team`)
matches the workspace's own subscription status and is narrower than the displayed workspace kind, which
also considers member count. The Team and personal/default workspace totals in the page header are
unfiltered and use the same subscription-status predicate as `billing`.

## Guardrails
- Every Admin write is recorded to `admin_audit_logs`.
- Writes that change a customer's account, access, request or seller contact, or that send email,
  require a **reason** (3 to 500 characters): role and ban changes, entitlement overrides, request
  status and seller contact corrections, seller reminders, signup reconciliation and testimonial outreach.
- For writes that touch no customer record the reason is **optional** (owner decision, 2026-10-05,
  `.ai/decisions/2026-10-05-optional-admin-reasons.md`): Product Updates, Operations triage and
  feedback status. They are still audited, and Product Update publication and deletion still need
  the explicit confirmation.
- Set `ADMIN_WRITES_DISABLED=true` to hard-disable admin write actions (useful as a "safety catch" in production).
- Client confirmations and disabled buttons improve operator safety, but server actions remain authoritative for Admin authorization, input validation, policy checks, audit logging, and the write safety catch.

### Write semantics

Decision record: `.ai/decisions/2026-10-05-admin-atomic-writes-and-status-corrections.md`.

- **Validated at the boundary.** Every Admin action parses its arguments with the Zod schemas in
  `lib/validation/admin-schemas.ts` (IDs, enums, seller contact fields, reasons, confirmations).
- **Atomic with evidence.** Each write in `lib/neon/queries/admin-writes.ts` is one statement that
  changes the record and inserts its audit entry and any request timeline event. If the audit or
  timeline insert fails, the change rolls back. A missing database is an explicit failure.
- **Stale edits are refused.** Actions carry the value the operator saw (`expectedRole`,
  `expectedPlan`, `expectedStatus`, the seller contact). If it no longer matches, nothing is saved and
  the operator is told to refresh.
- **Policy is enforced in the database statement**, including that the actor is still an admin,
  self-protection, Team-managed entitlement, closing accounts and last-admin protection. Role changes
  are serialized, so two admins demoting each other cannot both succeed.
- **Blocked policy attempts are audited** with `blocked: true`. Stale edits, no-ops and missing
  targets write nothing.
- **Errors are safe.** Refusals have stable codes. Unexpected failures show a short reference and log
  the detail server-side. A failed cache refresh after a commit is not reported as a failed write.

| Entry point | Semantics |
| --- | --- |
| Demote, ban, unban | Atomic role change. Promotion to admin is disabled here. Refused for closing or closed accounts. |
| Entitlement override | Atomic. Free and Pro only. Refused for Team-managed accounts. Never touches Stripe. |
| Request status correction | Atomic, support-only. See below. |
| Request seller contact | Atomic. Refused for deleted requests. Does not reset seller activity time. |
| Seller reminder | Durable operation with shared cooldown. See below. |
| Product Updates | Atomic draft creation, publication and deletion. |
| Manual signup reconciliation | Reason and confirmation required. Attempt audited before, count-only outcome after. Not atomic across accounts, and says so. |
| Testimonial outreach | Unchanged: own outreach log, resend guard and provider idempotency key. |
| Triage (`/admin/operations`) | Atomic with audit, versioned. Never changes the source record. |
| Feedback status (`/admin/feedback`) | Atomic with audit, versioned, reason optional. Internal only: never contacts the customer or changes the message. The audit entry holds neither the message nor the private note. |
| Impersonation | Disabled and not implemented. Must adopt the atomic pattern before it is ever enabled. |

## Customer Feedback

- The dashboard Feedback dialog posts to `/api/feedback`, which stores a row in `feedback_submissions`
  (`migrations-feedback-submissions.sql`) and then sends a notification email to `FEEDBACK_EMAIL`. The
  row is the record. The request succeeds if either the row or the email succeeded, and the inbox flags
  rows whose email notice failed.
- Each row carries the account, active workspace, optional type (bug, idea, question), page path
  without query string, viewport and user agent. Account and workspace are resolved on the server.
- Reply to the customer from the notification email (reply-to is their address). Status (new, reviewed,
  resolved) and the private note are internal only.
- Messages are customer free text. Do not copy them into logs, analytics, audit metadata or AI tools.
- Until the migration is run the page says the inbox is not installed and feedback is email-only.
- Account closure deletes the closing account's feedback rows.
- Plan and decision: `.ai/plans/2026-10-05-feedback-inbox.md`,
  `.ai/decisions/2026-10-05-stored-feedback-and-admin-inbox.md`.

## Customer Outreach

- Testimonial outreach is limited to eligible paying customers and excludes internal, test, banned, and Admin accounts.
- Before a real send or resend, Admin shows the recipient, exact message preview, candidate-selection reasons, required Admin reason, and explicit confirmation.
- Test-to-self sends also require a reason and explicit confirmation because they are external email writes.
- Send attempts retain the existing outreach log, resend guard, provider idempotency key, and Admin audit entry. There is no reason-policy exception for testimonial outreach.

## Product Updates

- New Product Updates are always created as drafts and are not visible to customers until a separate publish action succeeds.
- Draft creation, publication, and deletion each create a distinct `admin_audit_logs` entry. The Admin reason is optional and is stored in that entry when given.
- Publication and deletion require an exact-content preview plus explicit confirmation. Each commits together with its audit entry. Publishing an already-published update is a truthful no-op with no second audit entry and no new publication time; deleting an already-deleted update reports that it was not found.
- Product Update writes are covered by the optional-reason rule in Guardrails. The confirmation step is not optional.

## Audit Evidence

- The default Audit Logs view prioritizes a human-readable action summary, timestamp, actor, affected record, safe related-record links, and the Admin reason.
- User agent, IP address, record identifiers, and sanitized raw metadata remain available under collapsed technical evidence.
- The viewer redacts values under secret-like metadata keys. Stored audit evidence is not rewritten or deleted by the viewer.

## Request Admin Actions
On `/admin/requests/[id]`:
- Correct request status
- Edit seller contact info
- Send reminder email to seller

Each action writes an audit log entry and a request `event_logs` entry in the same statement as the change. None of them is available for a deleted request.

### Status corrections are not submissions

`metered_at` is the only authority for a first seller submission. A correction changes the displayed
`status` and nothing else: it never sets or clears `metered_at`, does not reset `last_activity_at`,
and does not consume quota, award referral credit, send a completion email or generate a packet.

| Request | Correction allowed |
| --- | --- |
| No recorded submission, Draft/Sent/In progress | Between Draft, Sent and In progress. Submitted cannot be chosen. |
| Recorded submission, Submitted | None. Use submitted-sheet editing. |
| Recorded submission, not Submitted | Restore to Submitted only. |
| Submitted with no recorded submission | None. Test drives are submitted without metering, and some older records may look like this. Review by hand; nothing repairs them automatically. |
| Deleted | None. |

The dialog explains which case applies. The customer-facing status route is unchanged.

### Seller reminders

Decision record: `.ai/decisions/2026-10-05-seller-reminder-operations.md`.

- The dialog shows the property, recipient, sender, reply-to, subject, the exact rendered message in
  a sandboxed frame, the last reminder and recent attempts. It requires a reason and explicit
  confirmation. If the recipient, branding or template changed after the preview was shown, nothing is
  sent and the operator reviews again.
- Admin reminders go only to requests that are not deleted, not submitted and have no recorded
  submission, with a valid seller email and an owner who is not banned or closing. Drafts are
  eligible. The one exception to the recorded-submission rule is a request a coordinator reopened
  for the seller (in progress, with an editing session above 0): it can be reminded, as the
  coordinator already can. There is no override for an ineligible request.
- A 10 minute cooldown per request is shared with the customer's own reminder button and enforced in
  the database, including against simultaneous clicks from two sessions. There is no override.
- Outcomes are distinct: **accepted by the provider** (not proof of delivery), **rejected, not sent**,
  and **outcome unknown** (timeout or provider fault). An unknown outcome blocks new reminders for
  that request for 24 hours, can be retried safely with the same provider key for 23 hours if the
  message is unchanged, or can be settled by hand as sent or not sent after checking the provider.
- If the provider accepted but recording failed, retrying the same attempt only completes the record.
- Delivered, bounced and spam-complaint evidence appears only once the Resend delivery webhook is
  registered. Reminders sent before this existed stay unknown.
- The reminder names the owning account or its Branding Profile contact as the agent, not the Admin.
- Requires `migrations-reminder-operations.sql`. Without it no reminder is sent and the dialog says so.

## Operations: issues, evidence and triage

`/admin/operations`. Decision record: `.ai/decisions/2026-10-05-operations-monitoring-and-triage.md`.
Procedures: `docs/admin-operations-runbook.md`.

- **Service issues**: unexpected packet PDF failures, verified billing webhook events that failed
  processing, completion email send failures, reminder bounces/complaints/failures, reminders with an
  unknown outcome, and scheduled jobs that failed, partly failed or are overdue. Each shows why it
  exists, first and last occurrence, count, whether a later success was observed, and a next step.
- **Evidence**: reminder email counts for 30 days, the three scheduled jobs, and a plain statement of
  what the page can and cannot establish.
- **Customer follow-up**: open requests with no seller activity for 7+ days and accounts that never
  started. These are not failures. Totals are raw counts that triage never changes, and they link to
  the existing filtered lists.
- **Triage**: acknowledge, snooze, resolve or reopen with an optional reason and an optional private plain-text
  note (maximum 1,000 characters; do not paste credentials or seller answers). Changes are audited
  and versioned. Resolving does not claim the failure recovered. An expired snooze or a new failure
  after resolution returns the item to the queue. A dismissed follow-up stays dismissed unless the
  record becomes active and goes quiet again.
- The page never renders a missing table or failed query as zero. It distinguishes not installed,
  could not load, no observations yet, stale and genuinely quiet.
- Expected outcomes are not incidents: invalid packet links, locked packets, rate limits and
  unverified webhook signatures.

Data sources (all additive; see the runbook's source table for blind spots):
`operational_events`, `job_runs`, `ops_alert_state` (`migrations-operational-events.sql`),
`reminder_operations` (`migrations-reminder-operations.sql`), `admin_triage_items`
(`migrations-admin-triage.sql`). Metadata is an allowlist of short scalars; no tokens, seller answers,
email bodies, provider payloads or raw exceptions are stored or shown.

Limits that are deliberate:

- It cannot detect a database or site outage, because it needs the database to load. That needs an
  external uptime probe, which is documented but not provisioned.
- Only reminder email has delivery evidence. Other email has none.
- PDF failures are not tied to a request, because the route only has the private packet link.
- Only the three jobs scheduled in `vercel.json` are monitored. The weekly summary is unscheduled and
  is never reported overdue.
- Alerts, the delivery webhook, the monitor schedule and retention pruning are all off until the
  owner activates them (runbook section 5.5).

## Account Entitlement Overrides

The user-management **Entitlement override** changes the account's UtilitySheet access record only; it does not create, cancel, or modify a Stripe subscription.

- Entitlement overrides require an admin reason and are recorded in `admin_audit_logs`.
- Server authorization, policy checks, Team-workspace blocking, and `ADMIN_WRITES_DISABLED=true` remain in force.

## Impersonation
Impersonation is intentionally disabled by default (and hidden from the UI).

- The banner is gated behind `ADMIN_ENABLE_IMPERSONATION=true`.
- A true “support-mode” impersonation flow is not implemented yet.
