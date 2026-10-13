# Investigate recent In Progress sheets

- Date: 2026-10-13. Agent: Codex. Status: Completed (investigation only; reason for individual abandonment remains unknown).
- Scope: determine whether today's unfinished requests indicate a regression from 2026-10-12 AI changes. Investigation/report only. No production writes, real AI calls, commit/push/deploy or schema actions.

## Facts and hypotheses

- Main is at `7d6a2af`; yesterday's changes are based on `c83b2eb` and touch suggestion/search services, UtilityStep and post-submit contact telemetry.
- Opening a seller link changes sent/draft to in_progress; this does not establish that answers have been entered. Verify unchanged behavior in git history.
- Hypotheses: normal same-day unfinished traffic; automated link opening; seller suggestion/search failure or UI regression; submission failure.
- Production access is expected through configured read-only Neon transactions and Vercel observability. Return aggregate/redacted evidence only.

## Work and acceptance

1. Trace status, intake creation, submission and AI calls; inspect relevant yesterday diffs.
2. Compare today's requests/open/submission behavior with preceding days using comparable elapsed time and cohorts; inspect redacted progress indicators for the recent cohort.
3. Check deployment revision, runtime errors, AI failure/latency patterns and operational events where available.
4. Run focused existing tests and local seller browser flow if needed; no real model or production seller mutation.
5. Report evidence, assessment and limits; mark plan and handoff current.

Expected modified files: this plan and `.ai/CURRENT.md` only. Temporary read-only diagnostic scripts belong outside the repository and must not contain credentials or customer data. Preserve unrelated untracked file.

Validation: database transactions explicitly readOnly, aggregate-only queries, relevant git diffs, focused existing tests proportional to findings; browser reproduction if an actionable UI failure is suspected. A successful build/deploy alone cannot prove seller completion.

## Outcome

### Assessment

No evidence found that yesterday's changes caused a seller-flow outage. The unfinished count is unusually high, and the evidence cannot determine why each seller stopped. No application fix or rollback is justified by the checks performed. No required work remains for this investigation. Optional next action: compare later completion of this same cohort; obtain client-side step/error evidence if the lower completion rate persists. No monitor was scheduled.

### Verified production evidence

- Final read-only check at 13:36:26 ET: 7 new non-demo, non-deleted requests across 3 accounts; 6 In Progress, 1 submitted. All 7 originated from reusable intake links. One property/account pair has 2 separate starts, which inflates the request count relative to distinct properties.
- Two starts had no suggestion fetch. Four unfinished starts had successful early-category suggestions; the submitted sheet fetched all 7 categories and stored 7 entries. Partial answers live in browser localStorage until submission, so zero database utility entries does not establish zero answers or a failed submission.
- Comparable 13:30 cutoffs: Oct 8, 6 created/5 submitted; Oct 9, 5/4; Oct 12, 3/2; today, 7/1. Earlier completed cohort (Sept 29–Oct 11): 37 submissions, median 4.5 minutes from creation, p90 91.4 minutes. Today's completion is lower; the small sample and different request ages prevent causal inference.
- 21 suggestion runs today all success (18 fresh, 3 cached) across 5 requests; fresh p50 3,561ms, max 6,277ms. Five contact runs on the completed sheet also success. Recorded completion-email outcome success; no operational failures on Oct 12–13 in the queried data.
- Production alias `www.utilitysheet.com` is Ready at `7d6a2af`. No Vercel runtime error clusters in the last 24h or warning/error/fatal log counts today. An empty seller-path log query does not prove no failed HTTP requests. Legacy observability schema returned 404; installed CLI 47.0.7 lacks metrics, so request-status/per-step analytics were unavailable through that path.
- No bot-like user agents detected in today's seller-open events; this classification does not prove human intent. Every new request was opened within seconds of intake creation, consistent with the normal intake redirect.

### Code and validation

- GET seller route transitions draft/sent to In Progress on link load, before answering. Yesterday's entire diff to that route adds only request/account/workspace context to post-persistence contact telemetry. Intake creation, the status transition and transactional submission logic were unchanged. Reviewed UtilityStep search/fallback changes and contact telemetry's failure isolation.
- Node 20.19.0: 9 focused Vitest files / 156 tests passed (`suggestion-service`, `contact-service`, `utility-step-search`, `utility-step-meter-flow`, `seller-post-submission-routes`, `seller-wizard-required-basics-trash-cable`, `seller-wizard-review-navigation`, both seller suggestion route files).
- Existing seller-flow, seller-reopen, seller-wizard-journey, seller-wizard-review-edit browser suites on Desktop Chrome, Mobile Safari and Mobile Chrome: initial run 49 passed, 1 skipped, 1 failed. Failure was the page-width assertion at `tests/seller-wizard-journey.spec.ts:248` while the Review slide transition was still active, matching the pre-existing flake recorded in yesterday's plan. Same case passed 3/3 isolated reruns, including submission. No test/application files changed to obtain passes.
- Additional temporary browser harness exercised the production-style empty initial suggestion map, fresh asynchronous single-provider suggestions, electric meter step, Common providers trash label, review and submission on desktop Chromium and iPhone WebKit: both passed, 3 fetch batches each, no page errors. APIs used synthetic fixtures; no real model, seller mutation or external email.
- Isolated dev server port 3210, one worker, process-only service-key blanks; server stopped after validation. Scratch scripts and browser config live in Windows Temp, contain synthetic fixtures/aggregate SQL only, no credentials/customer records. Browser outputs are ignored under test-results. `git diff --check` passed.

### Changes and limits

Only `.ai/CURRENT.md` and this plan changed. Unrelated `starter-task-lists-and-questions.md` preserved. No commits, push, deploy, schema change, production write or model evaluation. Production checks were Neon transactions explicitly `readOnly: true`, returning only redacted/cohort summaries.

Browser checks use mocked APIs on the deployed source revision; they establish runnable UI paths but cannot prove the hosted browser environment or an individual seller's experience. Recorded AI success establishes a returned answer, not correct provider choice. The exact abandonment point and unlogged client/validation errors remain unknown.
