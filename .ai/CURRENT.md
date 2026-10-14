# Current task: telemetry Slice 8 lineage

- Date: 2026-10-14. Agent: Codex. Branch: `telemetry-slice-8`; worktree:
  `.worktrees/slice-8`; implementation commit: `977d6c9` (base UX `68fbf38`). No issue/PR.
- Status: **Completed: live migration applied/verified; implementation committed and pushed to origin/telemetry-slice-8. No required work remains.** Plan: `.ai/plans/2026-10-14-telemetry-slice-8-lineage.md` (completed).
  Approved decision: `.ai/decisions/2026-10-14-ai-exposure-lineage.md`.
- A-E/local integration/implementation were owner-approved. Fast-forwarded UX
  `68fbf38` first without creating a commit, preserving all Slice 8 task docs and
  the UX plan/tests. Main source and owner notes were untouched. Main retains its
  pre-existing CURRENT pointer edit and untracked starter-task-lists-and-questions.md.
- All Slice 8 source/test/docs were committed in 977d6c9 and its remote head
  was verified equal. This final handoff is recorded in a documentation follow-up.
  No other active Slice 8 editor identified; obsolete UX concurrency warnings are removed. This branch
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

## Owner-authorized migration and publication (2026-10-14)

The owner explicitly requested applying the migration to the live database and
committing/pushing all Slice 8 worktree changes. This superseded the earlier
migration/commit/push restriction for this operation only.

- Applied migrations-ai-exposure-lineage.sql to the same configured Neon live
  target used by the prior release (host SHA-256 prefix 79d6a988e446). Seven
  additive DDL statements committed atomically, with 5-second lock and 45-second
  per-statement timeouts. Pre/post verification transactions were read-only.
- Schema postconditions passed: six new nullable generation columns without
  defaults; exposure/choice tables with 13/10 columns; four valid indexes;
  2/4 foreign keys with approved request CASCADE/origin SET NULL; unique
  request/edit/category accepted choices. No customer-row query or write.
- Raw working-file migration SHA-256:
  0597dd5936243b4916c3f6f296f3263024b00ed93f4bac0ce7bdccb29810cb4b.
- Committed all 61 Slice 8 files as 977d6c98dafff5adbabd5756bb9b557fe1df05d0
  (Add AI generation exposure and accepted-choice lineage), then pushed with
  upstream origin/telemetry-slice-8. git ls-remote confirmed exact identity.
  The already committed UX ancestor 68fbf38 is included on this branch.
- Tracked security scan passed before/after staging; 11 new files directly
  inspected with zero secret-pattern matches; staged diff check passed. Code
  is unchanged from the locally validated implementation above.
- Final migration/publication state is captured in a documentation follow-up
  commit on the same branch. No main merge, deployment command, production
  setting change, pruning, real model/provider/email call or unrelated commit.
  Main-only CURRENT pointer and owner notes remain preserved/uncommitted there.

## Remaining scope and next action

**No required work remains for the authorized migration/commit/push request.**
The additive schema is live and Slice 8 is published on its branch. Optional next
step is a separately authorized review/merge/release; no main merge or deployment
was requested or performed. Missing collection remains unknown, caches roll over
on later activation, server history lasts at most 365 days and browser acks 90;
reported cost and correction metrics remain labelled proxies, with no backfill.
