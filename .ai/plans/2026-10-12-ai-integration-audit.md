# AI integration, model selection and cost audit

- Status: **In progress.** Slices 1 to 3 of 7 are done and committed and pushed to origin/main on 2026-10-12 (`214ad72`), deployment not verified. Slice 4 is done with its migration applied, committed and pushed the same day (`6ba63ff`), and its deployment was seen Ready on the production alias on 2026-10-12. Slice 5 is built, validated and has had its first run; it is committed and pushed (see "Progress" and the outcome sections). Slice 6 is in progress: R4 and R13 are committed and pushed (`77e08ef`), R8 is committed and pushed. Slice 4 usage recording is confirmed on real production lookups. Investigation completed 2026-10-12 by Claude Code (Opus 5.5); the owner approved Option B in chat the same day (see "Owner decision").
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
| 6. Decided by the evaluation | In progress: R4 and R13 pushed 2026-10-12; R8 pushed 2026-10-12; search-prompt measurement next; R9, R10, R11 open |
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
- **Finding 1, search is on but was never used.** All 55 calls reported 0 searches, 0 sources and no search-result tokens. Four raw calls were made to understand this (59 calls in all): the same model with the search tool did not search for a plain "which utility serves" question with or without the JSON schema, nor did `gemini-3.5-flash-lite`; it did search (2 queries, metadata returned) when the prompt told it to search and cite. So the tool works on this key and the telemetry code can read it; with today's prompts the model answers from memory. To verify on production telemetry once lookups land: whether searches are 0 there too. If so, the 5,000 monthly searches are untouched and the audit's search-cost range is $0. Not verified: whether the model searches under the JSON schema when told to.
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

Confirmed by the owner's Admin Telemetry screenshot and a read-only aggregate query: after the `6ba63ff` deployment, 6 fresh suggestion runs and 6 contact lookups recorded tokens and thinking level `low`, each with 0 searches and 0 sources (suggestions: 11 passes, 5,340 prompt, 3,700 output and 5,794 thinking tokens, average 9.2 s; contacts: about 460 prompt, 100 output and 400 thinking tokens each, average 3.6 s). So production also answers without searching, as the evaluation found, and the monthly search allowance is not being used. Those runs were on the old prompt (`provider-suggestions-v1`).

Owner reported in chat on 2026-10-12 (not verified here): `SUGGESTIONS_SHADOW_MODE`, `SUGGESTIONS_SERVE_NEW_PIPELINE` and `SUGGESTIONS_CANARY_PERCENT` are deleted in hosting. Two production deployments were Ready at about 17:50 and 17:56 UTC; which one carries the deletion was not checked.

## Next action

Owner agreed in chat on 2026-10-12 to commit and push R8 and to the last agreed measurement: a prompt that tells the model to search, the only one that uses the search allowance (production and the evaluation both show 0 searches today, so this would add a cost that does not exist now; measure what it adds before deciding). Still open in slice 6: R9 model trial, R10 county and township, R11 honest fallback. Still owed: verify the 12 hard cases and add local ones.
