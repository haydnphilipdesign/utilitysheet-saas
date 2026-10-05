# Admin Panel (UtilitySheet)

## Routes
- `/admin` business totals, recent request and signup activity, standing backlogs, and request lifecycle
- `/admin/users` user search, account inspection, and audited controls
- `/admin/requests` request search, lifecycle inspection, and audited support actions
- `/admin/growth` activation funnel, acquisition sources, and packet referral instrumentation
- `/admin/telemetry` saved-form inventory and usage, request-event counts, and AI run summaries (7/30/90 days)
- `/admin/question-requests` read-only triage of seller-form questions customers requested but could not find
- `/admin/organizations` workspace search and Team/personal workspace totals; Team organizations are distinguished from personal/default workspaces in Admin copy
- `/admin/abandonment` seller-progress monitoring (route retained for compatibility)
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

`/admin` carries only what an operator checks daily: total customer accounts, paying accounts, total
requests, seller submissions in the last 7 days, the newest requests and signups, the standing backlog
chips, and the request lifecycle bar. Analysis that is consulted occasionally lives on `/admin/growth`:
the full activation funnel, acquisition sources, and packet referral instrumentation. Adding a metric to
`/admin` means removing one, or it belongs on `/admin/growth`.

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
- Admin write actions require a **reason** (min 3 chars) and are recorded to `admin_audit_logs`.
- Set `ADMIN_WRITES_DISABLED=true` to hard-disable admin write actions (useful as a “safety catch” in production).
- Client confirmations and disabled buttons improve operator safety, but server actions remain authoritative for Admin authorization, reason validation, policy checks, audit logging, and the write safety catch.

## Customer Outreach

- Testimonial outreach is limited to eligible paying customers and excludes internal, test, banned, and Admin accounts.
- Before a real send or resend, Admin shows the recipient, exact message preview, candidate-selection reasons, required Admin reason, and explicit confirmation.
- Test-to-self sends also require a reason and explicit confirmation because they are external email writes.
- Send attempts retain the existing outreach log, resend guard, provider idempotency key, and Admin audit entry. There is no reason-policy exception for testimonial outreach.

## Product Updates

- New Product Updates are always created as drafts and are not visible to customers until a separate publish action succeeds.
- Draft creation, publication, and deletion each require an Admin reason and create a distinct `admin_audit_logs` entry.
- Publication and deletion require an exact-content preview plus explicit confirmation. Publication is idempotent for already-published records; deletion returns the affected record for audit evidence.
- There is no reason-policy exception for Product Update writes.

## Audit Evidence

- The default Audit Logs view prioritizes a human-readable action summary, timestamp, actor, affected record, safe related-record links, and the Admin reason.
- User agent, IP address, record identifiers, and sanitized raw metadata remain available under collapsed technical evidence.
- The viewer redacts values under secret-like metadata keys. Stored audit evidence is not rewritten or deleted by the viewer.

## Request Admin Actions
On `/admin/requests/[id]`:
- Change request status
- Edit seller contact info
- Send reminder email to seller

Each action writes an audit log entry and also emits a request `event_logs` entry (for timeline visibility).

## Account Entitlement Overrides

The user-management **Entitlement override** changes the account's UtilitySheet access record only; it does not create, cancel, or modify a Stripe subscription.

- Entitlement overrides require an admin reason and are recorded in `admin_audit_logs`.
- Server authorization, policy checks, Team-workspace blocking, and `ADMIN_WRITES_DISABLED=true` remain in force.

## Impersonation
Impersonation is intentionally disabled by default (and hidden from the UI).

- The banner is gated behind `ADMIN_ENABLE_IMPERSONATION=true`.
- A true “support-mode” impersonation flow is not implemented yet.
