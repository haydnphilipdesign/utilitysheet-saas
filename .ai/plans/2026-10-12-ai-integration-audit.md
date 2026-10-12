# AI integration, model selection and cost audit

- Status: **In progress.** Slices 1 to 3 of 7 are done and committed on main on 2026-10-12, not pushed or deployed (see "Progress" and the outcome sections); slice 4 is next. Investigation completed 2026-10-12 by Claude Code (Opus 5.5); the owner approved Option B in chat the same day (see "Owner decision").
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
| 1. Cache per city [R1] | Done 2026-10-12, uncommitted, not deployed |
| 2. Timeouts [R3] | Done 2026-10-12, uncommitted, not deployed |
| 3. Search rework [R2] | Done 2026-10-12, uncommitted, not deployed |
| 4. Telemetry and alert [R5] | Not started |
| 5. Evaluation script [R6] | Not started |
| 6. Decided by the evaluation | Not started |
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

## Next action

Slices 1 to 3 are committed together (owner authorization in chat, 2026-10-12) and not pushed; ask before pushing. Next is slice 4 (telemetry and alert): read `lib/neon/queries/ai-telemetry.ts`, `docs/ai-telemetry.md`, `lib/ops/`, and `usageMetadata` / grounding metadata in the installed `@google/genai` types. Its migration is approved to be written and applied, with aggregate before and after checks, before any push.
