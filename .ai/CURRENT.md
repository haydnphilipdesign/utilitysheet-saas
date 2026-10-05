# Current task: Admin operational readiness (migrated, committed and pushed; optional activation pending)

- Date: 2026-10-05. Last agent: Claude Opus (took over from Codex planning). Branch: main at 84f984c.
- Status: **implementation complete. On 2026-10-05 the owner authorized running the migrations, committing and pushing to GitHub; all three were done.** No required implementation work remains. Optional activation steps and owner-only checks below remain open. Whether the push triggered a production deployment was not verified from here.
- Production migrations applied 2026-10-05 by Claude Opus on explicit owner authorization: `migrations-reminder-operations.sql`, `migrations-operational-events.sql`, `migrations-admin-triage.sql`, each in one Neon HTTP transaction against the `.env.local` target (`neondb/public`, sanitized host fingerprint `79d6a988e446`, the same target as earlier recorded production migrations). Preflight: none of the five tables existed. After: all five tables and 15 indexes present, zero rows, existing counts unchanged (160 accounts, 970 requests).
- Plan: `.ai/plans/2026-10-05-admin-operational-readiness.md` (status and "Implementation outcome" section are current).
- Assessment: `docs/audits/2026-10-05-admin-assessment.md`.
- No concurrent editing is known. No ownership warnings are active.

## What was built

1. **Atomic, validated Admin writes.** Role, ban, entitlement, request status, seller contact and Product Update writes each commit with their audit entry (and request timeline event) in one statement; audit failure rolls back. Zod validation at every Admin boundary. Stale edits are refused. Role changes are serialized so two admins cannot demote each other. Manual signup reconciliation needs a reason and confirmation and is audited before and after. Safe coded errors with a correlation reference.
2. **Status corrections are not submissions.** Admin can only move unmetered requests between Draft, Sent and In progress, or restore a metered request to Submitted. `metered_at` and all billing behaviour are untouched.
3. **Seller reminders as durable operations.** Exact preview equals the send. One claim and 10 minute cooldown shared by Admin and the customer endpoint, enforced in the database. Provider idempotency key per operation. Accepted, rejected and unknown outcomes are distinct and recoverable.
4. **Honest paid-access labels and billing context** on overview, Growth, Users, Requested Questions, account and workspace detail.
5. **Operations page** (`/admin/operations`, nav "Issues & Triage"): service issues, reminder email evidence, scheduled job status, plain statement of blind spots, customer follow-up. Best-effort redacted observations for PDF, billing webhook, completion email and cron. Verified Resend delivery webhook route. Quiet alerts and retention pruning, both off by default, run from an unscheduled monitor route.
6. **Triage**: acknowledge, snooze, resolve, reopen with reason and private note; atomic with audit; versioned; never changes customer records or counts.
7. **Runbook** `docs/admin-operations-runbook.md` and updated `ADMIN.md`.

## Decision records

- `.ai/decisions/2026-10-05-admin-atomic-writes-and-status-corrections.md`
- `.ai/decisions/2026-10-05-seller-reminder-operations.md`
- `.ai/decisions/2026-10-05-operations-monitoring-and-triage.md`

## Files (committed in the operational-readiness commit)

New: `lib/neon/statements.ts`, `lib/neon/queries/admin-writes.ts`, `lib/neon/queries/reminder-operations.ts`, `lib/admin/action-guard.ts`, `lib/admin/refusals.ts`, `lib/admin/billing-context.ts`, `lib/validation/admin-schemas.ts`, `lib/reminders/seller-reminder.ts`, `lib/ops/{events,email-delivery,overview,alerts,triage}.ts`, `app/(admin)/admin/operations/{page.tsx,actions.ts}`, `app/api/webhooks/resend/route.ts`, `app/api/cron/ops-monitor/route.ts`, `components/admin/{BillingEvidence,TriageControls}.tsx`, `migrations-reminder-operations.sql`, `migrations-operational-events.sql`, `migrations-admin-triage.sql`, `docs/admin-operations-runbook.md`, three decision records, `tests/helpers/pglite-db.ts`, `tests/concurrency/{run.ts,README.md}`, `tests/admin-operations.spec.ts`, `tests/unit/{admin-writes,admin-support-actions,admin-paid-access,admin-operations-ui,seller-reminder-operations,seller-reminder-route,ops-monitoring,ops-instrumentation}.test.ts(x)`.

Modified: Admin actions (`users`, `requests`, `updates`), Admin pages (overview, growth, users, user detail, workspace detail, request detail, question requests, audit logs, layout nav), `auth-reconciliation-card.tsx`, `components/admin/{AdminUserControls,RequestAdminActions,ProductUpdatesAdmin}.tsx`, API routes (`admin/activation/reconcile`, `requests/[id]/remind`, `packet/[token]/pdf`, `billing/webhook`, `seller/[token]`, three cron routes), `lib/email/email-service.ts`, `lib/admin/audit-log-presentation.ts`, `lib/validation/schemas.ts`, `types/index.ts`, `schema.sql`, `ADMIN.md`, and nine existing test files (mock for the new observation module; superseded Product Update action tests moved).

Not changed: `package.json`, `package-lock.json`, the shared `updateRequestStatus`, PDF builder, Stripe entitlement logic. `.env.example` has local placeholders but is git-ignored here; the tracked reference is runbook section 7.

## Validation performed (2026-10-05)

- `npm exec tsc -- --noEmit`: clean.
- `npm run lint`: 2 errors, 19 warnings, all in files this work did not touch (git-ignored `.qa-artifacts/specs/first-use.qa.spec.ts`; unmodified `components/admin/EventLogTable.tsx`). ESLint on all new and changed files: clean.
- Full Vitest, Node 20 (`npx --yes --package=node@20 node node_modules/vitest/vitest.mjs run`): 186 files passed, 1 skipped; 1172 tests passed, 8 skipped (skipped file is unrelated).
- `tests/concurrency/run.ts` on disposable embedded PostgreSQL 18.4, real concurrent connections, local only: 12 of 12 passed. Harness packages were installed in the session scratchpad, not the repository.
- `next build` under Node 20 with `DATABASE_URL`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` blanked: succeeded.
- `npm run security:scan`: passed. New untracked files checked directly for secret patterns: none.
- `git diff --check`: clean.

## Not performed (validation limits)

- **Playwright desktop and mobile suites were not run, and no authenticated browser or visual check was done.** Local `.env.local` targets a hosted Neon database with a live email key, and there are no Admin test credentials. Starting the dev server there risked live data and real email. Release gate; steps in runbook 5.6.
- No provider setting was inspected or changed. No email was sent. The post-release smoke checks (runbook 5.4) have not been done.

## Release steps

Done 2026-10-05 on owner authorization: production migrations (all three), commit, push to `origin/main`.

Still open:

1. Confirm the Vercel deployment of the pushed commit is healthy, then do the smoke checks (runbook 5.4).
2. Authenticated browser verification (runbook 5.6) was skipped before release by owner decision; still worth doing.
3. Activation status (2026-10-05): owner reports the Resend webhook and the `OPS_*` variables are set in Vercel (not verified from here). Monitor schedule added to `vercel.json` (every 15 minutes) and pushed on owner request. No external uptime probe exists yet. Original list, for reference: Resend webhook + `RESEND_WEBHOOK_SECRET`; alert destination + `OPS_ALERTS_ENABLED`; monitor schedule in `vercel.json`; `OPS_RETENTION_PRUNE_ENABLED`; external uptime probe. The owner asked for guidance on these next.
4. Owner-only checks: provider MFA/recovery (runbook 3) and recovery rehearsal (runbook 4). All statuses there are "unverified".

## Risks and things the next agent should verify, not assume

- Whether `.env.local` points at production or a development branch is unknown; treat it as live.
- Resend idempotency retention (24 hours) was checked against Resend documentation on 2026-10-05; recheck if the retry window constants are changed.
- Lock behaviour is proven only by the manual harness; rerun it after changing `admin-writes.ts`, `reminder-operations.ts` or `lib/ops/triage.ts`.
- The customer reminder endpoint now returns generic errors and new 409/502 codes; the dashboard shows the message text, but this was not checked in a browser.

## Optional follow-up (not required)

- Stop customer reminders on already-submitted requests (pre-existing behaviour).
- Store provider IDs for completion email to get delivery evidence there.
- Fix the two pre-existing lint errors.
- Add `pg` and a PostgreSQL service to CI to run the concurrency harness automatically.
- Earlier marketing follow-ups (Teams shared-default claims, in-app "Unlimited requests" copy, old visuals) remain outside this plan.

## Next action

Owner confirms the deployment and runs the smoke checks in runbook 5.4, then decides which optional activation steps (runbook 5.5) to do. Guide them through those on request; each changes provider or deployment configuration and needs their go-ahead.
