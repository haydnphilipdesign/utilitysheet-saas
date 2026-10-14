# Telemetry Slice 9: retention and collection simplification

- Date: 2026-10-14. Agent: Claude Code. Worktree `.worktrees/slice-9`, branch `telemetry-slice-9` (from main `ce7b93d`). Will merge into main later on the owner's instruction.
- Status: **Approved by the owner on 2026-10-14 ("yes to all"): windows 1 to 10 as recommended (including the optional coarse device/browser add-on in 4), approvals A to F. Implementation completed and validated locally (see Execution record). Owner then authorized G (commit, merge, push/deploy, production preview then enforce; historical cleanup switch not included): committed `df77738`, merged with main `02a5281`.** No migration was needed. Parent plan: `2026-10-13-telemetry-audit-and-improvements.md`, "Slice 9". Slice 8 (AI lineage) is out of scope and comes later.
- Constraints from the owner: no live database writes, deletes, migrations, production setting changes, commits, pushes or deploys without explicit go-ahead. A pruning or cleanup job ships disabled with a preview mode. Indexes or rollups only after EXPLAIN on synthetic data. Validate with Node 20 (`.ai/CURRENT.md` setup). Read-only live queries only with prior approval.

## 1. Verified starting state

- Monitor fixes are in place: `JOB_RUN_WRITE_BUDGET_MS` (10 s) in `lib/ops/events.ts:173` (commit `b71b6c1`), monitor grace 20 minutes in `lib/ops/overview.ts:170` (commit `ce7b93d`).
- Existing pruning: `pruneOperationalObservations` (`lib/ops/events.ts:224`) deletes `operational_events` (by `occurred_at`) and `job_runs` (by `started_at`) older than `OPS_EVENT_RETENTION_DAYS` (default 90, clamped 7 to 365). It runs inside `/api/cron/ops-monitor` (every 15 minutes, `vercel.json`) only when `OPS_RETENTION_PRUNE_ENABLED === 'true'`. Facts about it:
  - Two unbatched `DELETE ... RETURNING id` in one transaction. No preview, no per-run cap.
  - It sits inside the monitor's `try`, so a prune failure marks the whole monitor run `failed` even when alerts were evaluated and sent.
  - Alert windows over `operational_events` are 24 hours or less and the minimum window is 7 days, so pruning cannot clear a live alert.
  - The `prunedEvents`/`prunedJobRuns` counts in `job_runs.summary` are 0 both when the flag is off and when it is on with nothing old enough, so stored job runs cannot tell whether it is enabled.
  - `operational_events` and `job_runs` were created on 2026-10-05, so **no row is old enough to be pruned until about 2027-01-03**. Whether the flag is on today changes nothing yet.
  - **Production flag state: unverified.** Neither local `.env.local` nor `.env` sets either variable. The Vercel CLI is linked (`.vercel/project.json`); `vercel env ls production` would show whether the names exist (values stay encrypted). Not run: needs owner approval (section 6, question A).
- Concurrent work: Codex's "mobile restarts and duplicate requests" investigation is active on main (`.ai/CURRENT.md`, `.ai/plans/2026-10-14-mobile-restarts-investigation.md`). It may edit the seller wizard, `UtilityStep` or intake. This slice does not need those files. Other worktrees (`maintenance-mode`, `slice-6`, `slice-7`) are idle and merged.

## 2. Inventory of stored telemetry and diagnostic data

Sizes are estimates from the code paths, not measurements. A typical live request is one dashboard or intake creation, a few opens, one suggestion load, a few searches, a submission and one or two emails. "Per request" includes row overhead and two btree indexes. Read-only production counts would replace these (question A).

| Store | What it holds | Personal data | How it is deleted today | Size |
| --- | --- | --- | --- | --- |
| `event_logs`: lifecycle rows (`request_created`, `seller_submitted`, `submitted_sheet_edited`, `request_reopened`, `request_reopen_cancelled`, `reminder_sent`, `admin_request_status_changed`, `admin_request_seller_updated`, `test_drive_*`) | Who/what created, submitted, edited, reopened, reminded; Admin reason text on admin rows; test-drive invitation/delivery outcome | **Raw IP and User-Agent** on creation, submission, edit, reopen, reminder and admin rows. Admin `reason` free text. **Pre-Slice-2 intake creation rows hold full submitted and canonical property addresses plus link slug/suffix** (`submitted_property_address`, `canonical_property_address`, `slug`, `suffix`) | CASCADE on request hard delete. Kept on soft delete. Account closure hard-deletes the account's requests, so these go with them | 5 to 10 rows, about 3 to 6 KB per request |
| `event_logs`: endpoint observations (`seller_opened`, `seller_self_send_link`, `suggestions_fetched`, `suggestions_search`) | Opens, return-link sends, suggestion loads with categories/counts, searches with query length and result count | **Raw IP and User-Agent** on opens and self-link. **Provider-name arrays** (`top_results_by_category`, `top_results`) duplicated from AI rows | Same as above | 3 to 12 rows, about 2 to 5 KB |
| `event_logs`: Slice 5 seller diagnostics (six `seller_*` types) | Steps viewed/completed, submit attempts/failures, suggestion render/fail; tab-session id, coarse device/browser family | None (no IP/UA, no text). Session id is a pseudonym | Same as above. Capped at 600 rows per request | 15 to 40 rows, about 6 to 15 KB; worst case about 250 KB |
| `ai_generation_runs` | Feature, category, model, prompt, outcome, latency, token/search counts, **coarse locality (state, ZIP3, city)** | Locality is coarse but city-level. No address, prompt or answer | `request_id`, `account_id`, `organization_id` SET NULL on delete, so **rows survive request deletion and account closure** (closure decision 2026-09-16 keeps "redacted AI telemetry"). No time pruning | 6 to 17 runs, about 3 to 8 KB |
| `ai_suggestion_items` | Provider labels, rank, confidence, canonical id; final selection (name matched to a generated item) | Provider business names only. Selection only matches generated names, so no seller free text | CASCADE from run; `request_id` SET NULL. Survives with the run | 20 to 40 items, about 5 to 12 KB |
| `notification_observations` (Slice 6) | One row per recipient slot: purpose, outcome, provider message id, attachment and delivery status | None (slots, not addresses). Provider message id is an external reference | CASCADE with request. Capped 200 per request. No time pruning | 2 to 4 rows, about 1 KB |
| `pdf_render_observations` (Slice 6) | Surface, outcome, stage, strategies, durations, bytes | None | CASCADE with request. Capped 300 per request. No time pruning | 1 to 6 rows, about 1 to 2 KB |
| `reminder_operations` | Reminder idempotency/claim, payload fingerprint, provider id, delivery status | **Recipient email**, Admin reason | CASCADE with request. Never pruned (decision 2026-10-05) | 0 to 3 rows, under 2 KB |
| `operational_events` | Incidents and sampled successes (email, PDF, billing webhook, AI) | Allowlisted metadata only; Stripe event ids | `request_id`/`account_id` SET NULL. Existing 90-day prune, off unless flagged | Not per request; at most one sampled success per fingerprint per 15 minutes |
| `job_runs` | Start/finish, status, duration, numeric summary | None | Existing 90-day prune, off unless flagged | Traffic-independent: about 99 rows/day (monitor every 15 minutes plus three daily jobs), about 36,000 rows and 10 to 15 MB a year. Largest steady grower at current volume |
| `ops_alert_state`, `admin_triage_items`, `maintenance_state` | Alert state, triage state and private notes, one maintenance row | Triage note free text (operator's own) | Not pruned; small and bounded by conditions/sources | Negligible |
| `admin_audit_logs` | Admin actions, metadata with reason and User-Agent | **Raw IP column, User-Agent in metadata**, reason text | Never deleted; `admin_id` blocks account deletion by design; kept on closure | Low volume (one operator) |
| `account_security_events` | Self-service security actions | None by contract (no IP/UA) | SET NULL on account; kept on closure | Low volume |
| `growth_attributions` | One first-touch row per account: UTM, referral code, landing path | Pre-Slice-1 rows may hold a **capability-bearing landing path** (`/s/...`, `/packet/...`) | Deleted at account closure; otherwise kept | One row per account |
| `growth_referral_events` | Packet-page referral CTA impression/click with referral code | None (referral code is a public slug) | Never deleted | One or two per packet page view |
| `activation_outreach_logs` | Re-engagement campaign send log | **Email** | Deleted at closure. Its unique key is the **send guard**: deleting a row allows a repeat email | One or two rows per account |
| `testimonial_outreach_logs` | Admin outreach sends | **Recipient email and name**, provider error text | Tombstoned at closure; resend guard | Low volume |
| `feedback_submissions`, `question_requests` | Customer feedback and question requests | Free text, **User-Agent** and page path on feedback | Deleted at closure; otherwise kept | Low volume |
| `account_closures` | Closure progress | `notify_email` is cleared on completion | Kept | One row per closure |
| Soft-deleted requests (`requests.deleted_at`) | Metered requests a customer deleted, kept so they still count toward usage | **Full address, seller name/email/phone, answers, event rows with IP/UA** | Never; only account closure removes them | Same as a live request |
| Outside Postgres | Upstash rate-limit analytics (SDK analytics retention setting, 90 days; pre-Slice-1 entries held raw seller/packet tokens), Redis cache (TTL), Vercel Analytics/Speed Insights and runtime logs (provider plan retention), browser drafts in localStorage | Varies | Provider settings, not this code | Not measurable from the repo |

Readers that a retention rule must respect (verified):

- Reminder cooldown reads the latest `reminder_sent` (`lib/neon/queries/reminder-operations.ts:131`), window 10 minutes.
- Admin Telemetry reads `request_created` (creation channel), `seller_opened`, `reminder_sent`, `seller_self_send_link`, `submitted_sheet_edited` and `seller_submitted` inside 7/30/90-day cohorts (`lib/neon/queries/admin-telemetry.ts:55`).
- Seller Progress reads endpoint observations and the six diagnostics for in-progress requests, using `categories`/`category`/`step`/`error_code` keys only (`lib/neon/queries/admin-seller-progress.ts`).
- Test-drive lifecycle display reads `test_drive_*` (`lib/neon/queries/event-logs.ts:43`).
- Admin request page renders every event row with raw `event_data` JSON and the IP column (`app/(admin)/admin/requests/[id]/page.tsx:27`, `components/admin/EventLogTable.tsx`). User-Agent is stored but not displayed.
- Account export lists event types and times only (`lib/neon/queries/account-data.ts:144`).
- AI rows feed Admin Telemetry (90-day maximum window) and AI health (24 hours). Provider memory reads `utility_entries`, not the AI tables.
- `event_logs` has only an index on `request_id`. No index on `created_at` or `event_type`. The AI, notification, PDF, operational and job tables already have time indexes.

## 3. Approach

One retention module with a per-class policy table, disabled by default, with three modes:

- `off` (default): no retention query runs at all.
- `preview`: for each enabled class, count the rows the rule would affect and the oldest affected timestamp. Nothing is changed. Counts go into the job run summary and the route response.
- `enforce`: batched deletes or scrubs, capped per class per run, oldest first.

Design points:

- **Explicit allowlists, keep by default.** Only listed `event_logs` types are ever deletable. A new event type is kept until someone adds it to a class. Lifecycle types, `reminder_operations`, audit, security, billing, referral credits and outreach send guards are not in any delete class.
- **Delete versus scrub.** Observation classes delete rows. The IP/User-Agent class only sets `ip_address`/`user_agent` to NULL and keeps the row. Optional one-time historical classes remove known sensitive JSON keys (`event_data - 'submitted_property_address' ...`) and keep the row.
- **Cutoff rule.** A row is affected only when its timestamp is strictly older than `NOW() - window`. Windows are clamped (minimum 7 days, maximum 3,650). Email/PDF evidence never goes below 30 days, so late delivery callbacks still match.
- **Batching.** `DELETE ... WHERE id IN (SELECT id ... ORDER BY ts LIMIT n)`, default 2,000 rows per class per run, one statement per class. A backlog drains over several runs instead of one long lock.
- **Where it runs (question C).** Recommended: from the existing ops monitor route, at most once per 24 hours, recorded as its own `job_runs` row (`telemetry_retention`), in its own error boundary so a retention failure marks the monitor `partial`, never `failed`, and never blocks alerts. No `vercel.json` change. Alternative: a separate daily cron route, which needs a `vercel.json` change.
- **Existing ops prune.** Fold `operational_events` and `job_runs` into the same module as two classes. `OPS_RETENTION_PRUNE_ENABLED=true` keeps meaning "enforce these two", and `OPS_EVENT_RETENTION_DAYS` keeps setting their window, so an existing production setting behaves the same. Behavior changes, both small: deletes become batched, and a prune failure no longer marks the monitor run `failed` (question D).
- **Configuration.** `TELEMETRY_RETENTION_MODE` (`off`/`preview`/`enforce`, default `off`, any unknown value is `off`). Per-class windows are code constants set from the owner's decisions; optional per-class override variables only if the owner wants them.
- **Indexes.** `event_logs` deletes by type and time would scan the table. Before adding anything, run EXPLAIN in local PGlite on synthetic data (about 1 million `event_logs` rows with a realistic type mix, plus AI rows). Only if the plan is a sequential scan that matters at realistic sizes, write a focused migration (likely `event_logs(created_at)` or a partial index on deletable types) and mirror it in `schema.sql`. Running the migration needs owner approval. No rollups in this slice unless a report needs history past the window (none identified).

Collection cleanups (independent of retention):

| Item | Change | Readers checked | Safe now? |
| --- | --- | --- | --- |
| Duplicate provider-name arrays | Stop writing `top_results_by_category` (`app/api/seller/[token]/suggestions/route.ts:201`) and `top_results` (`.../suggestions/search/route.ts:96`). Keep categories, counts and query length | No code reads them. Only the Admin request page shows raw JSON. AI items keep the names | **Yes**. Historical rows keep them unless a historical scrub is approved |
| Unused event definitions | Remove 10 analytics events with no caller: `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_completed` (free `destination` string), `seller_form_preview_opened`, `dashboard_reusable_link_copied`, `dashboard_reusable_slug_save_attempted`, `dashboard_reusable_slug_save_succeeded`, `dashboard_reusable_upgrade_clicked`, `seller_success_pdf_downloaded`, `seller_success_email_confirmation_requested`. Narrow the remaining free `destination` field to the static values in use | Type-only; no runtime effect. Custom event properties are not scrubbed by the Slice 1 URL hook, so free strings are the residual token path | **Yes** |
| Request CTA versus page start | Dashboard buttons (`app/dashboard/layout-content.tsx:195,210,336`, `app/dashboard/requests/page.tsx:276`) and the new-request page mount (`app/dashboard/requests/new/page.tsx:224`) all send `new_request_started`, so one start counts twice. Proposed: buttons send `new_request_cta_clicked`; `new_request_started` stays for the page | No in-repo reader; Vercel dashboard only | Code is safe; **needs owner OK** because it changes Vercel counts and any saved funnel |
| PDF generated + downloaded | Packet page sends `advanced_packet_generated` and `advanced_packet_downloaded` back to back after one successful fetch (`app/packet/[token]/page.tsx:225`). Proposed: send only `advanced_packet_downloaded` | No in-repo reader; Vercel dashboard only | Code is safe; **needs owner OK** for the same reason |

`served_pipeline` stays as is for historical rows (parent plan).

## 4. Files expected to change

- New: `lib/telemetry/retention.ts` (policy table, mode parsing, preview/enforce), `tests/unit/telemetry-retention.test.ts` (PGlite on real `schema.sql`), possibly `tests/unit/telemetry-retention-explain.test.ts` or a scratch EXPLAIN script outside the repo.
- Changed: `lib/ops/events.ts` (prune delegates to the module, flags preserved), `app/api/cron/ops-monitor/route.ts` (daily gate, own error boundary, summary counts), `lib/ops/overview.ts` only if `telemetry_retention` joins the heartbeat list (decided at implementation; default not, since it is off), `app/api/seller/[token]/suggestions/route.ts`, `app/api/seller/[token]/suggestions/search/route.ts`, `lib/analytics/events.ts`, and if approved `app/dashboard/layout-content.tsx`, `app/dashboard/requests/page.tsx`, `app/packet/[token]/page.tsx`. Possibly `lib/ops/events.ts` and `lib/ops/overview.ts` overlap Slice 7 territory; no one else is editing them.
- Tests touched: `tests/unit/ops-monitoring.test.ts`, `tests/unit/ops-instrumentation.test.ts`, suggestion route tests, analytics caller tests.
- Docs: `docs/telemetry-privacy.md` (retention section), `docs/admin-operations-runbook.md` (5.5d and section 7 variables), `ADMIN.md` (one line under Operations), `docs/ai-telemetry.md` (AI retention line). Decision record `.ai/decisions/2026-10-14-telemetry-retention.md` once the owner adopts windows. If an index is justified: `migrations-event-logs-retention-index.sql` and `schema.sql`.
- Not touched: seller wizard, `UtilityStep`, intake (Codex investigation), billing, reminders, audit, account closure logic.

## 5. Acceptance criteria and validation

Acceptance:

1. With mode `off` (and no ops flag), the monitor runs no retention query (asserted by statement capture).
2. `preview` returns correct counts and oldest timestamps per class on PGlite fixtures and changes no row.
3. `enforce` deletes or scrubs exactly the rows strictly older than each cutoff; a row exactly at the cutoff and one a second newer are kept. Batch cap honored; a second run continues the backlog.
4. Lifecycle event types, unknown event types, `reminder_operations`, `admin_audit_logs`, `account_security_events`, `referral_credits`, outreach logs, triage and alert state are untouched in every mode, at any age.
5. Scrub classes keep the row and its other columns. Seller Progress, Admin Telemetry and reminder cooldown read the same results before and after enforcement for data inside the windows.
6. Request hard delete still cascades; soft delete and account closure (including Team transfer of requests to another admin) behave exactly as before, with retention running before or after.
7. Existing `OPS_RETENTION_PRUNE_ENABLED`/`OPS_EVENT_RETENTION_DAYS` behavior is preserved for `operational_events` and `job_runs`. A retention failure leaves the monitor run `partial`, alerts still evaluated.
8. Suggestion events no longer contain provider names; their remaining keys are unchanged. Removed analytics types have no caller; TypeScript passes.
9. Any index proposal is backed by EXPLAIN output on synthetic data, recorded in this plan.

Validation (Node 20.19.0, installed CLIs directly, Redis variables cleared, as in `.ai/CURRENT.md`): focused Vitest for the new module and touched routes, then the complete Vitest run; `tsc --noEmit`; ESLint on changed files; `scripts/security/scan-artifacts.mjs`; `git diff --check`. No Playwright needed unless a browser-visible change is approved (CTA/PDF event names are covered by component tests). Worktree setup: `node_modules` junction to the main checkout and LF `scripts/demo-seed.mjs` working copy (never committed), per earlier slices.

## 6. Owner decisions and approvals

Retention windows, one per data class (recommended default, then what is lost):

1. **Seller browser diagnostics** (six Slice 5 types): **90 days.** Lose: Seller Progress "last reported step" for a request still in progress after 90 days becomes unknown; funnel history older than a quarter.
2. **Endpoint observations** (`seller_opened`, `seller_self_send_link`, `suggestions_fetched`, `suggestions_search`): **180 days.** Lose: opens and searches on the Admin request timeline for older requests; Seller Progress "last seller activity" for requests idle more than 6 months becomes unknown. No Admin report reads past 90 days.
3. **Lifecycle events** (creation, submission, edit, reopen, reminder, admin changes, test drive): **keep for the life of the request (no time rule).** Lose nothing. These carry submission evidence, creation channel, reminder cooldown and admin reasons.
4. **Raw IP and User-Agent on `event_logs`**: **set to NULL after 30 days, keep the row.** Optional add-on: store the coarse device/browser family (the Slice 5 classifier) on new creation/open/submission rows so "iPhone Safari versus Mac Chrome" survives. Lose: IP/browser comparisons older than 30 days (the 2026-10-14 duplicate investigation used them on day-old rows); the IP column on the Admin request page shows a dash for older rows.
5. **AI runs and items** (coarse locality, provider names; survive deletion and closure): **365 days.** Lose: prompt/model and cost comparisons older than a year; the Slice 8 baseline will be at most a year deep. (180 days would be stricter; it would still cover every current report.)
6. **Email and PDF evidence** (Slice 6 tables): **180 days, never below 30.** Lose: "was the completion email accepted/delivered" answers for handoffs older than 6 months become unknown.
7. **Operational incidents and job runs**: **90 days (unchanged), enable it.** Lose: incident history older than a quarter; job heartbeat older than 90 days (not used by any rule).
8. **Records that are never pruned by this job**: `reminder_operations`, `admin_audit_logs` (including its IP), `account_security_events`, billing and `referral_credits`, `activation_outreach_logs` and `testimonial_outreach_logs` (send guards), feedback, question requests. **Recommended: confirm this list.** Lose nothing; cost is slow growth. A later option is scrubbing audit IP/User-Agent after a year.
9. **Growth referral events**: **keep (no rule) for now.** Lose nothing; no personal data. Revisit if the table grows.
10. **Soft-deleted metered requests** (full address, seller contacts, answers kept so usage still counts): **out of Slice 9 scope; separate product decision.** Recommendation for that later decision: scrub contact details and answers some months after deletion while keeping the metering fields. Lose then: nothing visible today, since there is no restore feature.

Historical cleanup (optional one-time classes, preview first, enforce only on approval): remove `submitted_property_address`, `canonical_property_address`, `slug`, `suffix` from pre-Slice-2 intake `request_created` rows; remove provider-name arrays from old suggestion rows; normalize pre-Slice-1 `growth_attributions.landing_path` with the current route policy. The IP/User-Agent rule (4) clears old IPs automatically when enforced.

Approvals needed before or during implementation:

- **A.** Read-only production checks: `vercel env ls production` (variable names only) and one read-only transaction returning aggregates only (row counts and total size per table, rows per event type with oldest timestamp, count of rows with IP/User-Agent, median and 95th percentile rows per request). No row contents.
- **B.** The ten windows above (or changes).
- **C.** Where it runs: inside the ops monitor once a day (recommended), or a new daily cron in `vercel.json`.
- **D.** Fold the existing ops prune into the module (batched, failure marks the run partial instead of failed).
- **E.** Cleanups: the two safe ones go in with this slice unless told otherwise; confirm the CTA rename and the single PDF event.
- **F.** Historical cleanup classes: include them (preview only until approved) or leave out.
- **G.** Later and separate: any migration (index), switching production to `preview` and then `enforce`, merging, pushing, deploying.

## 7. Risks

- Deleting evidence is irreversible beyond Neon's point-in-time window (restore window unverified, runbook section on restores). Mitigation: off by default, preview first, keep-by-default allowlists, batch caps, lifecycle and ledger tables excluded.
- Scrubbing IP/User-Agent removes the only cross-request device signal for old rows. Mitigation: optional coarse family going forward.
- Running inside the monitor adds work to a 15-minute job. Mitigation: once a day, own error boundary, small batches, job budget unchanged.
- Admin reports may show "unknown" where history used to exist. Admin copy should say retention applies.
- Renaming Vercel events splits dashboard history at the release date.
- Overlap: Slice 8 will edit the suggestion routes; doing the provider-name cleanup here first keeps that small. Codex's investigation may touch seller files; this slice avoids them.

## Execution record

- 2026-10-14: startup checks, inventory and this plan (Claude Code). No code, no live query, no setting change.
- 2026-10-14, approval A carried out. `vercel env ls` failed with an internal CLI error (Vercel CLI 47.0.7, `TypeError ... startsWith`); production flag state remains **unverified** (check Vercel dashboard, Settings, Environment Variables). One read-only Neon transaction (`transaction_read_only = on`, host SHA-256 prefix `79d6a988e446`, the `.env.local` database used by earlier releases), aggregates only, script kept outside the repo:
  - Table sizes: `event_logs` 11,497 rows / 4.7 MB; `ai_generation_runs` 5,381 / 2.9 MB; `ai_suggestion_items` 16,357 / 5.5 MB; `requests` 1,013 (31 soft-deleted) / 1.5 MB; `job_runs` 805 (778 monitor) / 0.35 MB; `operational_events` 39; `notification_observations` 1; `pdf_render_observations` 1; `reminder_operations` 0; `growth_attributions` 2 (no capability-like landing path); `growth_referral_events` 23; `admin_audit_logs` 58; `activation_outreach_logs` 93.
  - `event_logs` by type: `suggestions_search` 4,144 and `suggestions_fetched` 3,956 (oldest 2026-02-27, no IP/UA); `seller_opened` 1,394 (all with IP/UA, oldest 2026-01-13); `request_created` 997 (989 with IP/UA); `seller_submitted` 803 (791 with IP/UA, oldest 2025-12-18); `seller_self_send_link` 106; `submitted_sheet_edited` 36; `reminder_sent` 12; test-drive 11; Slice 5 diagnostics 38 (since 2026-10-14). Average row 240 to 1,050 bytes.
  - Event rows per request: median 8, 95th percentile 31, maximum 130 (1,008 requests).
  - AI runs: oldest 2026-05-27; 304 orphaned (request deleted).
  - Historical cleanup candidates: 843 intake `request_created` rows still hold address/slug keys; 7,175 suggestion rows hold provider-name arrays; 0 attribution paths to normalize (that class is dropped).
  - Consequence: at this volume no index is likely to be needed; EXPLAIN on synthetic data still decides (section 3).
- 2026-10-14, implementation completed locally (Claude Code). **Uncommitted in the worktree; no commit, merge, push, deploy, migration or production setting change.**
  - New: `lib/telemetry/retention.ts` (ten rules, `off`/`preview`/`enforce`, daily gate, per-rule isolation, batch 2,000, Admin status loader), `components/admin/RetentionCard.tsx`, `tests/unit/telemetry-retention.test.ts` (13 PGlite tests on real `schema.sql`), `tests/unit/retention-card.test.tsx`, decision `.ai/decisions/2026-10-14-telemetry-retention.md`.
  - Changed: `lib/ops/events.ts` (old prune removed, `JobName` adds `telemetry_retention`), `app/api/cron/ops-monitor/route.ts`, `app/(admin)/admin/operations/page.tsx`, both suggestion routes, `app/api/requests/route.ts`, `app/api/seller/[token]/route.ts`, `app/api/seller/[token]/send-link/route.ts`, `lib/seller-forms/intake.ts`, `lib/analytics/events.ts`, `app/dashboard/layout-content.tsx`, `app/dashboard/requests/page.tsx`, `app/packet/[token]/page.tsx`; tests `ops-monitoring`, `ops-instrumentation`, `admin-operations-ui`, `intake-start-route`, `seller-post-submission-routes`, `requests-route-advanced-gating`, `seller-suggestions-route`, `seller-suggestions-search-route`, `tests/ops-coverage.spec.ts`; docs `telemetry-privacy.md` (new "Retention" section), `admin-operations-runbook.md` (5.5d, section 6 note, section 7 variables), `ai-telemetry.md`, `ADMIN.md`.
  - EXPLAIN (PGlite, real statements, 1,000,000 synthetic `event_logs` rows with the production type mix over two years plus 500,000 AI runs): `event_logs` rules one sequential scan each, 250 to 690 ms for preview or a 2,000-row batch; AI runs use `idx_ai_generation_runs_created`, about 110 ms; the small tables under 1 ms. About 3 seconds per daily run at 87 times today's volume. **No index migration** (acceptance 9).
  - Validation (Node 20.19.0, installed CLIs, Redis and database variables unset): complete Vitest **251 files passed / 1 skipped, 2,182 tests passed / 13 skipped / 0 failed** (one earlier complete run also hit the known intermittent `branding-list-page` test, which passed on rerun). TypeScript passed. ESLint on all changed files: 0 errors, 4 existing `<img>` warnings on untouched lines of `app/packet/[token]/page.tsx`. Isolated Playwright `tests/ops-coverage.spec.ts`: 3 passed (Desktop Chrome, Mobile Safari, Mobile Chrome). Security scan and `git diff --check` passed. Not run: production build, Next-server Playwright suites, anything hosted.
  - Deviations from this plan, recorded honestly: (1) acceptance 3 tests a row a minute either side of the cutoff plus a NULL timestamp, because `NOW()` moves between statements and "exactly at the cutoff" is not deterministic; (2) `destination` was not narrowed: every remaining value is a static marketing path, so it would only have meant retyping marketing content; (3) the attribution-path historical rule was dropped (0 rows to fix); (4) `suggestions_fetched` gains `result_counts` (count per category) in place of the names; (5) the monitor response field `pruned` became `retention`, and the monitor summary keys `prunedEvents`/`prunedJobRuns` became `retentionRan`/`retentionFailed`; (6) the operational prune now runs once a day, batched, instead of every 15 minutes; (7) an Admin Operations Retention card was added so preview counts are readable without a query; (8) the device/browser labels were added to dashboard and intake `request_created`, `seller_opened`, `seller_self_send_link` and `seller_submitted` (agent-side edit/reopen/reminder rows were left alone).
  - Overlap: main gained Codex commit `02a5281` after this branch started; it shares only `.ai/CURRENT.md` with this branch, so a merge conflicts only there.
  - Remaining, needs owner go-ahead (G): commit on this branch, merge into main, push/deploy, then `TELEMETRY_RETENTION_MODE=preview` in production, read the Retention card after a daily run, then `enforce`, then optionally `TELEMETRY_RETENTION_HISTORICAL_CLEANUP=true`. Verify `OPS_RETENTION_PRUNE_ENABLED` in the Vercel dashboard (CLI failed).
- 2026-10-14, release (owner-authorized): `8cd4ec5` pushed and deployed (about 13:37 UTC). Production `TELEMETRY_RETENTION_MODE=preview` set before the push; first run 13:45 UTC previewed IP/User-Agent 2,908, endpoint observations 1,766, historical 843 and 7,175, others 0, with no rows changed. `OPS_RETENTION_PRUNE_ENABLED` confirmed `true` in production by the run's enforce action on the operational rules. Switched to `enforce` at 13:47 UTC and redeployed by pushing the handoff note; first enforcing run expected shortly after 12:45 UTC on 2026-10-15. `TELEMETRY_RETENTION_HISTORICAL_CLEANUP` not set (not authorized).
