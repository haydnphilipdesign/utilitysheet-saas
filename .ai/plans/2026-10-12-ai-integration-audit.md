# AI integration, model selection and cost audit

- Status: **In progress.** Slices 1 to 3 of 7 are done and committed and pushed to origin/main on 2026-10-12 (`214ad72`), deployment not verified. Slice 4 is done with its migration applied, committed and pushed the same day (`6ba63ff`), and its deployment was seen Ready on the production alias on 2026-10-12. Slice 5 is built, validated and has had its first run; it is committed and pushed (see "Progress" and the outcome sections). Slice 6 is in progress: R4 and R13 are committed and pushed (`77e08ef`), R8 is committed and pushed; R10 and R9 are measured with nothing to ship, and R11 is built and pushed (later session on 2026-10-12), so slice 6 is complete and slice 7 remains. Slice 4 usage recording is confirmed on real production lookups. Investigation completed 2026-10-12 by Claude Code (Opus 5.5); the owner approved Option B in chat the same day (see "Owner decision").
- Scope: owner brief in chat on 2026-10-12. Audit of every AI and Google Maps integration, current model and pricing research, cost and accuracy analysis, evaluation framework proposal, prioritized roadmap. Investigation and documentation only.
- Baseline: main at `c83b2eb`.
- Deliverable: `docs/audits/2026-10-12-ai-integration-audit.md`.

## Work completed

1. Startup checks: `AGENTS.md`, `.ai/CURRENT.md`, worktree (one unrelated untracked file, `starter-task-lists-and-questions.md`, left alone).
2. Code inspection: `lib/ai/gemini-client.ts`, `lib/ai/response-schemas.ts`, `lib/providers/suggestion-service.ts`, `lib/providers/contact-service.ts`, `lib/address/{location-verifier,google-place}.ts`, `lib/cache.ts`, `lib/rate-limit.ts`, the seller suggestion, search and submit routes, the demo route, `SellerWizard.tsx`, `UtilityStep.tsx`, `GooglePlacesAddressInput.tsx`, `lib/ops/`, `docs/ai-telemetry.md`, the 2026-07-29 incident plan.
3. Production evidence: two read-only, aggregate-only query batches against the configured database (counts, rates, latencies; no addresses, provider names or identifiers printed). Run from scratch scripts outside the repository. Basis: the brief asked for real usage metrics where available. No write, cache change or model call was made.
4. Official documentation read on 2026-10-12 for Gemini (pricing, models, thinking, Search grounding, Maps grounding, structured output, rate limits), OpenAI pricing, Anthropic pricing, Google Maps Platform pricing, Vercel Config and Secret variables.

## Verified findings (detail and numbers in the report)

- Suggestion cache is keyed by ZIP3 and ignores the city; 65% of cache hits come from a lookup for another city, with lower seller acceptance (68% vs 82%; 56% vs 77% for water, sewer, trash).
- Provider search runs the full grounded pipeline per typing pause from 2 characters; 63% of recorded AI passes, 58% zero results, median 7.4 s. Search reuses the suggestion quality gate (minimum 2 results), which rejects a single correct match.
- Prompts and gate require multiple providers; 22% of fresh suggestion lookups end on the generic national list.
- No timeout on Gemini calls; fresh suggestion p50 about 8.5 s, maximum 160 s. The verify pass runs on 94% of fresh lookups.
- No token, thinking-token or search-count telemetry; contact lookups unrecorded; no operations alert on AI fallback.
- The July rollback was `gemini-3.5-flash-lite` for empty responses, fixed 2026-07-29; that model has not been retried.

## Not verified

Google billing by SKU; hosting values of `GEMINI_THINKING_LEVEL` and `LOCATION_VERIFIER_ENDPOINT`; Google Cloud restrictions on the browser Maps key; any accuracy claim about models not yet run. Documentation was read through a summarizing fetch tool; table details should be confirmed by eye.

## Recommendation recorded in the report

Option B (incremental modernization), starting with the model-independent fixes (R1 cache per city, R2 search rework, R3 timeouts), then measurement (R5 telemetry, R6 evaluation script), then prompt, pass-count and model decisions by evaluation. Stay on Gemini; no Maps grounding; no second provider.

## Owner decision (chat, 2026-10-12)

- **Option B approved.** Implementation may start.
- The telemetry migration (R5) is approved to be written and applied, with the usual aggregate before and after checks. "Whatever else is needed" was also said; read it as covering the roadmap items in the report, not as a standing approval for commits, pushes, deploys or other live actions. Ask before each of those.
- Owner reported (not verified here): `GEMINI_THINKING_LEVEL` was recreated as a Config variable with the value `low`. It takes effect on the next deployment.
- Still open on the owner's side: Google Cloud budget alert, Maps key restriction check, September's Google bill by SKU.

## Progress

| Slice | Status |
|---|---|
| 1. Cache per city [R1] | Done 2026-10-12, pushed (`214ad72`) |
| 2. Timeouts [R3] | Done 2026-10-12, pushed (`214ad72`) |
| 3. Search rework [R2] | Done 2026-10-12, pushed (`214ad72`) |
| 4. Telemetry and alert [R5] | Done 2026-10-12, migration applied, committed and pushed |
| 5. Evaluation script [R6] | Done 2026-10-12, first run made, pushed |
| 6. Decided by the evaluation | Done 2026-10-12: R4 and R13 pushed 2026-10-12; R8 pushed 2026-10-12 (`3be14f5`); search prompt measured, no effect, not shipped; search tool off measured, keep it on; R10 measured, no effect, plumbing not built; R9 measured, stay on the current model; R11 pushed |
| 7. As time allows | Not started |

## Implementation slices (approved order)

Each slice is test-first where a cheap seam exists, validated with `tsc`, ESLint on changed files and the focused Vitest files, and reported before the next one starts. Report item numbers in brackets.

1. **Cache per city [R1].** `getCacheKey` and `getSearchCacheKey` in `lib/providers/suggestion-service.ts`, and the contact scope in `lib/providers/contact-service.ts` if the same weakness applies: key on state + full ZIP + normalized city; bump the cache versions. Accept: two cities in one ZIP3 get separate entries; existing key tests updated. No schema change.
2. **Timeouts [R3].** Per-call timeout on `generateContent` in `lib/ai/gemini-client.ts` and a real overall deadline in both pipelines. Accept: a hung call ends within the limit and is recorded as `ai_provider_error`; retries cannot exceed the deadline.
3. **Search rework [R2].** Its own gate that accepts one match; one pass; client filters the loaded suggestions locally first and calls the AI only after a longer pause with 4 or more characters or on an explicit action (`components/seller-form/steps/UtilityStep.tsx`). Accept: an exact single match is returned; typing a 6-letter name makes at most one or two AI calls. Needs a look at the search box in a browser.
4. **Telemetry and alert [R5].** Read `usageMetadata` and grounding metadata; new nullable columns on `ai_generation_runs` (prompt, output and thinking tokens, search query count, thinking level, source count); record contact lookups; operations event when the fresh fallback or error share passes a threshold; acceptance-by-source table in Admin telemetry. New `migrations-ai-usage-telemetry.sql` mirrored in `schema.sql`; update `docs/ai-telemetry.md`. Apply the migration before the push.
5. **Evaluation script [R6].** `scripts/eval/` plus a case file; output to an ignored folder. The silver cases need an owner-approved export of city, state, ZIP and confirmed provider names.
6. **Decided by the evaluation [R4, R8, R9, R10, R11].** Single-provider prompt and gate, one pass versus two, model and thinking level, county and township context, honest fallback wording. Each gets a short note of the measured result before it ships.
7. **As time allows [R12, R13, R14].** Source-based trust, state-name filter, removal of the legacy pipeline and stale `.env.example` entry.

Risks to carry: slice 1 increases fresh lookups until slice 3 lands, so do them close together; every prompt or model change empties the caches; the evaluation shares the 5,000 free monthly searches with production.

## Slice 1 outcome (2026-10-12, Claude Opus 5.5)

- Behavior: the suggestion cache, the search cache and the contact cache are keyed by state + full 5-digit ZIP + normalized city (lowercase, punctuation collapsed), in place of the 3-digit ZIP prefix. With no ZIP the key is state + `nozip` + city; with no city it is state + ZIP + `unknown`. Account scope, model, request format, category and query hash are unchanged in the keys.
- The contact cache had the same weakness (the prompt uses city and ZIP to tell same-named boroughs and authorities apart, the key did not), so it was changed too.
- Versions bumped: suggestions and search `v7` to `v8`, contacts `v2` to `v3`. Old entries are not deleted; they stop being read and expire on their own (30, 7 and 90 days).
- Files: `lib/providers/suggestion-service.ts` (new `getLocalityCacheToken`, used by `getCacheKey` and `getSearchCacheKey`; `getSearchCacheKey` added to `__testing`), `lib/providers/contact-service.ts` (`getContextCacheScope`), `tests/unit/suggestion-service.test.ts` (7 new cases), `tests/unit/contact-service.test.ts` (1 new case, 1 updated). No schema, route, prompt or UI change.
- Tests were written first and failed before the change (9 failing), then passed.
- Validation (Node 20.19.0): the two focused files 27/27; `tsc` clean; ESLint on the four changed files clean; full Vitest with native PostgreSQL 221 files / 1686 passed; security scan and `git diff --check` passed. The Node 20 copy's bundled npm cannot run package scripts (missing `node-gyp`), so Vitest, `tsc`, ESLint and the scan were started with `node` directly.
- Deliberately left alone: the workspace provider-memory cache key and its query still group by ZIP prefix (it ranks the workspace's own history and already receives the city; not part of R1); telemetry still stores `locality_zip3` (privacy rule in `docs/ai-telemetry.md`); the cache key is built from the locally parsed address, as before, not from the optional external verifier.
- Known effects once deployed: every suggestion, search and contact cache entry starts empty, so the first days see more fresh lookups (the report estimates 2 to 3 times for suggestions in steady state). Different spellings of one town ("St. Louis" and "Saint Louis", "Hampden Township" and "Hampden Twp") get separate entries; the cost is one extra lookup, not a wrong answer.
- Not verified: the live cache, the hosted site, any real model call. Nothing live was read or written.

## Slice 2 outcome (2026-10-12, Claude Opus 5.5)

- Behavior, client (`lib/ai/gemini-client.ts`): each call to the model is given an abort signal and ends after 10 seconds (`GEMINI_CALL_TIMEOUT_MS`, 1 to 60 seconds). A timed-out call is not retried, counts as a failure for the circuit breaker and comes back as `provider_error`. All the attempts of one generation share a deadline: the caller's `deadlineAt` when given, otherwise twice the call timeout (20 seconds). A retry is not started when its wait plus one second would pass the deadline.
- Behavior, pipelines (`lib/providers/suggestion-service.ts`): every AI pass of one suggestion or search lookup shares one hard deadline, 15 seconds from the start (`SUGGESTIONS_DEADLINE_MS`, 3 to 60 seconds). A pass is not started with less than 2 seconds left. `SUGGESTIONS_MAX_TOTAL_MS` (6 seconds) keeps its old meaning: whether another pass may start. When verify or recovery runs out of time, the earlier answer is served if it passed the gate, as before.
- Worst case for the AI part of a lookup is now about 15 seconds (was unbounded; 160 seconds recorded). Contact lookups, which pass no deadline, are bounded at 20 seconds.
- A timeout is recorded as `ai_provider_error` (status `error`), as the acceptance criterion asks. Telemetry cannot yet tell a timeout from another provider error; slice 4 can add that.
- Files: `lib/ai/gemini-client.ts`, `lib/providers/suggestion-service.ts`, `tests/unit/gemini-client.test.ts` (6 new cases), `tests/unit/suggestion-service.test.ts` (4 new cases, 1 assertion updated). `lib/providers/contact-service.ts` needed no change for this slice.
- Tests written first and seen failing. Validation (Node 20.19.0): focused files 51/51; `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 221 files / 1696 passed; security scan and `git diff --check` passed.
- Risks: on a slow day more lookups end on the generic list instead of waiting; three timeouts in a row open the in-memory circuit breaker for 60 seconds on that server instance (existing behavior, now easier to reach). Google states an aborted request may still be billed.
- Not verified: a real model call. That the installed SDK (`@google/genai` 1.43.0) honors `abortSignal` was read from its type definitions, not exercised; the wait ends at the timeout either way because the client races the call against a timer.

## Slice 3 outcome (2026-10-12, Claude Opus 5.5)

- Behavior, server (`lib/providers/suggestion-service.ts`): a search is one grounded pass (`runSinglePassSearchPipeline`); the verify and recovery search passes and their prompts are removed. `applyQualityGates` takes the minimum result count as a parameter, and search passes 1, so a single correct match is returned. Suggestions still require 2 (that is slice 6). An empty answer is now recorded as `ai_empty` and a rejected one as `quality_gate_failed`; before, both were `quality_gate_failed`. Workspace history is added to a search result only when its name matches what was typed (before, unrelated history could be appended). Search prompt version is `provider-search-v2`, so telemetry separates before and after. The route and its rate limit are unchanged; the server still accepts 2 characters.
- Behavior, search box (`components/seller-form/steps/UtilityStep.tsx`, new `lib/providers/local-match.ts`): typing filters the suggestions already loaded for the category, with no request. The server is asked only when nothing loaded matches and the seller pauses for 900 ms on 4 or more characters, or when they press Enter or the new Search button (2 or more characters). `Use "<typed name>"` is offered as soon as 2 characters are typed, before or after a search. Results are kept with the query they answer, so text typed since never shows older results.
- Analytics: `seller_provider_search_no_results_committed` gained `searched` and `result_count`, because the typed name can now be used when matches are on screen. The event name is unchanged.
- Files: the two above, `lib/analytics/events.ts`, new `tests/unit/provider-local-match.test.ts` and `tests/unit/utility-step-search.test.tsx`, `tests/unit/suggestion-service.test.ts`, `tests/seller-wizard-journey.spec.ts` (one new browser case). The legacy search pipeline behind the shadow switch is untouched (slice 7 removes it).
- Acceptance: an exact single match is returned (unit test); typing a six-letter unknown name key by key makes one request (unit and browser tests); a name that matches a loaded suggestion makes none.
- Validation (Node 20.19.0): tests first; `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 223 files / 1712 passed; security scan and `git diff --check` passed. Browser: `seller-wizard-journey`, `seller-wizard-review-edit`, `seller-flow` and `seller-reopen` on Desktop Chrome, Mobile Safari and Mobile Chrome, 50 passed, 1 skipped, run one worker at a time against this project's dev server on port 3210 with `DATABASE_URL`, `RESEND_API_KEY`, `GOOGLE_AI_API_KEY`, `GEMINI_API_KEY` and `STRIPE_SECRET_KEY` blanked in the process only. Desktop and phone screenshots of the six search states reviewed.
- Tool notes: port 3000 on this machine was held by another project's dev server, so the repository Playwright configuration would have tested the wrong site. A scratch configuration outside the repository pointed the same three profiles at port 3210 (`NODE_PATH` set to this project's `node_modules`). The scratch server was stopped afterwards.
- Finding outside scope, left alone: `tests/seller-wizard-journey.spec.ts`, "requires water and sewer answers...", fails on Mobile Safari when several workers run at once, on the committed code as well (checked by putting the committed search box file back and restoring it). It measures page width while the step slide-in is still running. It passes one worker at a time.
- Not verified: a real model call, the hosted site, a signed-in browser, dark mode, a real phone keyboard (the Enter key hint is set to "search").
- For the owner to look at: the two new labels, `Search for "<name>"` and `Search more providers`.

## Slice 4 design (2026-10-12, Claude Opus 5.5, implemented as written)

Verified in code before starting: `ai_generation_runs.feature` and `operational_events.category` are both limited by a check; `/api/cron/ops-monitor` is scheduled every 15 minutes in `vercel.json` (the route's own comment saying it is not scheduled is stale); telemetry writes are best-effort; about 400 fresh suggestion lookups a month, so a one-hour window rarely holds enough runs to judge.

- Client (`lib/ai/gemini-client.ts`): `generateJSONWithMeta` also returns usage read from the answer that was used (prompt, output, thinking and tool-prompt tokens, search queries run, distinct sources) and, on failure, what kind it was (timeout, deadline, circuit open, rate limited, empty answer, other API error, not configured). Usage of an attempt that failed is not available.
- Run rows: the pipelines add up usage over their passes and store it with the thinking level and the first failure kind. Cached rows leave the new columns empty.
- Contact lookups: recorded in `ai_generation_runs` as feature `provider_contact` (fresh and cached), linked to the request, with no provider name stored.
- Migration `migrations-ai-usage-telemetry.sql`: nullable columns `prompt_tokens`, `output_tokens`, `thinking_tokens`, `tool_prompt_tokens`, `search_query_count`, `source_count`, `thinking_level`, `error_kind`; the feature check also allows `provider_contact`; the operational category check also allows `ai`; one index on `created_at`. Additive, rerunnable. Two columns beyond the plan's list (`tool_prompt_tokens`, needed to total a call's cost; `error_kind`, the timeout split slice 2 left open).
- Alert: evaluated by the scheduled monitor, not in the seller's request. Per feature over the last 24 hours of fresh runs, with at least 10 runs: suggestions count as degraded when they ended on the generic list; search and contact lookups when the model call failed (an empty search is normal). At 50% or more the monitor records an `ai` operational event (shown on Admin Operations) and the alert condition fires; a later healthy window records the recovery. Thresholds are environment values.
- Admin telemetry: a usage table (calls, searches, tokens per feature) and an acceptance table by what the seller was shown.

## Slice 4 outcome (2026-10-12, Claude Opus 5.5)

- Built as the design section above describes. No prompt, cache key, gate, route contract or seller screen changed.
- Files, application: `lib/ai/gemini-client.ts` (usage and failure kind on `generateJSONWithMeta`, `getGeminiThinkingLevelName`), `lib/providers/suggestion-service.ts` (usage and first failure added up over the passes of both pipelines), `lib/providers/contact-service.ts` (contact lookups recorded; `resolveContactFresh` still records nothing), `app/api/seller/[token]/route.ts` (passes the request, account and workspace so the contact row is linked), `lib/neon/queries/ai-telemetry.ts`, new `lib/ops/ai-health.ts`, `lib/ops/{alerts,events,overview}.ts`, `app/api/cron/ops-monitor/route.ts`, `lib/neon/queries/admin-telemetry.ts`, `app/(admin)/admin/{telemetry,operations}/page.tsx`.
- Files, schema and documents: new `migrations-ai-usage-telemetry.sql`, `schema.sql`, `docs/ai-telemetry.md`, `ADMIN.md`, `docs/admin-operations-runbook.md`. `.env.example` gained the three `OPS_ALERT_AI_*` lines, but that file is ignored by git here, so the change is local only.
- Files, tests: new `tests/unit/ai-usage-telemetry-storage.test.ts`; updated `tests/unit/{gemini-client,suggestion-service,contact-service,ops-monitoring,ops-instrumentation,admin-telemetry,admin-operations-ui}.test.ts(x)` and `tests/unit/admin-telemetry-page.test.tsx`.
- Migration: **applied** to the configured Neon database on 2026-10-12 with owner authorization in chat (psql 17.11, stop on error, transaction-local 10s lock and 180s statement timeouts, from a scratch copy that differs from the repository file only by those two lines). Live check names were read first and match the ones the migration replaces. Aggregates only: 5,311 runs (2,809 suggestions, 2,502 searches), 16,226 suggestion items and 32 operational events before and after, row fingerprints identical; 22 columns became 30, all eight new ones nullable and empty on every row; both checks widened; the new index present; no contact row and no `ai` event yet.
- The deployed application is unaffected by the migration (both checks are only widened and it names none of the new columns). The new application needs the migration first, which is done.
- Validation (Node 20.19.0): `tsc` clean; ESLint on the changed files clean; focused files passed, then full Vitest with native PostgreSQL 224 files / 1741 passed; the migration is tested against embedded PostgreSQL from the deployed shape (with and without the operations tables, run twice, rows kept, same columns as `schema.sql`); security scan and `git diff --check` passed.
- Not verified: a real model call, so whether Gemini reports `usageMetadata` and `webSearchQueries` for the configured model with search grounding is read from the SDK types only (missing values are stored as empty, not as zero); the Admin Telemetry and Operations pages in a browser (Admin has no fixture; both are covered by render tests); the hosted site; an alert email. Production build and Playwright were not run (no seller screen changed).
- Decisions the owner may want to change: thresholds (50% of at least 10 fresh runs in 24 hours, `OPS_ALERT_AI_*`); suggestions count as degraded on the generic list only, so a failed verify pass that still served an AI answer does not count; a contact lookup that found nothing is recorded as a success with `ai_empty`; the usage table counts every fresh run, including demo and unlinked ones, unlike the other Admin tables; acceptance uses the first list shown for a request and utility.
- Known limits: usage of an attempt that failed or timed out is not reported by the provider, so totals are a floor; at about 13 fresh suggestion lookups a day, an outage is reported once 10 fresh runs accumulate, and the alert email also needs `OPS_ALERTS_ENABLED` and `OPS_ALERT_EMAIL` (not verified in hosting); retries inside one pass are not counted (`attempt_count` is passes).
- Stale comment corrected: the monitor route said it was not scheduled; `vercel.json` has run it every 15 minutes since 2026-10-05.

## Slice 5 outcome (2026-10-12, Claude Opus 5.5)

- Built: `scripts/eval/` (`eval-core.ts` pure case building, matching, scoring, totals and output; `export-silver-cases.ts`; `run-eval.ts`; `compare-evals.ts`; `cases/hard-cases.json`; `README.md`), `tests/unit/eval-core.test.ts`, three `eval:*` package scripts, `/.eval/` in `.gitignore`. One application change: `getSuggestionsFresh` in `lib/providers/suggestion-service.ts` (the two-pass pipeline with no cache, workspace history or telemetry, like `searchProvidersFresh`), with a unit test. No prompt, gate, route, schema or seller screen changed.
- How it runs: one configuration per run (model, thinking level, one or two passes, recovery, search on or off), set through the pipeline's own environment settings before it is loaded; `DATABASE_URL` and the cache settings are removed in the process, so a run cannot reach the live database or cache. Without `--yes` it prints the plan only. Prompt and gate variants are code changes: run before and after with different labels; the result file records the commit.
- Export (owner-approved in chat, read-only transaction, run once on 2026-10-12): the query selects city, state, ZIP, category, entry mode and provider name only; no street address, name, email, phone or identifier is selected. Left out: demo and deleted requests, requests edited after submission, non-answers and anything that looks like contact details. Result: 2,920 seller answers kept, grouped into 1,940 cases in 406 localities (18 states, mostly OH, PA, KY, NJ); 553 cases have 2 or more answers. File: `.eval/cases/silver.json`, ignored. **Not safe to commit:** a few typed names read like a person's name.
- Hard cases: 12 written from general knowledge, each marked `"verified": false`. Still owed (owner or a later session): check them against the providers' own sites, and add about 8 more of the kinds section 9 lists that need local knowledge (township differs from mailing city, unincorporated land, rural propane or oil, new subdivision).
- Slice 4 check before the run: the `6ba63ff` deployment was Ready and on the production alias by about 16:02 UTC. No seller lookup was recorded after that during this session, so **usage on a real production lookup is still unconfirmed**; Admin Telemetry was not opened (no signed-in browser). The evaluation itself confirmed that the provider reports token counts for the configured model.
- First run (owner-approved, stated beforehand as at most 90 calls): 30 cases (18 silver with 2 or more answers, two per category; 12 hard), `gemini-3.1-flash-lite`, thinking `low`, two passes plus recovery, search on, at `6ba63ff` plus this slice's changes. 55 model calls, no failures, no unreadable answers.

| Measure | All 30 | Silver 18 | Hard 12 |
|---|---|---|---|
| Correct top answer | 20 (67%) | 14 | 6 |
| Correct answer in top 3 | 24 (80%) | 18 | 6 |
| Ended on the generic list | 7 (23%) | 1 | 6 |

- Also measured: latency p50 8.6 s, p95 11.5 s. Per call about 440 prompt, 310 output and 440 thinking tokens. Token cost $0.068 for the run, $0.0028 per case with a top-3 answer. Extra names per one-provider case: 2.5.
- **Finding 1 (corrected later the same day, see "Slice 6, fourth measurement": the reported count is unreliable under the JSON format), search is on but was never used.** All 55 calls reported 0 searches, 0 sources and no search-result tokens. Four raw calls were made to understand this (59 calls in all): the same model with the search tool did not search for a plain "which utility serves" question with or without the JSON schema, nor did `gemini-3.5-flash-lite`; it did search (2 queries, metadata returned) when the prompt told it to search and cite. So the tool works on this key and the telemetry code can read it; with today's prompts the model answers from memory. To verify on production telemetry once lookups land: whether searches are 0 there too. If so, the 5,000 monthly searches are untouched and the audit's search-cost range is $0. Not verified: whether the model searches under the JSON schema when told to.
- **Finding 2, one right answer is thrown away.** 5 of the 6 hard misses are `quality_gate_failed`: single-utility cities (Chattanooga, Sacramento, Lihue, Memphis, Jacksonville) where the gate wants 2 names, so the seller would see the national list. A raw call for Chattanooga returned the right utility alone. The sixth (Kansas City, MO water) is `state_mismatch_rejected`, the state-name filter. This is direct evidence for R4 and R13.
- Finding 3: thinking at `low` uses about 440 tokens a call, four times the audit's assumption, and more than the visible answer.
- Limits of this run: 30 cases, one run each (no repeat, so no measure of run-to-run variation); silver answers picked from a suggestion favor the current pipeline; the hard answers are unverified; partial name matching is a proxy; search and contact lookups are not covered; latency per pass and source-domain quality are not measured.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 225 files / 1760 passed; security scan and `git diff --check` passed. The export and the runner were exercised by the real export and the real run. Production build and Playwright not run (no seller screen changed).
- Live actions in this slice: read-only aggregate checks of recent AI runs, the read-only export, 59 model calls and 2 Google searches. No live write, commit, push or deploy.

## Slice 6, first measurement: single-provider answers [R4] and the state-name filter [R13] (2026-10-12, Claude Opus 5.5)

Owner agreed in chat to repeat runs on the same 30 cases. Built, validated, then committed and pushed to origin/main with owner authorization in chat on 2026-10-12. Deployment not verified here.

- What changed (`lib/providers/suggestion-service.ts`):
  - First-pass prompt: for electric, gas, water and sewer it asks for the one provider that serves the address, a second only where the area is genuinely split; for the other categories "up to 5 that actually serve this area". The "5-8 candidates" rule is gone. Verify and recovery prompts no longer ask for "3 to 5": one-provider categories say one is a complete answer, the others say to keep every provider that serves the address.
  - Gate: one confident name is accepted in every category (`DEFAULT_MIN_VALID_SUGGESTIONS` 2 to 1). The confidence floor (0.45) is unchanged. `SUGGESTIONS_MIN_VALID_RESULTS` still overrides it; the owner reported in chat on 2026-10-12 that it is not set in hosting, so the new default applies.
  - State-name filter: a state's name used as a place is no longer read as that state: the property's own city ("Kansas City", MO), "<State> City / County / Township / Borough ...", and a bare "Washington" (only "Washington State" or "State of Washington" count). A name or rationale that names another state is still rejected.
  - Versions: prompt `provider-suggestions-v2`; suggestion cache `v9` (search cache stays `v8`). On deploy the suggestion cache starts empty again.
- Scoring fix in `scripts/eval/eval-core.ts`: accents and apostrophe-like marks are dropped before matching ("Kauaʻi" is "Kauai"). All four runs below are scored with that rule; under the old rule the baseline numbers are the same.
- Result, same 30 cases and settings (`gemini-3.1-flash-lite`, thinking `low`, two passes plus recovery), one run each:

| Measure | Before (baseline) | After (final) |
|---|---|---|
| Correct top answer | 20/30 | 27/30 |
| Correct answer in top 3 | 24/30 | 28/30 |
| Ended on the generic list | 7/30 | 0/30 |
| Hard cases, correct top answer | 6/12 | 12/12 |
| Silver cases, top answer / top 3 | 14 / 18 of 18 | 15 / 16 of 18 |
| Extra names per one-provider case | 2.5 | 0.3 |
| Latency p50 / p95 | 8.6 s / 11.5 s | 6.6 s / 10.9 s |
| Token cost per run | $0.068 | $0.050 |
| Searches | 0 | 0 |

- Two intermediate runs explain two design choices: with the gate at 1 only for one-provider categories, both cable cases fell to the generic list (the model returned one name, the gate wanted two), so the gate is 1 everywhere; with "one provider is a complete answer" in every verify prompt, cable and trash lists shrank to one name, so the later passes now differ by category (names per multi-provider case: 4.4 before, 4.0 after).
- Honest reading: the hard-case and generic-list gains are far larger than the run-to-run variation seen (a case or two per run). The silver top-3 count went from 18 to 16. Both losses are multi-provider cases: Kresgeville propane (the accepted dealer was returned in one of the three later runs and not in the others) and Dayton cable (sellers named a satellite and a fiber company; the model now leads with the cable incumbent). Not proven to be noise.
- Limits unchanged from slice 5: 30 cases, single runs, unverified hard answers, silver answers that favor the old pipeline, suggestions only.
- Validation (Node 20.19.0): tests written with the change; `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 225 files / 1765 passed; security scan and `git diff --check` passed. Production build and Playwright not run (no seller screen changed). Not verified: the hosted site, the hosting value of `SUGGESTIONS_MIN_VALID_RESULTS`.
- Model use for this measurement: 3 runs, 180 model calls, 0 searches. Session total: 239 model calls, 2 searches.
- Seller-visible effect once deployed: one-provider categories usually show one suggestion where they showed three to five; the seller can still search or type another name.

## Slice 6, second measurement: one pass versus two [R8] (2026-10-12, Claude Opus 5.5)

No code change; `--passes one` turns the verify pass off. Same 30 cases, same code as the "after" run above, one run each. 30 model calls, 0 searches.

| Measure | Two passes | One pass |
|---|---|---|
| Correct top answer | 27/30 | 24/30 |
| Correct answer in top 3 | 28/30 | 28/30 |
| Ended on the generic list | 0/30 | 0/30 |
| One-provider cases (20), correct top answer | 20 | 20 |
| Multi-provider cases (10), correct top answer / top 3 | 7 / 8 | 4 / 8 |
| Latency p50 / p95 | 6.6 s / 10.9 s | 3.4 s / 5.0 s |
| Model calls | 60 | 30 |
| Token cost per run | $0.050 | $0.025 |

- Reading: for electric, gas, water and sewer the verify pass changed nothing in 20 of 20 cases and doubles the wait. For propane, oil and internet the accepted name was first less often without it (3 cases moved from first to second or third). That difference is about the size of the reordering seen between repeat runs of the same configuration, so it is suggestive, not established.
- Recommendation for the owner (agreed and built the same day, see the R8 section below): skip the verify pass for electric, gas, water and sewer; keep it for the other categories until a repeat run on more multi-provider cases settles it. Roughly: half the wait and half the calls for most lookups, no measured loss.
- Limits as before: 30 cases, single runs, 10 multi-provider cases only.

## Hosting settings the owner showed on 2026-10-12 (screenshot in chat, not verified here)

`SUGGESTIONS_SHADOW_MODE=true`, `SUGGESTIONS_SERVE_NEW_PIPELINE=true`, `SUGGESTIONS_CANARY_PERCENT=100`, `GEMINI_GOOGLE_SEARCH_GROUNDING=true`, `ENABLE_REQUEST_DIAGNOSTICS=false`. `SUGGESTIONS_MIN_VALID_RESULTS` is not set.

- **Finding (read from code, `runSuggestionPipeline` and `runSearchPipeline`):** with shadow mode on, every fresh suggestion lookup and every fresh search also runs the legacy pipeline as a shadow: one extra model call each, whose answer is only logged as a count comparison and whose usage is not recorded. With the canary at 100 the new pipeline is always the one served, so the shadow serves no purpose. It also waits for the slower of the two before answering, and its failures count toward the shared circuit breaker.
- Owner action recommended (owner reported it done the same day): delete `SUGGESTIONS_SHADOW_MODE` (and the two companions) in hosting, then redeploy. No code change is needed; with it unset only the new pipeline runs. The evaluation already runs without it. Until then Admin Telemetry usage is a floor: it leaves out the shadow call.
- Slice 7 (R14) removes the legacy pipeline and these switches from the code.

## Slice 6, R8 decision and build: no verify pass where one provider serves an address (2026-10-12, Claude Opus 5.5)

- Owner agreed in chat on 2026-10-12 to the recommendation above. Built and validated, then committed and pushed to origin/main with owner authorization in chat on 2026-10-12. Deployment not verified here.
- Change (`lib/providers/suggestion-service.ts`, `runTwoPassSuggestionPipeline`): the verify pass runs only for trash, propane, oil, internet and cable. Electric, gas, water and sewer take one pass; the recovery pass still runs when that pass is rejected. `SUGGESTIONS_TWO_PASS_VERIFY=false` still turns verify off everywhere. No prompt, gate or cache key change, so no version bump.
- Tests: the two-pass, deadline and usage tests now use a category that verifies; one new test covers both groups. `scripts/eval/README.md` says what `--passes two` now means.
- Confirmation run, same 30 cases (40 model calls, 0 searches):

| Measure | Two passes everywhere | Verify for multi-provider only |
|---|---|---|
| Correct top answer | 27/30 | 25/30 |
| Correct answer in top 3 | 28/30 | 28/30 |
| Ended on the generic list | 0/30 | 0/30 |
| One-provider cases (20): top answer / top 3 | 20 / 20 | 19 / 20 |
| Multi-provider cases (10): top answer / top 3 | 7 / 8 | 6 / 8 |
| Latency p50, all / one-provider cases | 6.6 s | 3.5 s / 3.2 s |
| Model calls | 60 | 40 |

- Reading: top 3 and the generic-list rate are unchanged; the wait for electric, gas, water and sewer is about half. Top answer is 2 lower in this run. One is a one-provider case (Pocono Lake electric: the accepted utility came second behind a neighboring one; it was first in the earlier one-pass run of the same code path), one is a multi-provider case whose pipeline did not change. Both are within the reordering seen between repeat runs, but a single run cannot show the change is free.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 225 files / 1766 passed; security scan and `git diff --check` passed. Production build and Playwright not run.

## Production check of slice 4 (2026-10-12)

Confirmed by the owner's Admin Telemetry screenshot and a read-only aggregate query: after the `6ba63ff` deployment, 6 fresh suggestion runs and 6 contact lookups recorded tokens and thinking level `low`, each with 0 searches and 0 sources (suggestions: 11 passes, 5,340 prompt, 3,700 output and 5,794 thinking tokens, average 9.2 s; contacts: about 460 prompt, 100 output and 400 thinking tokens each, average 3.6 s). The reported search count is 0 in production as in the evaluation; that count was later found unreliable under the JSON format (see "Slice 6, fourth measurement"), so it does not show the allowance is unused. Those runs were on the old prompt (`provider-suggestions-v1`).

Owner reported in chat on 2026-10-12 (not verified here): `SUGGESTIONS_SHADOW_MODE`, `SUGGESTIONS_SERVE_NEW_PIPELINE` and `SUGGESTIONS_CANARY_PERCENT` are deleted in hosting. Two production deployments were Ready at about 17:50 and 17:56 UTC; which one carries the deletion was not checked.

## Slice 6, third measurement: telling the model to search (2026-10-12, Claude Opus 5.5)

Owner agreed in chat. Nothing shipped: the prompt line was a temporary local edit, removed after the run (`git status` clean).

- What was tried: one sentence added to all three suggestion prompts, "Before answering, use Google Search to check which providers serve this exact location, and base your answer on what you find." Same 30 cases, at `3be14f5`.
- Result: **the model still ran 0 searches** in 41 calls. Accuracy, wait and cost were the same as without the sentence within run-to-run variation (top answer 25/30 both, top 3 29 against 28, generic list 0, p50 3.4 s).
- Three raw calls to find out why: asked outright to search for propane companies in one town, `gemini-3.1-flash-lite` ran no search as plain text or with the JSON schema, and neither did `gemini-3.5-flash-lite`. Earlier the same model did search when asked for a current phone number and recent news with citations. So these models decide for themselves, and they treat "which utility serves this town" as something they already know. An instruction in the prompt does not change that.
- What this was taken to mean at the time (**withdrawn**, see "Slice 6, fourth measurement"): Google Search grounding contributes nothing to suggestions today, in production or in the evaluation, and cannot be switched on by wording alone. The audit's search-cost range is $0, and the "grounded" label on these answers is not earned. Not tested: forcing a search some other way, or a larger model.
- Suggested follow-up (not run, needs the owner's go-ahead): one run with `--grounding off`. If results are the same, the search tool can be turned off for suggestions, which removes the dependency on combining structured output with built-in tools (the cause of the July incident, and documented by Google as a preview feature).
- Model use: 41 calls plus 3 raw calls, 0 searches. Session total: 353 model calls, 2 searches.

## Slice 6, fourth measurement: search tool off, and a correction (2026-10-12, Claude Opus 5.5)

Owner agreed in chat. `--grounding off`, same 30 cases at `3be14f5`, 40 model calls. No code change.

| Measure | Search tool on | Search tool off |
|---|---|---|
| Correct top answer | 25/30 | 25/30 |
| Correct answer in top 3 | 28/30 | 25/30 |
| One-provider cases (20): top answer | 19 to 20 | 20 |
| Hard cases (12): top answer | 12 | 12 |
| Multi-provider cases (10): top 3 | 8 | 5 |
| Latency p50 / p95 | 3.5 s / 9.3 s | 1.7 s / 4.6 s |
| Per call: prompt / thinking tokens | about 505 / 330 | about 375 / 110 |
| Token cost per run | $0.040 | $0.025 |

- With the tool off, propane and oil answers changed character: the local dealers sellers actually named (returned in every run with the tool on) were replaced by national brands and by names that did not appear in any other run. Electric, gas, water, sewer and all 12 hard cases were unaffected.
- **Correction to findings recorded earlier today** ("search is on but was never used", "the monthly allowance is untouched", "search cost is $0", "grounding contributes nothing"). Those rested on the reported search count, and that count is not reliable when a JSON schema is attached. Evidence: one prompt that reports 3 searches and 3 sources as plain text reports 0 of each with the JSON schema, while its thinking tokens double (218 to 435) and the tool still adds about 115 prompt tokens; and the table above shows the tool's presence changes answers, token use and wait. The likely reading is that searches do run under the JSON format and are not reported back. A second reading, that the tool only makes the model think longer, fits the tokens and the wait but not the appearance of real small local dealers.
- Consequences:
  - `search_query_count` and `source_count` in AI telemetry, and "Search queries" on Admin Telemetry, will read 0 for every suggestion, search and contact call. That says nothing about what Google counts or bills. The columns are still correct for any call made without a JSON schema (none today).
  - What Google counts can only be read on Google's side. Owner check: the usage or billing page for Grounding with Google Search for 2026-10-12. Today's evaluation made about 320 calls with the tool attached; if searches ran, they came out of the shared 5,000.
  - The audit's search-cost range stays an open estimate, not $0.
  - The search-prompt measurement above still stands as measured (the added sentence changed no result), but its explanation ("the model decides not to search") is withdrawn.
- Decision supported by this run: **keep the search tool on.** Turning it off loses local providers in the categories where sellers most need them.
- Possible later option, not recommended yet: tool off for electric, gas, water and sewer only (no loss on these 20 cases, half the wait). The 20 cases are mostly large utilities; small boroughs and townships are under-represented, so measure on more local water and sewer cases first.
- Model use: 40 calls plus 3 raw calls. Session total: 396 model calls. Searches reported by the API: 5. Searches actually run: unknown, see above.

## Case file check (2026-10-12, Claude Opus 5.5)

Owner asked in chat. Web reading only: no model call, no live database read, no commit.

- **The 12 hard cases, checked against the providers' own sites.** No answer was wrong. 11 are now `"verified": true` in `scripts/eval/cases/hard-cases.json`. Arlington, VA gas stays `false`: the provider's site confirms Virginia and lists Arlington County among Virginia code authorities, but its territory map is an image and no text names Arlington. Three checks rest on a search excerpt of the provider's page because the page itself could not be fetched (CenterPoint 403, Oncor timeout, JEA bot check). Three aliases are not spelled out on the pages read and are kept only as matching aids: "Electric Power Board of Chattanooga", "Kansas City Water Services", "Jacksonville Electric Authority" (the last appears in a JEA disclosure report as a former name).
- **17 local hard cases drafted, not finalized:** `.eval/cases/local-hard-cases.draft.json` (ignored folder, awaiting the owner's review). Places come from `silver.json`; every accepted name was read on the provider's own site. 9 small-town water and sewer, 4 where the mailing city is not the municipality (Enola, Boalsburg twice, Rancocas), 4 rural propane and oil. The file holds place, category, public provider names and domains only; no seller-typed text.
- Weaker points in the draft: Bellbrook sewer and Eastlake water rest on search excerpts of the county pages (direct fetch refused or the page did not show the list); that Boalsburg is in Harris Township is general knowledge, not on the provider sites; Kresgeville oil uses a dealer verified on its own site (R.F. Ohl) that is not a name sellers gave.
- Could not be verified on a provider site, so left out: Paraco for Kresgeville and Saylorsburg (branch 2 miles away, no town list), Liberty Oil, Stiff Oil, Snedeker Energy and Kern River Propane (no own site found), R.D. Holder and Santmyer (no town list). Rural propane and oil are thin for that reason: 4 cases, 3 of them in the Poconos.
- **Open decision for the owner:** where the local cases go. Adding them to `hard-cases.json` changes which cases `--hard 12` picks, so earlier runs stop being comparable. Recommended: a second committed file, `scripts/eval/cases/local-hard-cases.json`, run with the existing `--hard-cases` option, plus a README line.
- **Finalized the same day (owner agreed to the recommendation in chat, no case dropped):** the 17 cases are in the new `scripts/eval/cases/local-hard-cases.json`; the draft in `.eval/` is gone. `scripts/eval/README.md` describes the file and the `--hard-cases` option; `tests/unit/eval-core.test.ts` reads both committed files. Uncommitted; no run has been made on these cases (a full run is at most 51 model calls and needs the owner's go-ahead).
- Validation (Node 20.19.0): `tests/unit/eval-core.test.ts` 19/19; ESLint on the test file clean; the runner's plan-only mode reads the new file (17 hard cases, no model call); `git diff --check` passed. Full Vitest, `tsc` and the security scan not rerun (JSON, one test and a README changed).

- Committed on main as `a7bb16c` with owner authorization in chat on 2026-10-12. Not pushed.

## Slice 6, fifth measurement: the 17 local cases (2026-10-12, Claude Opus 5.5)

Owner agreed in chat. One run at `a7bb16c`, production settings (`gemini-3.1-flash-lite`, thinking `low`, verify for multi-provider categories, recovery on, search tool on). 21 model calls, no failures. Results: `.eval/results/20261012T183725Z-local-hard-a7bb16c.*` (ignored).

| Measure | All 17 | Water and sewer (13) | Propane and oil (4) |
|---|---|---|---|
| Correct top answer | 15 | 12 | 3 |
| Correct answer in top 3 | 16 | 13 | 3 |
| Ended on the generic list | 0 | 0 | 0 |

- Also: latency p50 3.2 s, p95 8.9 s; website domain matched in 15 of 16; water and sewer returned one name in 12 of 13 cases; token cost $0.018.
- The one water miss at first place is Rancocas, NJ (a village in Westampton Township): the large private water company came first and the right authority second. It is the only case of 13 where the model returned two names. One case, but it is the kind R10 (county and township context) is meant to help.
- Old Saybrook oil returned five local dealers and not the accepted one. That is the case file's known limit (one checked dealer accepted where several deliver), not evidence of a wrong answer; the five names were not checked.
- Reading: on small-town and township water and sewer the current pipeline was right in 12 of 13 at first place and 13 of 13 in the top two, in one pass at about 3 seconds. This is the first evidence on small places; it is one run of 13 cases, and four of the answers were scored by partial name match or an accepted alternate.
- Session total after this run: 417 model calls.

## Slice 6, sixth measurement: the 17 local cases with the search tool off (2026-10-12, Claude Opus 5.5)

Owner agreed in chat. `--grounding off`, same code and cases, 21 model calls, no searches. Results: `.eval/results/20261012T184154Z-local-hard-no-search.*` (ignored).

| Measure | Search tool on | Search tool off |
|---|---|---|
| Correct top answer, all 17 | 15 | 10 |
| Correct answer in top 3, all 17 | 16 | 10 |
| Water and sewer (13): top answer / top 3 | 12 / 13 | 9 / 9 |
| Propane and oil (4): top 3 | 3 | 1 |
| Top answer with the exact name | 13 | 1 |
| Website domain matched | 15 of 16 | 7 of 10 |
| Latency p50 | 3.2 s | 1.6 s |

- With the tool off the model stops naming the real provider and writes a plausible one from the place name: "City of Eastlake Water Department" (the county supplies it), "City of Bellbrook Water & Sewer Department" for sewer (the county), "Harris Township Water Authority" for Boalsburg sewer (a regional authority), and New Jersey American Water alone for Rancocas. The split and township cases are exactly the ones it loses.
- The count of 9 is generous. Several of those are partial name matches on an invented department ("Lehighton Borough Water Department" for the Lehighton Water Authority, with the wrong website); only 1 of 17 top answers carried the provider's exact name, against 13 with the tool on.
- Propane lost the dealer with an office in the village to national brands, as in the fourth measurement.
- **Decision supported: keep the search tool on for every category, including electric, gas, water and sewer.** The "possible later option" in the fourth measurement (tool off for those four) is withdrawn: it held on large utilities and fails on small places. The halved wait is not worth it.
- This also strengthens the fourth measurement's correction: the tool's presence changes answers on facts the model does not know, so searches do appear to run under the JSON format even though none is reported.
- Limits: one run each, 17 cases; partial matching flatters the tool-off column.
- Session total: 438 model calls.

## Slice 6, R10: county and township context (2026-10-12, Claude Opus 5.5, later session)

Status: **measured (owner agreed in chat): no effect. The production plumbing is not built and is not recommended on this evidence.** The measurement seam stays and is pushed with R11.

- Verified in code: the suggestion pipeline receives the address as one string and parses city, state and ZIP from it; `parseGooglePlaceAddress` drops Google's county and uses the township only when there is no city; `requests.property_address_structured` is JSONB, so county and township can be stored there with no migration.
- Built, measurement only: `LocalityHint` (`county`, `municipality`) on `ParsedLocation`; `buildLocationContext` adds a `Municipality:` line (only when it differs from the city) and a `County:` line; `getSuggestionsFresh` takes the hint as a third argument; `--locality on|off` in the runner (default off) and optional `county` / `municipality` on a case. No seller lookup passes a hint, so production prompts are unchanged and no version was bumped.
- The 17 local cases now carry a county, and 7 carry a municipality (Enola, Boalsburg twice, Rancocas, Effort, Tobyhanna, Kresgeville). **Assumption:** these values are general knowledge and the case notes, not read from Google Places.
- What the run can and cannot show: the fifth measurement already has water and sewer right in 12 of 13 at first place, so the possible gain on these cases is one (Rancocas). The run mainly shows whether the extra lines do harm, for example pulling Bellbrook water (city) toward the county.
- **Not measured and a real risk for the production plumbing:** what Google returns as the township for an address inside an incorporated city. In Ohio a city often sits inside a township of another name; sending that township could mislead. Read real Places output for a few such addresses before storing or sending it.
- If the run supports it, the production work is: keep county and township in `parseGooglePlaceAddress` and `PropertyAddressStructured`, carry them from the two address fields to request creation, pass them to `getSuggestions`, add them to the suggestion cache key and bump the prompt and cache versions. Applies only to addresses picked from autocomplete.
- Validation (Node 20.19.0): `tests/unit/{location-parser,eval-core,suggestion-service}.test.ts` 72/72; `tsc` clean; ESLint on changed files clean; `git diff --check` passed; plan-only runner output: 17 cases, at most 51 calls.

- **Result, one run at `c902e17` plus this section's changes, production settings, 21 model calls, no failures** (`.eval/results/20261012T185320Z-local-hard-locality.*`, ignored), against the fifth measurement:

| Measure | Without | With county and township |
|---|---|---|
| Correct top answer, all 17 | 15 | 15 |
| Correct answer in top 3, all 17 | 16 | 16 |
| Water and sewer (13): top answer / top 3 | 12 / 13 | 12 / 13 |
| Top answer with the exact name | 13 | 11 |
| Website domain matched | 15 of 16 | 14 of 16 |
| Latency p50 | 3.2 s | 3.6 s |

- Every one of the 17 cases returned the same provider first in both runs. Rancocas, the case R10 was meant to help, still put the private water company first and the right authority second with "Westampton Township" and "Burlington County" in the prompt. The two exact-name differences are longer names for the same provider ("City of Bellbrook Water Department", "Borough of Woodstown Water/Sewer Department"). No harm seen either: Bellbrook water stayed with the city.
- Reading: with the search tool on, the model already finds the township or county provider from city, state and ZIP. The context adds nothing measurable on these cases, and the plumbing would split the cache further and carry the unmeasured Ohio township risk. **Recommendation: do not build it now.** Reopen if production shows wrong water or sewer answers in township addresses. One run, 17 cases, so a small effect cannot be excluded.

## Slice 6, R9: model trial (2026-10-12, Claude Opus 5.5, later session)

Owner agreed in chat to both models on both case sets. Production settings (thinking `low`, verify for multi-provider categories, recovery on, search tool on), one run each, no code change. 111 model calls. Results: `.eval/results/20261012T1854*-r9-35fl-30.*`, `20261012T1855*-r9-35fl-local.*`, `20261012T1855*-r9-38f-30.*`, `20261012T1857*-r9-38f-local.*` (ignored). The current model's columns are the earlier runs (`verify-multi-only` and the fifth measurement).

| Measure | `gemini-3.1-flash-lite` (current) | `gemini-3.5-flash-lite` | `gemini-3.8-flash` |
|---|---|---|---|
| 30 cases: top answer / top 3 | 25 / 28 | 26 / 27 | 26 / 26 |
| 30 cases: generic list / timeouts | 0 / 0 | 0 / 0 | 2 / 2 |
| 17 local cases: top answer / top 3 | 15 / 16 | 14 / 14 (15 / 15, see below) | 11 / 11 |
| 17 local cases: generic list / timeouts | 0 / 0 | 0 / 0 | 5 / 5 |
| Latency p50, 30 cases / local | 3.5 s / 3.2 s | 3.2 s / 2.9 s | 5.9 s / 6.4 s |
| Latency p50, electric, gas, water, sewer | 3.2 s / 3.1 s | 2.2 s / 2.1 s | 4.6 s / 4.4 s |
| Token cost, 30-case run | $0.040 | $0.023 | $0.031 |

- **`gemini-3.8-flash` does not fit the 10 second call limit:** 7 of 47 cases timed out and went to the generic list (the local run hit the stop rule on its last cases). Where it answered it was as accurate as the others. It would need a longer timeout, which sellers would feel. Not recommended.
- **`gemini-3.5-flash-lite` works and is about a second faster per call.** 61 calls, no failure and no empty or unreadable answer, so the July fault did not recur. Accuracy is the same within the run-to-run variation seen today: one more top answer on the 30 cases, one fewer in the top 3 (Tobyhanna propane, the accepted dealer came fourth). On the local cases one "miss" is a scoring artifact ("Greene County Sanitary Engineer", the right provider with a clipped name), and Rancocas returned the private water company alone where the current model also gives the right authority second.
- It reported no thinking tokens at `low`. Its token cost per run is lower despite the higher list price, but "not reported" is not proof of zero, so read the cost as a floor.
- **Recommendation: stay on `gemini-3.1-flash-lite`.** The README rule asks that a change lower neither rate; top 3 was lower by one and by two (one after the scoring artifact) on single runs. The trial does show `gemini-3.5-flash-lite` is a ready replacement if the current model is retired: set `GEMINI_MODEL_NAME` in hosting, no code change, and the suggestion, search and contact caches start empty because the model name is part of their keys. A repeat run of both models would be needed before switching for speed alone.
- Limits: single runs, 47 cases, search and contact lookups not covered, thinking level `low` only.
- Model use in this session: 21 (R10) + 111 (R9) = 132 calls with the search tool attached. Day total 570.

## Slice 6, R11: honest fallback (2026-10-12, Claude Opus 5.5, later session)

Status: **built, validated, committed and pushed to origin/main with owner authorization in chat on 2026-10-12. Deployment not verified here.** Owner chose "split by category" in chat on 2026-10-12.

- Before: when no AI answer was usable the seller saw national names under "Suggested for your area", including placeholders such as "Municipal Water Authority" (report I5: 31% acceptance, half the sellers typed their own).
- Now (`getFallbackSuggestions` in `lib/providers/suggestion-service.ts`): for electric, gas, water and sewer the list is empty, so the seller gets the existing "Help us find your provider" screen with Search and "I'm not sure". For trash, propane, oil, internet and cable the national names are still offered, each marked `is_common`, and the placeholder "Municipal Sanitation" is left out. `components/seller-form/steps/UtilityStep.tsx` shows "Common providers" in place of "Suggested for your area" (three places) when every loaded suggestion is marked. `ProviderSuggestion` gained optional `is_common`.
- Unchanged: the outcome is still recorded as `source = 'fallback'`, so telemetry, Admin Telemetry and the AI health alert count it as before; the 5 minute cache time for a fallback; search by name against the national list (`getFallbackSearchResults`); picking a common provider is still stored as `suggested_confirmed`. No prompt or cache version change (a fallback is cached for 5 minutes).
- How often it shows: 0 of 47 evaluation cases on the current model after R4; in production it now needs a timeout, a model error or a rejected answer. Production rate after the R4 deployment was not read.
- Files: the two above, `types/index.ts`, `docs/ai-telemetry.md` (one sentence), `tests/unit/suggestion-service.test.ts`, `tests/unit/utility-step-search.test.tsx`.
- Validation for the whole session's changes (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 225 files / 1771 passed; security scan and `git diff --check` passed. **Not run:** Playwright and the production build; the new label is covered by a render test only and was not seen in a browser. Not verified: the hosted site.
- For the owner to look at: the label "Common providers", and that Admin Telemetry's acceptance table will show fallback rows with no items for the four one-provider categories.

## Next action

Slice 6 is complete and pushed. No migration is pending. Owner: confirm the deployment and look at a seller form. Slice 7 (R12 source-based trust, R14 removal of the legacy pipeline and its switches) is what remains. Still open from earlier, owner: look up the Grounding with Google Search count for 2026-10-12 on Google's side; it settles whether searches run under the JSON format and what today's runs used. Until then, treat every evaluation run with the tool on as spending searches, and ask before another. Still open in slice 6: R9 model trial (`--model`, no code change), R10 county and township, R11 honest fallback wording. A small follow-up worth doing: say on Admin Telemetry and in `docs/ai-telemetry.md` that the search count is not reported for JSON-format calls. The 12 hard cases are checked (11 verified); the 17 local cases are in their own file, uncommitted and not yet run. More rural propane and oil cases would need a phone call or the dealers' own town lists.
