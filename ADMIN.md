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

Maintenance (/admin/maintenance) sits in the Operations group; see "Maintenance" below.

Admin uses a left sidebar grouped as Operations, Customers, Growth & Content, and Security. `Growth`
sits in Growth & Content alongside Requested Questions, Customer Outreach, and Updates. Below the `lg`
breakpoint the same sidebar becomes a slide-over opened from the header. Routes are unchanged; several nav
labels intentionally differ from their URL (`Seller Progress` → `/admin/abandonment`, `Workspaces` →
`/admin/organizations`, `Customer Outreach` → `/admin/testimonial-candidates`).

## Refresh behavior

The shared admin toolbar refreshes the overview, Issues & Triage, Requests and Seller Progress
every 30 seconds, and Feedback every 60 seconds. Users, Workspaces, Growth, Telemetry and Audit
Logs refresh when returning to the tab. These automatic pages also refresh when connectivity
returns. Other pages, including detail pages and editing tools, refresh manually.

Refresh preserves the current URL (including filters and pagination), scroll and unaffected client
state. Automatic reads are skipped while hidden or offline and overlapping refreshes are prevented.
Open dialogs, inline triage/feedback editors, focused inputs and unapplied native form filters block
both automatic and toolbar refreshes. Finish or cancel editing to resume. The timestamp records
completion of a toolbar refresh transition; it is not a database event timestamp. Existing action
buttons retain their own post-save refresh behavior. No background polling is added outside admin.

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
- **AI runs** groups by feature, outcome, model and prompt version using run time. Average and continuous p50/p95 pipeline latency include only non-cache rows with nonnegative timings, with a timed sample count. Unknown model/prompt cohorts remain labelled unknown. Time includes retries but excludes observation persistence and full HTTP/browser time. Customer runs require retained, non-demo requests owned by user accounts; unavailable data and empty results differ.
- **AI usage** includes every recorded fresh run, including demo/admin/unlinked runs. Each token total has its own reporting sample count; no metadata renders Unknown, measured zero renders 0. Pass counts exclude transport retries. Timeout/other-failure counts are runs with a first recorded failure, including recovered runs, not failed-call counts. Search counts are reported metadata totals with coverage, not billed searches. Old zero rows may mean omitted metadata; no historical zero reclassification is possible. Usage and token-only cost estimates are lower bounds, not invoices.
- **Submission choices** groups current provider entries on retained customer requests first metered in the window by the first recorded suggestion result before submission. Generated/served results do not establish browser impressions or that the selected provider came from that exact list. Missing observations use an unrecorded bucket. Unknown/not-applicable entries are excluded. Corrections can change current entries; the acceptance proxy is not immutable or verified accuracy.

The source is existing `intake_links`, `requests`, `event_logs`, `utility_entries` and
`ai_generation_runs` data, queried under `lib/neon/queries/admin-telemetry.ts`. The AI usage table
reads the columns added by `migrations-ai-usage-telemetry.sql`; the page reports "temporarily
unavailable" until that migration is applied. Records deleted
through existing lifecycle policies stop contributing; this is not an immutable historical warehouse.
Friday's saved-form release provided request attribution, but not dedicated create/duplicate/copy-link
action history. Vercel browser analytics is a separate source and is not imported into this page.
Growth activation, acquisition and referral conversion now use retained non-demo requests with `metered_at`, regardless of current status. Habit is at least three first-metered requests in 30 days. Legacy submitted rows lacking metering use `last_activity_at` as an explicit estimate; untimed legacy rows remain unknown. Reopen/correction does not move modern activation time. Deleted records stop contributing; this is not an immutable account history. Matching activated/habitual Users filters use the same predicate.

Seller Progress uses retained, non-demo user-owned requests consistently. Its last seller evidence is an allowlist of open/suggestion/search/self-link endpoint events in the current creation/reopen cycle, separate from operator/technical timestamps. Unknown observations have their own count and stay out of age buckets. Suggestion fetches are generated/served evidence, not completed browser steps. The page also shows the last step each seller's browser reported viewing, and the last reported submit problem, from the Slice 5 diagnostic observations: each request counts once at its last reported step in its current editing session, and the card states how many in-progress requests have any report. A request without a report is unknown, not stuck; reports are advisory, can be blocked or lost, and exist only for activity after this version is deployed. Fields and limits: `docs/telemetry-privacy.md`. Categories are deduplicated per request; the detail table is capped at 200, totals are uncapped. Queries authorize before reading; failed reads render unavailable, not zero. Legacy overview request freshness still uses mutable request activity and is a different measure.

### AI lineage v2

Slice 8 adds an aggregate panel separating producing generations, server-served
consumers by fresh/shared/cache delivery, distinct retained browser exposure/item
acknowledgments and immutable accepted choices. First submission and reopen are
separate cohorts. Cache origins retain source/model/prompt and common/no-list
outcomes. Legacy current-entry proxies remain separately labelled, without
inferred backfill. Missing migration and unavailable reads differ from empty/zero.
Authorization, customer/demo/deletion filters and aggregate-only DTOs remain.

Render evidence is advisory committed DOM, not attention, accuracy or causation.
Linked selections without a retained item acknowledgment are shown separately;
lost acknowledgments are unknown. Browser evidence expires after 90 days; server
exposures/choices independently after 365 days, cascading on request deletion.

SDK attempt counts include recovered failures. Each usage metric shows its
reported/started attempts, available lower-bound sum and complete generation
count. Estimates use existing prices and 2026-10-12-standard-list-v1; incomplete
usage, truncation or unknown prices keeps total unknown. Reported query arrays
are not billed searches. Disabled/reached-skip contact coverage does not inflate
model-call or failure denominators. Migration execution requires separate owner
authorization; local implementation implies no hosted change.

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
- `activation=habitual` matches accounts with 3 or more first-metered live requests in the last 30 days (timed legacy submitted fallback).

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
  unknown outcome, and scheduled jobs that failed, partly failed, have no finish after the running grace or are overdue. Each shows why it
  exists, first and last occurrence, count, whether a later success was observed, and a next step.
- **Evidence**: reminder email counts for 30 days, three daily jobs plus the Operations monitor heartbeat, per-collector last retained record timestamps, and a plain statement of
  what the page can and cannot establish. A separate card covers completion and invitation email
  (accepted, rejected, unknown, nobody eligible, partial sends, delivery, attachment outcome) and
  sheet PDFs (produced, failed by stage, expected skips, typical and slow duration, size) for live
  requests over 30 days. It states when recording began and that an empty store is not proof of health.
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

AI health: when half or more of at least 10 fresh AI runs of one feature end badly within 24 hours
(suggestions on the generic list; search or contact lookups failing at the model call), the monitor
job records an `ai` service issue here. Rules and thresholds: `docs/ai-telemetry.md`, AI Health
Observation.

Data sources (all additive; see the runbook's source table for blind spots):
`operational_events`, `job_runs`, `ops_alert_state` (`migrations-operational-events.sql`; the `ai`
category is allowed by `migrations-ai-usage-telemetry.sql`),
`reminder_operations` (`migrations-reminder-operations.sql`), `admin_triage_items`
(`migrations-admin-triage.sql`), `notification_observations` and `pdf_render_observations`
(`migrations-handoff-evidence.sql`; decision
`.ai/decisions/2026-10-13-handoff-notification-evidence.md`). Metadata is an allowlist of short scalars; no tokens, seller answers,
email bodies, provider payloads or raw exceptions are stored or shown.

Limits that are deliberate:

- It cannot detect a database or site outage, because it needs the database to load. That needs an
  external uptime probe, which is documented but not provisioned.
- Reminder, completion and invitation email have delivery evidence once the webhook is registered.
  Other email has none. Completion and invitation evidence is best effort and starts at release.
- A PDF failure is tied to a request once the packet link or id has resolved to one. A failure
  before that has no request.
- All four jobs scheduled in `vercel.json` are monitored. Daily overdue uses the shared override (default 26 hours); the monitor uses 15-minute interval + 20-minute grace (one missed run stays quiet; two in a row alert). Running beyond 15 minutes is labelled missing finish/stuck. Never observed stays unknown. Latest recorded outcome and partial coverage remain explicit. The weekly summary is unscheduled and
  is never reported overdue.
- Alerts, the delivery webhook and retention require owner activation (runbook section 5.5). The Retention card shows the mode (off, preview, enforce), each rule's window and what the last daily run counted or removed. Once enforced, older history on Seller Progress, Telemetry and request pages shows as unknown, not as no activity. The monitor source schedule already exists; hosted execution and external uptime/heartbeat checks remain unverified.


Slice 7 monitoring coverage: collector timestamps show the last retained PDF, billing, email and AI operational observation, AI execution record, seller browser diagnostic and tracked reminder operation. They provide no denominator or collection-rate claim. Failed reads render unavailable rather than zero. Monitor AI read failure or observation-write failure marks its run partial; empty AI windows do not establish recovery. Alert provider acceptance is counted separately from a failed alert-state write (later duplicate possible). Its current start is excluded from its own alert evaluation so previous partial/failed/stuck evidence remains visible. No external probe, destination or responder is verified by this local implementation.

## Maintenance

`/admin/maintenance` turns maintenance mode on and off. Decision:
`.ai/decisions/2026-10-13-maintenance-gate.md`. Strict paused-cutover procedure, if ever wanted:
`docs/maintenance-cutover-runbook.md`.

- **What it pauses**: sending a seller form, provider suggestions and lookup, the seller's "email me
  this link", and sheet PDF downloads. Each answers a marked 503 before its rate limiter and any side
  effect. Everything else keeps working, including viewing completed sheets, the dashboard, request
  creation, reminders, billing, webhooks and scheduled jobs.
- **What people see**: a "paused for maintenance" screen on new seller and reusable-link visits, a
  notice inside an already-open form (answers stay in the seller's browser and are never resent for
  them), a pause notice on PDF downloads, a banner in the customer dashboard, and a banner on every
  Admin page so the pause is not left on by accident.
- **Estimate**: optional, chosen as minutes from now. It is shown only while still in the future.
  Nothing reopens by itself.
- **Speed**: a change reaches the whole site within about 10 seconds (each server instance caches the
  switch that long). No deployment is needed.
- **Storage**: one row in `maintenance_state` (`migrations-maintenance-state.sql`). If that table is
  missing the switch reads as off and the page says it is not installed.
- **Write rules**: Admin only, respects `ADMIN_WRITES_DISABLED`, one confirmation to turn on, none to
  turn off, reason optional (it changes no customer record and sends no email). Each change writes
  `maintenance_enabled`, `maintenance_updated` or `maintenance_disabled` to the audit log in the same
  statement; a repeat of the current state writes nothing.
- **Hosting override**: `MAINTENANCE_MODE` set in hosting forces the pause on for that deployment and
  cannot be ended from this page. It needs a redeploy to change, and is the fallback if Admin writes
  are disabled or the database is unreachable.
- **Limit**: if the database cannot be read, the last known answer is kept for that server instance,
  otherwise the switch reads as off. The paused endpoints need the database themselves.

## Account Entitlement Overrides

The user-management **Entitlement override** changes the account's UtilitySheet access record only; it does not create, cancel, or modify a Stripe subscription.

- Entitlement overrides require an admin reason and are recorded in `admin_audit_logs`.
- Server authorization, policy checks, Team-workspace blocking, and `ADMIN_WRITES_DISABLED=true` remain in force.

## Impersonation
Impersonation is intentionally disabled by default (and hidden from the UI).

- The banner is gated behind `ADMIN_ENABLE_IMPERSONATION=true`.
- A true “support-mode” impersonation flow is not implemented yet.

## Request page: email and PDF evidence

`/admin/requests/[id]` lists what was recorded about that request's invitation email, completion
email and PDFs (newest 25 of each), above the technical event history. Recipients appear as
"recipient 1 of 2", never as addresses; provider message IDs are not shown. Each email line gives
the send outcome, the provider's delivery report when one was received, and the attachment outcome.
Each PDF line gives the outcome, the failed stage or expected skip, duration and size. Nothing
listed means unknown, not that nothing was sent. Read-only: there is no resend or retry here; seller
reminders remain the audited action on the same page.
