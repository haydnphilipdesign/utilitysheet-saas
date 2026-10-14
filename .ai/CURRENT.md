# Current task: telemetry Slice 8 lineage

- Date: 2026-10-14. Agent: Codex. Branch: `telemetry-slice-8`; worktree:
  `.worktrees/slice-8`; HEAD: `68fbf38`. No issue/PR.
- Status: **Local implementation complete; authorized live migration and commit/push in progress.** Plan: `.ai/plans/2026-10-14-telemetry-slice-8-lineage.md` (completed).
  Approved decision: `.ai/decisions/2026-10-14-ai-exposure-lineage.md`.
- A-E/local integration/implementation were owner-approved. Fast-forwarded UX
  `68fbf38` first without creating a commit, preserving all Slice 8 task docs and
  the UX plan/tests. Main source and owner notes were untouched. Main retains its
  pre-existing CURRENT pointer edit and untracked starter-task-lists-and-questions.md.
- All Slice 8 changes remain unstaged/uncommitted here. No other active Slice 8
  editor identified; obsolete UX concurrency warnings are removed. This branch
  has an ignored node_modules junction to main's installed dependencies; no install,
  dependency/env copy or manifest change. Generated test artifacts stay ignored.

## Completed implementation

- Atomic generation/items/first consumer, shared one-time persistence and separate
  request/edit/category/feature exposures, one 500 ms budget including a follower's
  wait and query. IDs are returned only after membership is collected; no replay,
  background writes or origin recreation. Cache origin timestamps never refresh.
- Origin-preserving envelopes advance actual suggestion/search/contact namespaces
  v9/v8/v3 to v10/v9/v4, retaining functional scopes and TTLs. No consumer IDs in
  shared caches. Disabled/reached contact skips are finite, without provider copies.
- Optional fail-soft choice UUIDs and private/no-store compatible seller APIs;
  strict v1/v2 observations, actual committed top-three/filter/dedup subsets and
  successful empty exposures, cancellation checks, byte/event batch limits, stable
  resend IDs and distinct validated membership readers. Draft/unchanged selection
  references persist; manual/unknown/reset/provider change/Internet-to-Cable clears.
- Immutable accepted choices in one auxiliary statement after accepted submission;
  exact owned membership/identity checks, no latest-name fallback or required ack.
  Duplicate submissions do not replay observations. Dashboard edits/reopen cannot
  overwrite evidence. Required submission, metering and contact trust stay intact.
- Bounded SDK attempt/recovered-failure/usage/grounding summaries with late-timeout
  safety. Existing price constants centralized/re-exported with schedule version
  2026-10-12-standard-list-v1. Partial/unknown usage never becomes full billed cost.
- Additive migration/schema mirror, independent 365-day exposure/choice retention
  and request CASCADE/origin SET NULL. Browser acks remain only in 90-day events.
  Aggregate Admin lineage/first-reopen/lookup/usage panels and change proxies,
  missing-schema isolation, compatible optional eval/CSV/comparison fields.

## Changed areas

- New: `lib/telemetry/{ai-lineage,ai-cost}.ts`,
  `lib/neon/queries/{ai-lineage,ai-lineage-report}.ts`,
  `migrations-ai-exposure-lineage.sql`, `tests/ai-exposure-lineage.spec.ts`,
  its fixture, `tests/unit/{ai-exposure-lineage,gemini-lineage-driver}.test.ts`.
- Updated: `schema.sql`, `types/index.ts`, validation, Gemini client, provider
  suggestion/contact/canonicalize services, AI/observation/Admin query modules,
  AI health, retention and observation helpers; seller suggestions/search/POST/
  observations routes, SellerWizard/UtilityStep, Admin Telemetry page; eval
  core/runner/README, telemetry Playwright config and focused unit expectations.
- Updated docs: AI telemetry, telemetry privacy, ADMIN, Slice 8/parent plans,
  adopted decision and observation/report/retention policy amendments. UX layout,
  branding/PDF, billing, prompts/models/quality gates and R12 are unchanged.

## Validation

- Node 20.19.0, installed CLIs directly; DATABASE_URL/Upstash/model keys cleared.
  All DB/model/HTTP tests use disposable fixtures or interceptors, no live calls.
- Full Vitest: **255 files passed / 1 skipped; 2,222 passed / 13 skipped**.
  Later final estimate/late-SDK tests passed with the 27-test eval/driver group;
  final lineage/wizard group 26 passed, installed Neon group 15 passed.
- PGlite proves forward migration twice from previous schema, unchanged legacy
  null lineage, atomic rollback/zero-item completeness, shared/cache consumers,
  foreign/stale/mismatched references, immutable reopen choices, advisory stripping
  and distinct aggregates/change proxies, retention and request deletion.
  Synthetic EXPLAIN uses the scoped exposure index. Installed SDK interception
  proves actual invocation counts/empty-text numeric usage/partial grounding and
  late completion safety; installed Neon proves the shared 500 ms consumer budget.
- Playwright: **6 new lineage + 39 existing seller/UX cases passed** across Desktop
  Chrome, Mobile Safari and Mobile Chrome. Two further capture reruns passed;
  desktop initial and mobile Safari search screenshots inspected. Real wizard/CSS,
  intercepted network and page-error checks; no external traffic. Evidence is
  committed DOM, including scrollable rows, not attention/visibility verification.
- TypeScript and changed/new TS ESLint passed (0 errors; six existing wizard hook
  warnings). Later test/label/comment edits also passed typecheck/targeted lint.
  Tracked security scan, direct inspection of 11 new files (0 secret matches),
  diff check and final source/contract review passed.
- Windows demo-seed CRLF import failure was handled only during full runs with a
  temporary LF normalization restored byte-for-byte in finally; no seed diff.
  A race in an old observation test was fixed by awaiting the committed subset.
- Not run: optional production build, Next-server/live e2e, physical devices or
  screen readers, hosted checks or real evaluation. These are separate release/
  device checks, not unfinished required local implementation.

## Constraints and next action

No live query/write, production data/settings action, migration execution,
model/provider/email call, commit, push or deployment occurred or is authorized.
Missing schema fails soft. Cache rollover may increase fresh calls after release;
telemetry can be lost/forged and cost/correction measures remain labelled proxies.
Server records last at most 365 days, browser acks 90 days; no inferred backfill.

**Next concrete action:** review the uncommitted diff and additive migration here.
Publication/hosted migration/activation and any external verification require
separate owner authorization. No required local work remains; do not execute the
migration or publish as an automatic continuation of this completed task.

## Owner-authorized migration/publication (2026-10-14)

The owner explicitly requested applying the migration to the live database and
committing/pushing everything in this Slice 8 worktree. This supersedes the prior
migration/commit/push restrictions for this action only. Deployment, production
setting changes, pruning, customer writes and real model/email calls remain out
of scope. Publishing branch telemetry-slice-8, without merging main or including
main-only owner notes. Startup verified all 61 changed/new files belong to Slice 8;
main has only its pre-existing CURRENT pointer and untracked owner notes. Remote
main currently 44391b3; no remote telemetry-slice-8 branch yet.

Next: verify the configured live Neon target against the prior release host
fingerprint, inspect schema metadata in a read-only transaction, apply only the
additive migration transactionally with lock/statement deadlines, verify schema
postconditions without customer-row reads/writes, then commit/push and confirm
remote branch identity. No deployment action is authorized.

### Live migration verified

Applied migrations-ai-exposure-lineage.sql to the same configured Neon live
target as the prior release (host SHA-256 prefix 79d6a988e446). Seven additive DDL
statements committed atomically with 5-second lock and 45-second per-statement
timeouts. Read-only schema pre/post transactions verified six nullable generation
columns with no defaults, 13 exposure columns, 10 choice columns, four valid
indexes, request CASCADE/origin SET NULL foreign keys (2 exposure / 4 choice) and
unique request/edit/category choices. All postconditions passed. No customer-row
query or write, model/email call, pruning, production setting change or deployment.
Raw working-file migration SHA-256:
0597dd5936243b4916c3f6f296f3263024b00ed93f4bac0ce7bdccb29810cb4b.

Remaining authorized work: commit and push all Slice 8 source/test/docs to
origin/telemetry-slice-8, then verify remote identity and record publication.
