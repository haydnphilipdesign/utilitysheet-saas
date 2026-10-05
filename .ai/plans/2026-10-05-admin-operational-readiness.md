# Admin operational readiness: implementation handoff to Opus

## Status and mandate

- Date: 2026-10-05. Planning agent: Codex. Intended implementer: Opus.
- Status: local implementation completed 2026-10-05 by Claude Opus (planned by Codex the same day). All six phases are implemented and tested locally. On 2026-10-05 the owner authorized and Claude Opus performed: the three production migrations, a commit, and a push to `origin/main`. Optional activation (webhook, alerts, monitor schedule, pruning, uptime probe) is NOT done. Remaining steps are listed under "Implementation outcome" below and in `docs/admin-operations-runbook.md` section 5.
- Baseline: `main`, commit `84f984c`. Reverify on takeover.
- Assessment: `docs/audits/2026-10-05-admin-assessment.md`.
- Outcome: the owner can safely support customers, distinguish access from billing, see actionable failures, track follow-up, and follow a small operating routine.
- This planning session changes documentation only. When the user hands this plan to Opus to implement, proceed with local code, tests, documentation, and migration files. Do not interpret that as permission to execute migrations, change provider configuration, send external messages, commit, push, deploy, or change production data.
- No delegation is required. Work sequentially unless the user explicitly requests parallel agent work.

## Takeover instructions

1. Read applicable `AGENTS.md`, `.ai/CURRENT.md`, this plan, `ADMIN.md`, and the assessment. Inspect git status and the full relevant diff, including untracked documentation. Preserve existing work.
2. Record takeover and current phase in `.ai/CURRENT.md`; change this plan to in progress. No concurrent owner is known at handoff; recheck before editing.
3. Use Node 20 and npm. Do not install or change dependencies unnecessarily. Existing Node 22 on PATH is not the CI baseline; the assessment used `npx --yes --package=node@20 node node_modules/vitest/vitest.mjs ...` successfully.
4. Read `docs/pdf-system-reference.md` before touching packet/PDF behavior, and `docs/ai-telemetry.md` before adding telemetry. Read current email, billing, account-closure and metering callers before sharing helpers.
5. Verify assumptions below against code. Record material deviations rather than silently expanding scope. Routine local implementation choices do not need another permission request.
6. Complete each phase's meaningful verification and durable handoff before moving on. Record actual blockers separately from optional enhancements.

## Verified baseline and constraints

| Area | Verified behavior | Consequence |
| --- | --- | --- |
| Admin authorization | Layout calls `requireAdmin`; reviewed support actions independently authorize and enforce `ADMIN_WRITES_DISABLED` | Preserve checks at callable boundaries; do not rely solely on layout protection |
| Database | `lib/neon/db.ts` uses Neon HTTP `neon()`; request queries already use `sql.transaction([...])` and data-modifying CTEs | Do not assume an interactive transaction callback or that separate awaited calls share a connection |
| Account/request actions | Mutations precede separate audit inserts | Audit failure can leave a successful mutation reported as failed |
| Product Updates | Create/publish/delete also mutate before separate audit inserts | Include these local writes in the atomicity pass |
| Manual reconciliation | `app/api/admin/activation/reconcile/route.ts` POST authorizes and checks write safety, but has no required reason or admin audit call | Add reason/confirmation and bounded audit outcome; preserve automated cron behavior |
| Seller reminder | Admin action accepts deleted requests, checks email, sends, then records audit and event | Needs eligibility, safe retries and truthful outcome reporting |
| Customer reminder | `app/api/requests/[id]/remind/route.ts` has a 10-minute event-based cooldown and persistent production rate limiting | Preserve these protections and coordinate Admin/customer reminder concurrency |
| Email helper | `sendSellerReminderEmail` is shared by Admin, customer reminders, seller return-link and branding test email | Do not accidentally apply Admin policy or change semantics for all callers |
| Status correction | `updateRequestStatus` changes status and `last_activity_at`; does not set `metered_at` | A generic status selection is not a true submission |
| Paid count | Counts customer accounts with Pro access or an active Team workspace, including overrides | Not unique paying subscriptions and not revenue |
| Health endpoint | Database `SELECT 1`; AI/rate-limit configuration checks | Not an end-to-end availability check |
| Scheduled jobs | `vercel.json`: activation reconcile, activation reengagement, account closure retry | Weekly-summary route exists but is not scheduled there; do not label it overdue without an actual configured schedule |
| Monitoring | No central Admin operational failure/triage view found | External alerting, MFA, backups and provider settings remain unverified, not proven absent |

Existing assessment verification: 48 passing tests across six files: `admin-policies`, `admin-sensitive-actions`, `admin-operations-overview`, `admin-operations-dashboard`, `admin-telemetry`, `admin-telemetry-page`. These do not prove partial-failure or concurrency safety.

## Scope and deliberate limits

Implement all six phases below locally. Keep the existing overview/growth/telemetry split and visual language. Add an Operations page for failures and triage; keep the overview compact and replace or clarify existing attention content rather than accumulating headline metrics.

Do not build a billing engine, general ticketing product, custom analytics warehouse, generalized job framework, broad impersonation, bulk customer mutations, automatic seller outreach, new financial reconciliation writes, or a new backup service. Do not repair historical customer records or backfill fictional delivery/submission evidence. Existing public seller post-submission behavior and marketing-copy follow-ups are outside this task.

Provider-backed visibility may require production configuration. Build the local integration and document activation; do not silently treat unconfigured integrations as healthy or fabricate data. External launch work can remain explicitly pending while local implementation is complete.

## Phase 1 — Reliable, validated support writes and status corrections

### Expected files

- `app/(admin)/admin/users/actions.ts`, `app/(admin)/admin/requests/actions.ts`, `app/(admin)/admin/updates/actions.ts`
- `app/api/admin/activation/reconcile/route.ts`, `app/(admin)/admin/users/auth-reconciliation-card.tsx`
- `lib/admin/index.ts`, `lib/admin/policies.ts`, `lib/admin/audit-log-presentation.ts`
- New focused query module(s) under `lib/neon/queries/`; `lib/validation/schemas.ts`; `types/index.ts`
- `components/admin/RequestAdminActions.tsx`, affected existing admin components and tests

### Implementation

1. Inventory active Admin mutation entry points. Account role/ban/unban/entitlement, request contact/status, Product Updates, reconciliation, and outreach must have explicitly documented semantics. Keep disabled impersonation disabled; do not implement it in this project.
2. Add bounded runtime Zod validation for IDs, enums, seller contact fields, reasons and expected record versions at server boundaries. TypeScript types and browser controls are not input validation. Reuse existing canonical field rules where appropriate.
3. Put local mutation, required audit evidence and required request timeline event in one database transaction/statement. Audit failure must roll back mutation. Missing database configuration must be an explicit failure, not a successful null audit. Capture request context before constructing the transaction.
4. Read/lock or conditionally match the authoritative before-state in that same operation. Record accurate before/after evidence. Stale edits return a clear conflict and refresh instruction; do not overwrite newer support/customer changes.
5. Enforce self-protection, Team-managed entitlement policy and last-admin protection inside the concurrency-safe operation. Two admins concurrently demoting each other must not remove all admins. Use a documented lock/serialization strategy supported by the current driver, with integration tests; do not assume the current count-then-write pattern is safe.
6. Product Updates remain drafts on creation and require existing publication/deletion confirmation. Mutation and evidence become atomic; repeat publication/deletion must have truthful no-op outcomes and no misleading duplicate successful audit entries.
7. Manual reconciliation requires a reason and explicit confirmation of the reviewed scope. Persist a bounded attempt record before execution and a sanitized summary/outcome afterward, including partial/unknown outcomes. Do not claim multi-account reconciliation is one atomic operation. Avoid user lists or raw external responses in audit metadata. Keep cron reconciliation independent of interactive Admin reasons.
8. Never return a raw SQL/provider exception to the client. Use stable safe errors and correlation IDs. A post-commit cache refresh or display failure must not tell the operator that the mutation rolled back.

### Status correction policy

Use conservative support-only semantics: Admin cannot synthesize a first submission, quota consumption, referral award, completion email or packet generation by selecting a status. Preserve `metered_at` and all billing/entitlement behavior.

- Unmetered requests: allow corrections among `draft`, `sent`, `in_progress`; selecting `submitted` is blocked with an explanation.
- Metered requests already submitted: do not allow the generic selector to reopen them. Existing submitted-sheet editing is the appropriate path.
- Metered requests in a non-submitted state: permit restoring `submitted` only after verifying that `metered_at` remains authoritative in current code. No side effects beyond the correction and its atomic audit/event.
- Deleted requests: no edits, corrections or reminders through these controls.
- Trace readers of status/activity before finalizing. Prefer not to reset seller-activity time for Admin-only corrections; if compatibility requires it, label operator activity separately in inactivity reports. Do not silently change the shared `updateRequestStatus` behavior for unrelated callers.
- Document any incompatible historical edge cases for manual review, without automatically repairing them.

### Acceptance and tests

- Unauthorized, writes-disabled, malformed input, policy-blocked, no-op, missing-target and stale-target cases cannot perform forbidden writes.
- Forced audit/timeline insertion failure rolls back the mutation in a real local PostgreSQL-compatible test.
- Parallel edits and parallel last-admin changes preserve invariants. Use a local PostgreSQL harness capable of genuine concurrent connections for lock behavior; PGlite tests alone are not proof of production locking.
- Required reasons and confirmation apply to manual reconciliation; cron tests remain valid.
- Status corrections never create submission/metering side effects, reset quota, or change tokens.
- Add a durable decision record for atomic writes and correction semantics; link it here and in `ADMIN.md`.

## Phase 2 — Safe reminders with exact previews and recoverable outcomes

### Expected files

- Admin request actions/component; customer reminder API route
- `lib/email/email-service.ts` and a small shared rendering module as needed
- `lib/neon/queries/` reminder-operation queries; `lib/validation/schemas.ts`
- Focused root migration plus `schema.sql`; reminder API/action/component and shared email regression tests

### Implementation

1. Extract deterministic reminder rendering so preview and send use identical subject/body/branding/sender/reply-to. Preserve escaping and safe asset/URL handling. Do not invent a new template system.
2. Show property, recipient, exact message preview, last known reminder and cooldown in Admin. Require a reason and explicit confirmation. Revalidate recipient, template/branding and request eligibility at execution; stale preview must be reviewed again.
3. Admin reminders target nondeleted, unsubmitted requests only (`status` and `metered_at` checked). Validate email, owner eligibility and relevant closure/ban rules using existing policies. Preserve existing draft handling unless current product rules prohibit it; document the choice. No override button for ineligible requests in this version.
4. Reuse the existing 10-minute cooldown as the default, enforced server-side against successful and in-flight operations. Coordinate Admin and customer reminders using the same per-request claim so simultaneous calls through either endpoint cannot double-send. Preserve customer rate limiting and authorization. Seller self-send links and branding test messages remain distinct purposes, with regression coverage.
5. Persist a durable operation ID, request/purpose, actor/reason, payload fingerprint, provider message ID when known, timestamps and state. Suggested states: pending, accepted, failed, unknown. Enforce uniqueness and one active claim in the database, not process memory. Never store capability tokens or complete rendered email bodies in operation/audit/telemetry records.
6. Commit the operation intent and Admin attempt audit before contacting the provider. Do not hold a database transaction open across an email API call. Use the same provider idempotency key for retries of the same operation and ensure the payload is unchanged. If reconstruction cannot reproduce the original payload, do not blindly resend.
7. Distinguish definitive provider rejection from an ambiguous timeout. Unknown outcomes block automatic resends and point the operator to verification/reconciliation. Check current official Resend idempotency duration and behavior; never retry indefinitely after its safety window. A changed recipient/content requires a new reviewed operation, not reuse of an old key.
8. Atomically finalize accepted state, audit and the single `reminder_sent` event. If this database write fails after provider acceptance, report accepted/verification-pending where known, retain recoverability and do not offer an ordinary fresh send. Retrying completion must not duplicate provider sends or request events. Persist operation identity across UI refresh/retry.
9. Show accepted versus delivered accurately. Delivery/bounce information comes from Phase 4; historical sends remain unknown where evidence is absent.

### Acceptance and tests

- Double-click, two Admin sessions and Admin/customer concurrency produce at most one accepted logical reminder within the cooldown.
- Provider accepts then DB finalization fails: retry uses the same operation/key; final audit/event are not duplicated.
- Timeout, provider rejection, expired key window, abandoned claim, changed recipient/template, deleted/submitted request, and missing configuration have distinct safe outcomes.
- Preview content matches send content without leaking capability links into logs or durable metadata.
- Existing customer reminder, seller return-link, branding preview/test-email and telemetry event semantics remain covered.
- Record reminder retry/cooldown semantics in a durable decision record. Creation of migration files is allowed during implementation; running them against any live database is not.

## Phase 3 — Honest paid-access labels and billing context

### Expected files

- Overview and growth pages, `components/admin/` account/workspace presentation
- `lib/admin/operations-overview.ts`, `lib/admin/activation-funnel.ts`, list-query/presentation modules as needed
- Account/workspace detail pages, `ADMIN.md`, affected tests

### Implementation and acceptance

- Rename ambiguous Paid/Paying labels to `Paid-plan access` or equally explicit account-based wording. Explain that complimentary overrides and Team members count. Audit labels in overview, Growth, Users and Requested Questions without gratuitously renaming internal APIs/query parameters.
- Preserve the existing count/filter agreement. Two Team members can count as two access accounts; a comped Pro account can count without a paying subscription. Add fixtures for both.
- Present account entitlement and workspace entitlement separately where support decisions depend on them. Keep the existing override warning that it does not modify Stripe billing.
- Add safe links to existing Stripe customer/subscription records where trustworthy identifiers and mode are available. Do not guess live/test dashboard context or expose these identifiers publicly.
- Show unavailable/unknown billing evidence honestly. Stored subscription IDs alone do not prove active payment. Do not label missing Stripe IDs as a definite fault for complimentary or Team-managed accounts.
- Use existing verified billing status timestamps if available. If a new live Stripe comparison would be needed, document it as an optional later read-only integration; this phase does not require a new billing synchronization system, MRR calculation or automatic repair.

## Phase 4 — Operational visibility and configurable alerts

### Expected files

- New `app/(admin)/admin/operations/page.tsx`, focused components and query/service modules
- `app/(admin)/layout-content.tsx`, compact overview attention links
- Packet PDF route, billing webhook route, configured cron routes, email result boundaries
- New verified email webhook route if no equivalent exists
- Focused migration(s), `schema.sql`, `.env.example` placeholders, `ADMIN.md`, operations runbook and tests

### Source inventory before instrumentation

Inspect existing durable events, provider IDs, incident tooling and safe configured links first. Avoid duplicate stores for information already available. Document a source matrix for email, PDF, billing webhook, cron, AI and database health: evidence collected, age/freshness, known blind spots and how to investigate. AI aggregate outcomes already exist in Telemetry; link them rather than rebuilding them. Inspect outer completion-email failure handling as well as PDF endpoint failures so the page does not imply complete coverage from one route.

### Minimum Operations page

- Service problems with category, severity, first/last occurrence, occurrence count, safe customer/request link where appropriate, last successful observation, and investigation action.
- Email: accepted/delivered/bounced/complained/failed when linked evidence exists; historical/untracked messages are unknown. Provider delivery is not proof a human read it.
- PDF: unexpected generation failures; keep invalid tokens, expected authorization failures and normal rate limiting out of service incident counts.
- Billing webhook: signature-verified processing failures and recoveries linked by Stripe event identity. Invalid signatures are not trusted billing incidents. Preserve existing signature, idempotency, retry status and entitlement behavior.
- Jobs: last start, last success, duration and failed/partial status for the three configured cron jobs. Skipped/disabled/missing schedule is separate from overdue. Never mark unconfigured weekly summaries as overdue.
- Health: label exactly what the current probe establishes. No costly provider calls on each Admin render, and no public disclosure of service secrets/details.
- New install, no observations, stale observations, collection failure and zero failures must be distinguishable.

### Minimal data and failure handling

Use a small bounded operational event/job observation model, plus incident aggregation or query-based grouping; avoid an analytics warehouse. Define category/code, stable fingerprint, safe record references, correlation/provider event ID, first/last time and outcome. Use allowlisted metadata only: no full URLs containing tokens, seller answers, email bodies, full provider payloads, raw exceptions or customer contact fields. Inspect both at-rest and displayed data for redaction.

Decouple failure observation from customer success: ordinary monitoring failures must not break seller submissions, packets or billing handling. Fall back to redacted structured runtime logs. Monitoring that uses the same failing database cannot establish database outage alerting; document external monitoring as necessary for that case. Admin audit writes from Phase 1 remain authoritative, not best-effort telemetry.

For Resend events, verify signatures on the raw body using current official documentation; deduplicate provider event identity, correlate only known message IDs, handle out-of-order events and retain distinct bounce/complaint facts. Do not permit a late delivered event to erase a complaint. Unmatched events must not create false customer incidents or retain raw payloads. A failed required durable webhook write should be retryable by the provider. Subscription/configuration of the live webhook is a separate owner-approved step.

Define retention explicitly. Default new transient operational observations to a configurable 90-day window; audit evidence follows its existing policy and is never pruned with operational telemetry. Prepare cleanup and indexes locally, but activating a schedule or running production cleanup requires approval. Keep durable reminder deduplication sufficient to prevent unsafe old retries even after transient logs expire; fail closed for expired/missing historical operation IDs.

### Alert policy and activation

Prepare a notification adapter/configuration using existing infrastructure where available. Default to disabled until an owner destination and launch approval exist. Use fakes in tests; do not send test emails to real recipients.

Proposed configurable initial thresholds, documented as defaults rather than validated business benchmarks:

- Database/public availability: external probe, alert after three consecutive failures; no raw readiness token in links/logs.
- Unexpected PDF failures: three occurrences in 15 minutes; show isolated failures in the queue even below the notification threshold.
- Billing processing failure and definitive delivery failure: visible immediately; grouped notification on first unresolved incident, with duplicate suppression.
- Scheduled daily job: overdue beyond 26 hours since last success, only after monitoring is enabled and an initial grace window has elapsed. Partial runs are distinct from complete success.
- Send one initial alert and a recovery notification; no repeated unchanged-state notifications. Re-notify only on a new episode or configured escalation. Alerts contain safe Admin links and counts, not seller data.

If no existing external uptime configuration is accessible, deliver exact configuration instructions and mark external activation unverified. Do not provision a new paid service or invent a destination. Do not send automated seller reminders as operational alerts.

### Acceptance and tests

- Authenticated Admin-only queries/pages/actions; bounded pagination and stable sorting.
- Failure records are redacted; duplicate and out-of-order callbacks cannot inflate counts or regress outcomes.
- Existing customer flows succeed when best-effort monitoring is unavailable; genuine billing failures still return appropriate retryable responses.
- Fake-clock tests verify job grace windows, partial success, incident deduplication, thresholds, recovery and alert suppression.
- DB-down coverage explicitly uses an independent monitoring path/runbook, not a circular database-backed promise.
- Page has meaningful populated, empty, unavailable and stale states. No live webhook, alert or schedule is activated during local implementation.

## Phase 5 — Small actionable triage workflow

### Expected files

- Operations page/components/actions/queries; overview attention links
- Focused triage migration plus `schema.sql`; audit types/presentation; tests

### Implementation

- Separate `Service issues` from `Customer follow-up`. Inactive sellers and accounts that never started are follow-up candidates, not urgent failures.
- Retain raw business/backlog counts independently of triage state; dismissing an item must not change analytics or customer records.
- Persist only triage state for stable source keys: open, acknowledged, snoozed-until, resolved. Store actor, timestamps and a short bounded internal note (suggested maximum 1,000 characters). No attachment system, assignments, priorities framework or external ticket synchronization.
- Support reasoned acknowledgement, snooze, resolution and reopen. Enforce Admin authorization, write safety, runtime validation, atomic audit and stale-edit protection from Phase 1. Notes are private, rendered as plain text and excluded from external alerts; warn against adding credentials or seller secrets.
- Show why the item exists, when it first/last occurred, last operator action and the next useful link. Resolution of a monitored incident must not claim the underlying failure recovered unless success evidence exists.
- A new failure episode after resolution reopens or creates an identifiable new episode; repeated observations from the same episode do not generate duplicate items. Snooze expiry returns unresolved items to the queue. Define candidate dismissal so unchanged old signup inactivity does not reappear daily.
- Keep old backlog filters accessible. Do not let service triage states alter seller submission status or trigger messages.

### Acceptance

- Two operators cannot silently overwrite triage notes/state; all successful changes are audited.
- Snooze expiry, source recovery, source deletion, recurrence and missing source data have defined UI behavior.
- Triage reduces repeated investigation without hiding raw counts or treating customer inactivity as an outage.

## Phase 6 — Operator runbook, browser verification and release handoff

Create `docs/admin-operations-runbook.md` and update `ADMIN.md` with final behavior, data sources, limitations and links. Include:

1. Daily: service failures, unresolved customer support, blocked workflows. Weekly: activation, completion, repeat use and feedback. Monthly: actual Stripe revenue/cancellations, provider costs, access review and recovery readiness.
2. Short incident procedures for missing seller email, failed PDF, payment/access disagreement, missed cron and database outage. State how to locate evidence, what is safe to retry, and when an unknown outcome requires verification.
3. Provider access/MFA/recovery checklist with status fields `verified`, `unverified`, `not applicable`. Do not assert settings that were not inspected. Never put recovery codes or tokens into documentation.
4. Recovery rehearsal instructions: verify actual Neon restore window; restore to an isolated nonproduction branch with outbound email, cron and billing side effects disabled; test representative data and restore steps; record date/result and owner-chosen acceptable data-loss/downtime targets. Running the rehearsal against live-derived data requires separate approval and careful access handling.
5. Exact launch checklist for migration files, deployment, webhook registration, alert destination, scheduler/cleanup activation and post-release smoke checks. List each external action awaiting authorization individually. Include additive rollback steps; never roll back by deleting audit or operation history.

Browser verification must cover desktop and mobile navigation, long names/reasons, keyboard operation, focus/confirmation dialogs, disabled writes, empty/error states, billing labels, reminder preview and operations triage. Use local fixture-backed tests or a safe test environment. Never weaken production auth to obtain screenshots. If an authenticated visual check cannot be performed, explicitly retain that as a validation limitation and release gate.

## Schema and rollout requirements

- Prepare focused additive root migrations and mirror `schema.sql`. New tables need appropriate uniqueness, timestamps, bounded status values, indexes and deletion behavior consistent with account closure/privacy rules.
- Review foreign keys against current account/request deletion paths; operational history must neither block legitimate closure unexpectedly nor retain unnecessary private data. Do not cascade away required audit evidence.
- No automatic production migration or data backfill. Local disposable database migration tests are allowed and must clearly identify the local target.
- New schema-dependent features stay safely unavailable/disabled until the migration is confirmed. A missing table must not display zero incidents or silently report successful writes. Deploy sequencing must avoid breaking old support workflows between migration and code release.
- Document feature flags only where rollout needs them; no real values in `.env.example`. Verify all proposed environment names at call sites.
- Keep production monitor/notification activation separate from application tests and deploy. Do not touch `vercel.json` schedules without identifying the deployment consequence and recording it for approval.

## Validation strategy

Run focused tests for each phase first. Add failure-injection and concurrency tests, not tests that merely reproduce the implementation. Reuse existing fixtures and PGlite harness where suitable; use real concurrent PostgreSQL connections for locking/claims.

Required regression areas:

- Admin role/plan policies, controls, audit presentation, list filters/navigation and product updates.
- Manual reconciliation plus activation cron routes.
- Reminder API, shared email rendering, seller return-link and branding test email.
- Request metering/soft deletion/submitted editing, seller-progress and telemetry event semantics.
- Billing webhook/referral tests and account-closure tests for touched boundaries.
- Operations observations/webhooks, alerts, triage and migrations.

Before local implementation handoff:

```powershell
npm exec tsc -- --noEmit
npm run lint
npm test -- --run
npm run test:e2e:desktop
npm run test:e2e:mobile
npm run build
npm run security:scan
git diff --check
```

Use safe test fixtures; never target production to make a test pass. If environment requirements block Playwright/build/concurrency validation, record the exact missing prerequisite, tests not run and release consequence. Separate confirmed pre-existing failures from regressions, with evidence; do not claim all checks passed. Inspect every new file for secrets because the artifact scanner checks tracked files only. Do not run repeated broad suites without new changes or an unresolved reason.

## Deliverables and completion criteria

- [x] Phase 1: atomic validated writes, reconciliation audit, status correction policy and concurrency evidence.
- [x] Phase 2: exact reminder preview, shared claim/cooldown, durable operation/retry behavior and regression coverage.
- [x] Phase 3: honest access labels and safe available billing context.
- [x] Phase 4: bounded operational visibility, verified webhook handling, configurable quiet alerts and honest integration states. (Local integration complete; live webhook, alerts and schedule not activated.)
- [x] Phase 5: minimal audited triage workflow, separate from customer/business state.
- [ ] Phase 6: runbook and release handoff are done. Authenticated browser verification was NOT performed and remains a release gate (see deviations).
- [x] Migrations/schema synchronized, deletion/retention checked and local migration validation complete.
- [x] Required tests/checks complete or limitations explicitly recorded as remaining validation work.
- [x] Durable decisions recorded only for lasting transaction, reminder, monitoring/privacy and triage semantics.
- [x] Plan status and `.ai/CURRENT.md` accurate; no obsolete ownership warnings; changed files and next concrete action recorded.

Report local implementation and production readiness separately. Local completion does not imply migrations were run, provider settings verified, alerts activated or a release deployed. If external work is pending, say exactly what remains and provide the reviewable commands/configuration without secrets. Do not mark the entire rollout complete until its authorized release gates are actually met.

## Suggested execution checkpoints

Finish Phase 1 and 2 reliability before instrumenting them in Phase 4. Phase 3 is small and can follow immediately. Phase 4 supplies service incidents used by Phase 5. Phase 6 consolidates documentation, full verification and owner launch decisions. Do not stop after each phase merely to ask whether to continue; continue within the handed-off local scope and pause only for a genuine protected action or unresolved consequential decision.

## Implementation outcome (2026-10-05, Claude Opus)

### Decision records

- `.ai/decisions/2026-10-05-admin-atomic-writes-and-status-corrections.md`
- `.ai/decisions/2026-10-05-seller-reminder-operations.md`
- `.ai/decisions/2026-10-05-operations-monitoring-and-triage.md`

### Validation actually run

- `npm exec tsc -- --noEmit`: clean.
- `npm run lint`: 2 errors and 19 warnings, none in files touched by this work. The errors are in git-ignored `.qa-artifacts/specs/first-use.qa.spec.ts` and unmodified `components/admin/EventLogTable.tsx`. ESLint on every new and changed file: clean.
- Full Vitest under Node 20: 186 files passed, 1 skipped; 1172 tests passed, 8 skipped (the skipped file, `seller-forms-native.test.ts`, is not part of this work).
- `tests/concurrency/run.ts` against a disposable embedded PostgreSQL 18.4 with real concurrent connections: 12 of 12 checks passed. Manual harness, not in CI.
- `next build` under Node 20 with database, email and Stripe variables blanked: succeeded.
- `npm run security:scan`: passed. New untracked files were also checked directly for secret patterns: none.
- `git diff --check`: clean.

### Deviations and limits, recorded honestly

1. **Playwright (`test:e2e:desktop`, `test:e2e:mobile`) was not run, and no authenticated browser or visual verification was done.** The only local environment points at a hosted Neon database and a live email key, and no Admin test credentials exist. Running the dev server there risked touching live data or sending real email, and production auth was not weakened. Consequence: layout, focus order and mobile behaviour of the new dialogs and the Operations page are covered by component tests only. This is a release gate. `tests/admin-operations.spec.ts` is ready and skips without `ADMIN_E2E_*`. Steps: runbook 5.6.
2. **Concurrency tests are a manual harness, not CI.** The repository has no PostgreSQL server or `pg` client and none was added. PGlite covers atomicity and logic in CI.
3. **Optimistic concurrency uses the fields being edited rather than a record version or `updated_at`** for accounts and requests, because `updated_at` moves on unrelated writes. Triage uses a version number.
4. **`.env.example` is git-ignored in this repository**, so the placeholders added there are local only. The tracked reference is runbook section 7.
5. **`LAST_ADMIN_PROTECTED` is unreachable through the Admin UI** once the statement also requires the actor to be a current admin and blocks self-changes. It remains as defence in depth.
6. **Admin entitlement override accepts only Free and Pro.** `canceled` was previously accepted by the server but never offered by the UI.
7. **Customer reminder endpoint keeps its previous eligibility**, including allowing a reminder on an already-submitted request. Pre-existing; noted as a product follow-up, not changed.
8. **PDF failures are not linked to a request** and only reminder email has delivery evidence. Both are stated on the page and in the runbook.
9. **`vercel.json` is unchanged.** The monitor route exists but has no schedule.
10. **Impersonation still uses the older best-effort audit helper.** It is disabled and out of scope; the decision record says it must adopt the atomic pattern before being enabled.

### Release gates still open (each needs explicit owner authorization)

1. Review and commit the working tree.
2. Authenticated browser verification in a safe environment (runbook 5.6).
3. Run `migrations-reminder-operations.sql` on production **before** deploying the code, then `migrations-operational-events.sql` and `migrations-admin-triage.sql`.
4. Push and deploy.
5. Post-release smoke checks (runbook 5.4).
6. Optional activation, each separate: register the Resend webhook and set `RESEND_WEBHOOK_SECRET`; set the alert destination and enable alerts; add the monitor schedule to `vercel.json`; enable retention pruning; configure an external uptime probe.
7. Owner checks outside the repository: provider MFA/recovery checklist (runbook 3) and a recovery rehearsal (runbook 4). Every status there is still "unverified".

### Release record

- Production migrations applied 2026-10-05 by Claude Opus on explicit owner authorization: `migrations-reminder-operations.sql`, `migrations-operational-events.sql`, `migrations-admin-triage.sql`, each in one Neon HTTP transaction against the `.env.local` target (`neondb/public`, sanitized host fingerprint `79d6a988e446`, the same target as earlier recorded production migrations). Preflight: none of the five tables existed. After: all five tables and 15 indexes present, zero rows, existing counts unchanged (160 accounts, 970 requests).
- Committed and pushed to `origin/main` the same day on owner authorization. Authenticated browser verification was not done before release (owner proceeded). Deployment health and smoke checks (runbook 5.4) are unverified.
