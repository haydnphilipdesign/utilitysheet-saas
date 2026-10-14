# Telemetry Slice 8: AI exposure, quality and cost lineage

- Date: 2026-10-14. Agent: Codex. Branch: `telemetry-slice-8`; worktree: `.worktrees/slice-8`; base: main `44391b3`.
- Status: **Completed: locally validated, live migration applied/verified and implementation committed/pushed to origin/telemetry-slice-8 (977d6c9). No required work remains for the authorized scope.** Approved decision: `../decisions/2026-10-14-ai-exposure-lineage.md`. Final outcome/validation below supersedes the retained planning snapshots.
- Parent: `2026-10-13-telemetry-audit-and-improvements.md`, Slice 8. Slices 1-7 and 9 are released per owner and main handoff; historical local-only status text in the parent is superseded by release records.
- Integration outcome: fast-forwarded this worktree to committed UX `68fbf38` first, preserving task documents; then implemented server/contracts and browser wiring. No concurrent Slice 8 editor remains. Historical ownership snapshots below explain the integration order.
- Intended outcome: distinguish generation, delivery, browser-reported rendering and accepted selection, retaining immutable origin and honest transport/usage coverage. Missing collection remains unknown.
- Non-goals: R12 contact-source trust, prompts, model selection, grounding-tool policy, quality gates, functional cache TTLs, billing/metering, PDF/email behavior, historical reconstruction, real evaluation calls or invoice reconciliation.

## 1. Verified startup and ownership

Read project AGENTS/CLAUDE guidance, suite guidance/registry/handoff, main CURRENT and active seller UX plan, telemetry parent and Slice 9 plan/release records, audit section 3, AI/privacy/Admin contracts, prior AI plan and October 13-14 decisions. Checked main status, staged/unstaged diffs, recent commits and existing worktrees. No nested AGENTS.md found. Created this worktree directly from local current main without fetch, stash, revert or commit. Production release statements rely on owner/main handoff, not a live check this session.

The initial warning about only HomeBasicsStep is superseded by the actual working tree. Claude Code owns active `2026-10-14-seller-form-device-ux.md` on main.

| Overlap or adjacent area | Verified state on main | Ownership/order |
| --- | --- | --- |
| `components/seller-form/SellerWizard.tsx` | Dirty: spinner brand contrast | Claude owns UX; lineage wiring after committed UX is integrated here |
| `components/seller-form/steps/UtilityStep.tsx` | Dirty: heading semantics, touch sizing, contrast | Same; preserve search cancellation, choices and accessibility |
| Seller tests | Dirty unit reopen, required-basics-trash-cable and review-navigation; browser review-edit; new layout device/header tests | Recheck actual diffs before shared edits; retain both UX and telemetry assertions |
| `tests/telemetry.playwright.config.ts` | Dirty: new UX registrations | Add lineage fixture after integration, keeping registrations |
| `.ai/CURRENT.md` | Claude's active handoff | Main gets only a short additive pointer; detailed state stays here |
| Seller page/layout/other steps, app CSS, intake, wizard-ui, FormEditor, branding | Also dirty for UX | No planned Slice 8 implementation edits; inspect callers only |

Main also has untracked owner `starter-task-lists-and-questions.md` and Claude's UX plan/tests. Preserve all tracked/untracked work. At startup no UX diff touches seller API routes, provider/Gemini services, AI queries, validation, Admin Telemetry or eval core. This is a snapshot, not a future guarantee.

After approval, implement contracts/server/storage first here. Before browser wiring re-read main CURRENT, UX plan, status/log/diff. Wait until relevant UX edits are committed and integration is authorized, then incorporate that commit and wire lineage. Do not copy or cherry-pick uncommitted files, switch main or edit its source. Recheck every overlap at integration. R12 stays open and unchanged in `2026-10-12-ai-integration-audit.md`.

Follow-up verification: main is now `68fbf38` (Compact the seller header and fix brand contrast across devices). Main has only the pre-existing untracked owner notes file; no tracked modifications. Its handoff reports local completion/validation, not pushed/deployed. The worktree still has only this task's three documentation files modified/untracked. Recommend incorporating committed UX first after owner authorization, keeping worktree plan/CURRENT and the UX validation records. No branch integration or implementation performed during this decision-support follow-up.

## 2. Findings verified on base 44391b3

| Problem | Current source evidence | Consequence |
| --- | --- | --- |
| Partial run/items | `lib/neon/queries/ai-telemetry.ts:persistAiSuggestionRun` inserts run, checks abort, then inserts items separately under one 500 ms deadline | Atomic generation plus all served items |
| Shared result belongs to first caller | `suggestion-service.ts:getSuggestions/searchProviders` maps key to `Promise<ProviderSuggestion[]>`; later callers return it directly; creator context alone reaches pipeline persistence | One generation, separate exposure per authorized consumer |
| Cache erases provenance | Same service caches arrays; `buildCachedOutcome` sets cache source, null reasons/error and zero passes/time; persistence reads current model/prompt | Version envelope, preserve origin; cache becomes delivery kind |
| Latest normalized-name selection | `markAiSuggestionSelection` finds latest request/category/name item; seller POST assembles name-based selection after accepted submission | Exact item plus exposure membership validation |
| Passes exclude retries | `gemini-client.ts:withRetry` can make three SDK invocations per pass; successful retry returns no recovered-failure evidence | Per-pass transport summary with recovered failures |
| Empty-response usage discarded | `generateJSONWithMeta` checks text/candidate and throws before extracting usage | Capture safe numeric metadata before answer validation |
| Missing grounding already fixed | `getUsage` requires query/chunk arrays on all candidates; `tallyPass` preserves unknown grounding; Slice 4 readers show coverage/failed-run labels/p50/p95 | Preserve, extend attempt coverage; do not claim nullable usage as new |
| Contact coverage/provenance | `contact-service.ts` caches `{v: contact}`, stamps current model on cache read and returns before recording when disabled | Preserve negative origin and record finite disabled/reached-skip states |
| Contact dedup audit claim differs | Current contact service has no in-flight map. Seller POST deduplicates targets within a submission | Do not introduce contact dedup as telemetry work; existing shared maps are suggestion/search only |
| Browser list differs from result | UtilityStep initially shows top 3, locally filters/deduplicates and suppresses remote duplicates; search observation fires on fetch completion | Ack committed visible subset with stable item identity |
| Slice 9 exists | Routes write counts/query length only; AI retention 365 days; lifecycle endpoints carry coarse device/browser | Never restore name arrays/raw headers; add explicit retention for new tables |
| Reader limitations | Admin groups mutable entries by first recorded suggestion run; eval CaseRun has passes and answered-pass usage | Keep legacy proxies distinct from new exact lineage |

References: `lib/providers/{suggestion-service,contact-service,canonicalize}.ts`, `lib/ai/gemini-client.ts`, seller suggestions/search/POST/observations routes, `lib/neon/queries/{ai-telemetry,admin-telemetry,admin-seller-progress,seller-submission,seller-observations}.ts`, `lib/telemetry/{seller-observations,seller-observer,retention,auxiliary-write}.ts`, `lib/validation/schemas.ts`, `types/index.ts`, `schema.sql`, `scripts/eval/{eval-core,run-eval}.ts`.

Installed main dependency source was read only: `@google/genai/dist/node/index.mjs:apiCall` calls fetch once without HTTP retryOptions; this app constructs GoogleGenAI with apiKey only. Count actual application generateContent invocations, not hypothetical provider retries. Guard this assumption with an installed-driver fixture. No SDK config or external price/documentation refresh proposed.

## 3. Approved contracts and flow

### Generation and consumer exposure

Reuse `ai_generation_runs` and `ai_suggestion_items` for one fresh producing result, including fallback/no-list decisions with zero model calls. Add nullable `lineage_version`: new writes 2, historical rows null. Existing `attempt_count` retains pipeline-pass meaning. Cache deliveries no longer create new v2 generation rows. Legacy rows retain original semantics.

Add `lib/telemetry/ai-lineage.ts` for bounded server/browser DTOs, UUID validation, finite origin/delivery/coverage enums and transport summary. Provider services own generation/cache; centralized AI queries own persistence; APIs own authorization; browser state owns only optional references.

Browser shape beside functional provider fields:

```ts
type ItemLineage = { exposure_id: string; run_id: string; item_id: string };
type ExposureSummary = { exposure_id: string; run_id: string | null };
// ProviderSuggestion.ai_lineage?: ItemLineage
// Empty lists carry ExposureSummary outside their items array.
```

All ids are random UUIDs without encoded capability, address, query or account. IDs confer no authority: no public get-by-ID endpoint, no ID-only write route, no authorization using these values. Seller token lookup, server request/account/category/mode resolution, limiter and public/packet token boundaries remain authoritative. Admin authorizes before reading. Never send lineage IDs to Vercel collectors or URLs.

Keep suggestion GET `{suggestions: Record<category, ProviderSuggestion[]>}` and add optional `exposures` map. Keep search's existing array body for old clients. New client opts into `lineage=2` to receive `{results, exposure}` so empty searches can carry exposure; new client also accepts old arrays/missing fields. `/api/demo/suggestions`, incident APIs and previews retain functional behavior without consumer lineage. Use private/no-store responses for lineage-bearing seller results so response reuse cannot reuse another consumer's exposure.

Replace existing shared map values with a context-free generation handle: final server-deduplicated items with pre-minted UUIDs, immutable producing metadata and one owned persistence result. Preserve current account/org/locality/model/request-format cache scoping; do not add request ID to defeat sharing. Record a separate exposure for each consumer, validated using that exposure's server-resolved request. Existing generation/item initiating context columns are compatibility metadata, never authorization or the v2 consumer denominator. Usage is counted once per generation.

The owner writes generation, all items and first exposure atomically using one CTE where practical. Followers insert their own exposures only. Each caller uses one `writeAuxiliary` operation with a 500 ms budget including waiting on shared persistence and its own exposure query; do not stack two 500 ms waits per caller. One generation persistence attempt only, no replay by followers. A missing/timed-out origin yields unknown linkage and functional results remain usable. No detached writes, queue, retry or request-path budget increase. Browser acknowledgments never gate navigation; selection telemetry never gates accepted submission. Server keeps the existing bounded awaited contract, not a zero-wait promise.

Return item references only after persistence confirms run/item/exposure membership. On unavailable/late/failed telemetry omit optional item refs, rather than invent linkage. A late committed row without a returned handle remains unacknowledged. Other consumers can still have collected exposures if their write succeeds. No replay to repair missing generation rows.

### Versioned cache

Bump suggestion/search v8 and contact v3 namespaces for envelope version 1. Retain positive/negative TTLs and current cache key scoping. Do not read old arrays as new envelopes or infer provenance from old content.

Envelope contains functional items/contact value; collected origin run/item IDs; immutable origin source/status/reason/upstream reason; explicit `list_kind: ai | common | no_list`; actual model/prompt/request-format/thinking level; produced timestamp and telemetry-version/coverage. No consumer exposure/request/edit/session/submission ids in reusable cache values. No raw prompt/response, grounding URL, typed query, street or seller identity added. Existing functional contact values stay in contact cache only, never telemetry.

Cache reads preserve that origin exactly; cache is a delivery kind. Measure consumer service duration separately from original pipeline latency; never charge cached exposures new token/search usage. Missing/retained-expired origin stays unknown. Do not recreate an origin run or refresh its timestamp to extend retention. A namespace rollover can increase fresh calls after a future release; no cache clearing or model call is authorized now.

### Advisory render acknowledgment

Extend existing `seller_suggestions_rendered`, adding optional exposure id and at most 50 rendered item UUIDs. Source `initial|search` describes the screen, independent of generating feature. Ack actual top-3/local-filtered/remote-deduped visible items after commit from an effect, after current query/category/cancellation checks. Initial and remote items on a search screen can require separate observations for their exposures. Empty state acknowledges a known exposure with zero items; load failure is not a successful empty exposure.

Version body to v2 while accepting strict v1 from existing tabs. Change shared seller-observations module, Zod, browser helper, API/storage projection and reader allowlists together. Preserve 8 KB/10-event batches, 150 events/session, 600 rows/request, 60/60s limiter and hashed token+IP. Browser batching must split by encoded bytes too: ten full 50-ID events would exceed 8 KB. Device/browser/mode remain server derived.

Dedup per exposure/visible subset/arrival in memory, stable event IDs across resend. Readers count distinct validated exposures/item membership, never raw diagnostic rows. Reload/revisit may report again without inflating unique exposure figures. Validate request/category/edit version/exposure/served-item membership in server SQL before recording lineage fields; strip invalid references without disclosing existence and retain otherwise valid coarse diagnostics. Current-session readers ignore stale edit reports. Acknowledgment means advisory committed DOM, not verified attention, visibility or accuracy; link holders can forge it, blockers/caps can lose it. No cross-device identity or session copy into cache/generation.

### Accepted choice

Add optional UUID `ai_lineage` to utility state/draft/submission contract. Old clients remain valid. Preserve references when keeping the identical selected item; clear on manual/typed/unknown, category reset, provider identity change and copying Internet into Cable. Client canonical dedup retains one whole winning item's identity rather than merging a reference with another provider's identity.

After `submitSellerRequest` reports accepted, write all category choice observations in one auxiliary batched statement. Keep telemetry outside the required metering/submission transaction. No validation failure/loss changes answers, contacts, sends or submission outcome. Duplicate submission returns do not retry observations or downstream effects.

Validate server-resolved request, accepted edit version, exposure category/feature, served membership and item parent generation. Compare final provider identity with that referenced item only as a consistency check, never search for another name match. A locally filtered initial item retains provider_suggestions feature even on search screen; remote search uses provider_search. No render ack prerequisite because that evidence can be lost.

Outcomes: `linked|missing|invalid|stale|origin_unavailable`, without echoed ids/names. Malformed optional advisory ids are discarded before primary answer validation; they cannot fail an otherwise valid form. No fallback to latest-name matching for new writes; old no-ID clients are unknown for exact lineage. Existing item selection columns remain historical evidence, not the new mutable selection store.

New immutable choice records use unique `(request_id, edit_version, category)`. Store validated IDs, entry mode and finite outcome only, no final free-text name. Reopen gets a new edit version; dashboard edits never overwrite observations. Compare later current entries/correction occurrence with the originally linked item only as change proxies, not verified provider errors. No backfill from names, edits or current answers.

### Transport, usage and cost

Instrument `withRetry` for each actual SDK invocation; return recovered failures on success too. Bounded summary per pass: role/index, attempt index, elapsed milliseconds, finite outcome/failure, reported numeric usage and metadata availability. Unconfigured/circuit-open/deadline-before-call has zero started attempts and an explicit skip. Parse failure is an answered transport attempt, not another call. Capture reported usage before empty-response validation. Late timeout completions cannot mutate finalized summaries.

Current maximum is three possible pipeline passes and three transport attempts each. Store at most nine attempts, with truncation flag and unknown completeness if future execution exceeds it. Contact/search use one pass currently. No additional model call to fill metadata or retry/circuit policy change.

For prompt/output/thinking/tool tokens and query/source counts record started-attempt count, reported-attempt count and `complete|partial|none|not_applicable`. A failed attempt without usage makes full-run cost incomplete even when final response has all fields. Keep available reported sums as lower bounds and unknown full grounding totals distinct from partial sums. Explicit empty arrays mean zero reported metadata, never zero billed search. Record grounding requested and candidate/query/chunk coverage; count unique URLs per response only in memory, persist numbers only.

Version estimates with existing price schedule `2026-10-12-standard-list-v1`; no price refresh. Persist counters/coverage, compute labelled estimates in readers. Unknown model price, missing transport usage or grounding limitations keep total/billed cost unknown. Even complete reported-query coverage is not invoice evidence. Do not store billed-dollar totals or infer costs from omitted fields.

### Contact coverage

Use consumer exposure rows with provider_contact, no items/provider/contact values, and lookup state `executed|disabled|skipped`. Disabled return remains null and creates no fictitious generation. Seller POST records only reached finite skip branches (locked plan, supplied contact, reopened supplied contact, duplicate target); no rows for hypothetical providers. Public demo/preview stays excluded; existing test-drive separation preserved. Fresh incident/eval APIs stay telemetry-free. Contact trust, R12, enrichments and returned payloads do not change.

## 4. Proposed additive schema and retention

After approval author `migrations-ai-exposure-lineage.sql` and mirror schema.sql. No migration execution. New nullable fields have no guessed historical defaults.

| Store | Changes |
| --- | --- |
| ai_generation_runs | Nullable lineage_version; bounded pass/transport JSONB summary; transport_attempt_count; per-metric coverage summary; grounding_requested; summary_truncated. Existing columns/statuses retain meanings |
| ai_suggestion_items | Pre-minted existing UUID IDs for atomic writes; existing run/rank/name/canonical/confidence/source columns suffice; finalize dedup/count before IDs |
| New ai_result_exposures | UUID PK; request FK CASCADE; server edit_version/mode/feature/category; nullable generation FK SET NULL; fresh/shared/cache delivery; lookup state/skip reason; service duration; bounded immutable origin metadata; bounded served_item_ids UUID array |
| New ai_selection_observations | UUID PK; request FK CASCADE; edit_version/category/entry_mode; nullable exposure/run/item FKs SET NULL; finite linkage outcome/time; unique request/edit/category. No text answers |

SQL checks enforce finite enums, nonnegative bounded counts, JSON version/shape/length and maximum 50 served UUIDs. Validate array membership by joining item parent run to exposure, not by trusting array alone. With no collected generation, an exposure can retain safe origin metadata/counts but generation FK is null and served-item array empty; exact item lineage unavailable. IDs from uncollected origins are not made into dangling foreign keys. If an origin is deleted, the remaining non-capability array references can identify missing evidence but cannot validate selection without the parent/item join.

Generation plus every normalized item and first exposure is one atomic CTE; item failure rolls everything back. Intentional empty fallback is complete, not partial. Followers insert exposures only; no origin recreation. Historical partial rows stay unknown. Abort still cannot prove rollback and never triggers retry.

Indexes: exposure request/edit/category/time, exposure generation, unique selection request/edit/category and created_at on both time-pruned tables. Reuse existing run/rank index. Synthetic EXPLAIN justifies anything additional, no broad event_logs index.

**Both new tables need explicit retention rules.** Recommended server exposures/choices: 365 days independently by own created_at, with existing off/preview/enforce, strict cutoff, 2,000-row cap and failure isolation. Extend retention table/key unions, policy definitions, status/UI fixture types, tests and privacy docs together. Runs/items remain 365 days. Origin deletion sets relational refs null rather than cascading away younger exposures/choices or extending run retention. Request hard deletion/account closure cascades new request-bound rows; old AI SET NULL behavior unchanged. Soft delete/Team transfer keep current behavior/access.

Browser render events remain the existing six-type 90-day sellerDiagnostics rule. Do not copy ack timestamps/item sets to 365-day exposure rows. Render-linked reports only cover retained 7/30/90-day windows; older/deleted acks unknown. New table rules require owner C and an explicit retention decision amendment after adoption; no new diagnostic event type needed.

## 5. Admin, eval and mixed-version behavior

- Admin preserves requireAdmin and existing customer/demo/deletion filters. Customer experience reports join exposures, not generation's initiating request. Usage counts each fresh generation once across all recorded execution rows as the existing usage cohort does. Disabled/skipped zero-call exposures never inflate failure/call denominators.
- Show generation results, served consumers (fresh/shared/cache), browser-reported exposures/items and linked accepted selections separately, with common/no-list/fallback/unknown-origin buckets. Origin model/prompt/source and delivery kind are distinct. Separate legacy cache pseudo-runs from v2 generations. AI health keeps fresh-generation thresholds, no exposure multiplication or new alert policy.
- Render-to-selection proxy counts distinct validated selected exposure/item membership among distinct acknowledged membership. Show selections without ack separately; lost ack is not rejection. Separate first submission from reopened correction cohorts. Current mutable submission-choice report retains caveat; add a v2 panel without rewriting history. Never call acceptance accuracy or causation.
- New sections display not installed/unavailable separately from empty/zero; keep legacy panels usable without the new migration. Aggregate DTOs contain no names, answers, query text or unrestricted JSON.
- Eval CaseRun/CaseScore/summary/comparison gain optional attempt summary, recovered failures, coverage and price version. run-eval forwards fields from fresh pipeline. Preserve both outcomes of its existing circuit-open case retry rather than overwrite coverage. Old result files retain legacy unknown, never rewritten. CSV/comparison readers tolerate absent fields and unknown costs. Matching, hard-case accepted names and R12 trust stay unchanged.
- Only pure fixture scoring and mocked models are allowed here. Do not invoke live run-eval. No need for production aggregates to implement the plan.
- Deploying old/new tabs needs optional utility refs, strict v1/v2 observation compatibility and opt-in search response. Approved additive migration must precede any later activation. Missing schema fails soft. Old deployments keep producing legacy rows, labelled separately. Rollback leaves additive objects unused; destructive down migration is excluded.

## 6. Implementation sequence and files

1. After A-E answers, record adopted policy in `.ai/decisions/2026-10-14-ai-exposure-lineage.md`; amend observation/report/retention decisions as needed. Mark plan/CURRENT in progress. No ADR adopts these proposals before approval.
2. Contracts/atomic storage: new `lib/telemetry/ai-lineage.ts`, migration/schema, AI queries, finite auxiliary/diagnostic operation labels only as needed. PGlite/driver regression tests first.
3. Transport/cache/services: Gemini client, suggestion/contact services, types/index.ts. Adapt every current caller including app/api/demo/suggestions and fresh incident/eval APIs while preserving no-lineage cases.
4. Server: seller suggestions/search/POST/observations routes, validation schemas, seller observation contract/helper/storage and admin-seller-progress reader allowlists. Inspect seller-submission transaction but do not change its required evidence/metering boundary.
5. Retention/Admin/eval: retention.ts, admin-telemetry query/page, optional ai-health filter only if needed to preserve semantics; eval core/runner/compare/README. Add fixture coverage for missing schema and legacy results.
6. After authorized integration of committed UX, wire SellerWizard, UtilityStep and canonicalize identity preservation, shared seller fixtures/tests and telemetry Playwright config. Recheck draft restore, Review edit, reset/same-as-Internet/reopen and API parsing at current source.
7. Sync docs/ai-telemetry.md, docs/telemetry-privacy.md, ADMIN.md, parent Slice 8, plan/CURRENT with final results/limits. No PDF/branding edit or PDF architecture change.

Focused test files: existing `ai-telemetry`, `gemini-client`, `suggestion-service`, `contact-service`, `seller-suggestions-route`, `seller-suggestions-search-route`, seller-observations schema/route/storage, seller-observer, utility-step-search, seller wizard observation/draft/reopen/review, admin-telemetry/page, eval-core, auxiliary-write, telemetry-retention and ops AI-health tests. New `ai-lineage` contract/storage and isolated `tests/ai-exposure-lineage.spec.ts` as necessary. No dependency proposed.

## 7. Required acceptance criteria

1. Two simultaneous same-scope request consumers produce one mocked pipeline/run/item set and two request-scoped exposures. Other account/org scopes do not share; neither consumer can ack/select the other's IDs. Usage counted once.
2. Cache fallback/common/no-list origin, model/prompt/reasons survive exactly; each exposure has measured duration and no new calls. Legacy/malformed/missing/expired origin unknown; no recreation/backfill.
3. Real schema/migration PGlite fixtures prove rollback on item failure, complete zero-item output, uniqueness and no partial v2 run. Installed Neon interception proves abort-coupled 500 ms per consumer, no second budget, detached work, retry or late follow-on query.
4. Rejected/slow/missing-schema observations preserve identical provider results and accepted submissions; no duplicate mutations/metering/sends/contact calls. Browser actions never await acknowledgments. Diagnostics remain finite/redacted.
5. v1/v2 schemas and byte/event ceilings; offline/blocked storage/reload/revisit/reopen; out-of-order/repeated reports; rapid canceled searches. Ack only committed top-3/filtered/deduped visible membership; no stale query ack or raw-row inflation.
6. Initial/remote-search/local-filtered choices; stale edit, foreign request/category/feature, nonexistent ID, provider identity mismatch, missing ack, duplicate submission, old clients, manual/unknown and same-as-Internet. Invalid/malformed advisory IDs never reject primary answers or modify another item.
7. Reopen gets distinct immutable observation; dashboard edits preserve prior evidence and only support labelled proxies. No latest-name fallback claims exact provenance.
8. Retry-success records both attempts/recovered failure. Timeout/circuit/deadline/unconfigured/empty-response-with-usage/parse paths truthful. Missing/partial/explicit-empty metadata, truncation and late SDK completion preserve honest totals/coverage.
9. Contact disabled/reached-skip/negative-cache states distinguishable with no provider/contact copies or trust change. Incident/eval fresh APIs store no seller telemetry; public demos/previews unchanged.
10. Retention off no query, preview no changes, enforce batch/cutoff; origin deletion leaves younger request evidence unknown; request/account deletion/Team transfer safe. Browser acks expire at 90 days; new server tables at 365. Lifecycle/billing/reminder/audit untouched.
11. Admin linked/legacy/unrecorded/expired/not-installed/unavailable/empty/zero labels, auth/filter/aggregate-only output, distinct generation/ack denominators and first/reopen cohorts.
12. Fixture eval new/legacy/partial retries/missing grounding/unknown price cases; versioned estimates, unchanged matching and no invoice completeness claim.
13. Sentinel token/address/name/query/contact/raw-error/grounding-URL values absent from new summaries, logs, diagnostic events and Admin DTOs. Provider business names stay functional/items only; no event name arrays restored.

## 8. Validation to run during implementation

Use Node 20.19.0, installed CLIs directly, with DATABASE_URL and Upstash variables cleared. No configured external services:

```powershell
$env:PATH = "$env:TEMP/utilitysheet-node20-validation/node-v20.19.0-win-x64;$env:PATH"
Remove-Item Env:DATABASE_URL,Env:UPSTASH_REDIS_REST_URL,Env:UPSTASH_REDIS_REST_TOKEN -ErrorAction SilentlyContinue
node --version
node node_modules/vitest/vitest.mjs run <focused files>
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <changed TypeScript files>
node node_modules/@playwright/test/cli.js test -c tests/telemetry.playwright.config.ts tests/ai-exposure-lineage.spec.ts
node scripts/security/scan-artifacts.mjs
git diff --check
```

Also clear model/provider/email keys in a child server process if any app server is needed, never print values. Prefer isolated fixtures refusing/intercepting all outbound traffic. Browser proof uses real seller UI/CSS and mocks on Desktop Chrome, Mobile Safari, Mobile Chrome, with screenshots/network/console inspected. Run shared seller regression specs after UX integration. Synthetic EXPLAIN only. A build is optional if source/config warrants and can run without services; no hosted validation.

No dependencies/env files copied for planning. At implementation use installed CLIs; if cached npm ci fails, junction node_modules to main without changing main dependencies. Normalize scripts/demo-seed.mjs to LF here only if CRLF shebang fails, never commit it. Rerun intermittent branding-list-page alone before treating it as real. Inspect all new files directly for secrets; tracked scan omits untracked files.

## 9. Tradeoffs, risks and alternatives

- Extra tables/joins/rows increase complexity. Finite bounds, batch writes, explicit retention and synthetic SQL tests constrain it. A 500 ms cold-start loss stays unknown; do not borrow cron's 10 s budget or add retries.
- IDs become unsafe if later treated as capability or if authorization trusts client identity. Mandatory server ownership/membership checks and foreign-ID tests prevent this.
- Cache rollover increases fresh requests after future release. No production traffic/cost forecast, cache clearing or model call authorized.
- Link holders can forge/fill diagnostic caps; dedup is not proof of viewing. Server records outlive browser acks by design, so retrospective rendering older than 90 days is unknown. Request deletion removes new request-bound lineage.
- Alternative: one run per consumer with origin columns is a smaller schema change, but makes shared usage and selection denominators harder to deduplicate. Recommend explicit generation/exposure split.
- Alternative: mutate existing selected item flag only; smaller storage but loses per-consumer/reopen history. Recommend immutable accepted-choice observations.
- Alternative: copy render acknowledgment onto exposure forever; simpler query but extends approved browser retention. Recommend existing 90-day diagnostic events only.
- Alternative: per-attempt SQL rows; easier ad hoc querying, more volume/joins/retention. Recommend bounded versioned JSON per generation.

## 10. Owner decisions before implementation

**Approval recorded:** owner answered "yes approved" to the recommendation of A-D defaults and E updated to incorporate committed UX first. Local integration and implementation are authorized without another approval request. Remaining live/release restrictions below still apply. Implementation will continue in a new chat; approval persists across that handoff.

| Decision | Recommended default | What we give up |
| --- | --- | --- |
| A. Data shape/local schema work | Approve generation/exposure split, atomic run/items and two new request-bound tables; author migration/schema locally | More schema/reader complexity; best effort still cannot promise complete history |
| B. Browser/selection policy | Optional opaque IDs, strict ownership/membership, v1/v2 render contract, immutable accepted choices; invalid/missing IDs never block answers; no name fallback | Old tabs, lost telemetry and stale references remain unknown, reducing measured coverage |
| C. Retention | Server exposures/choices 365 days with explicit rules; browser acks 90 days; new rows cascade with request | No render evidence beyond a quarter; new request-bound history disappears on hard deletion |
| D. Attempts/cost/contact scope | Bounded per-run summary, disabled/reached-skip contact coverage, version current estimates; no per-attempt ledger or R12 changes | No raw reconstruction, attempt SQL table, invoice proof or verified provider accuracy |
| E. UX sequencing | Incorporate committed main UX `68fbf38` into this worktree after authorization, then server/contracts followed by browser wiring | Integration review and combined regression validation are needed; no remaining wait for the UX author |

Answers A-E authorize local implementation/fixtures only if the owner says proceed. Separate explicit authorization remains required for live database queries/actions, migration execution, production settings/data, model/provider calls, emails, commits, integration merge, push or deployment. Read-only production checks require a prior ask and aggregate-only results in a read-only transaction. No live query needed for this plan.

## 11. Planning outcome and recovery

- Static source tracing, installed SDK read and main overlap/release review completed. No live service, production query, model call, runtime test, dependency install or application/schema change.
- Authored files: this plan, worktree CURRENT and scoped parent-plan status/Slice 8 pointer; main only an additive CURRENT pointer. No adopted decision record before owner answers.
- Final planning checks passed: git diff --check; plan/handoff references and scope review; direct new-file sensitive-pattern and no-em-dash inspection; tracked security scan under Node v20.19.0 with DATABASE_URL and Upstash variables cleared. Runtime tests, TypeScript, ESLint and Playwright deferred because no code changed. The security scan uses the worktree cwd; the first invocation used the identical main script path, then was repeated directly here for reproducibility.
- Next: owner answers A-E, then record them and recheck main UX ownership. No required planning work remains. Required Slice 8 implementation is unstarted and awaits approval; hosted checks/release are separate and unauthorized.

Decision-support follow-up: recommend A-D as proposed, and E updated to incorporate the completed UX commit first. These are engineering recommendations, not owner approvals. Keep the two tables because shared generation and per-request accepted choices have distinct identities; preserve fail-soft IDs; align retention with existing AI/browser rules; use bounded summaries rather than a separate attempt ledger. No live query or additional vendor research is needed for these local design decisions.

Subsequent owner response supersedes the unapproved status above: A-E are approved, including local integration/implementation. Decision recorded in `../decisions/2026-10-14-ai-exposure-lineage.md`. Next chat should read CURRENT, this plan and the decision, inspect both worktrees, preserve task documentation, incorporate committed UX and implement. Do not ask for A-E approval again. No required planning work remains; implementation/validation remain unstarted.

## Implementation milestones (2026-10-14)

- Fast-forwarded to committed UX 68fbf38; preserved all four Slice 8 documents. No new commit or main source edit.
- Implementing approved contracts/server/cache/transport/browser/retention/Admin/eval changes. First focused run: 155 passed, 44 failed; obsolete mock exports and old cache/statement/version expectations require adaptation and direct new regression proof. Not complete.
- Verified namespace correction: base code already uses suggestions v9, search v8 and contact v3; envelope namespaces now v10/v9/v4, maintaining existing key scope and TTLs.

## Final local outcome and validation (2026-10-14)

All required local implementation and validation are complete. No required local
work remains. Publication, hosted migration/activation/verification and real
model/evaluation calls are separate owner-authorized follow-ups.

- UX integrated first at HEAD 68fbf38 on telemetry-slice-8, without creating a
  commit. Preserved Slice 8 documents and main owner notes. Main source unchanged.
- Implemented atomic generation/items/first exposure, one shared persistence
  attempt and separate authorized consumer exposures within one 500 ms budget.
  Unknown/expired origins never replay or acquire new timestamps.
- Implemented immutable batched accepted choices, optional fail-soft IDs,
  private/no-store compatible seller responses, strict v1/v2 advisory observations,
  actual committed top-three/filter/dedup memberships, cancellation and byte
  batching, draft identity preservation and reset/manual/copy clearing.
- Implemented envelope caches v10/v9/v4 (actual base was v9/v8/v3), bounded SDK
  attempts/recovered failures/empty-response numeric usage/candidate coverage,
  independent 365-day exposure/choice retention, disabled/reached contact skips,
  aggregate Admin first/reopen/source/delivery/lookup/usage/change-proxy panels,
  missing-schema isolation and optional versioned eval/comparison fields.
- Centralized unchanged 2026-10-12 price constants in lib/telemetry/ai-cost.ts;
  eval re-exports its prior API. No price refresh, prompt, model, tool, quality
  gate, functional TTL, R12 trust, billing or required submission change.
- Full Vitest: 255 files passed / 1 skipped; 2,222 tests passed / 13 skipped.
  Later final estimate/late-SDK fixtures passed in the 27-test eval/driver group;
  no app logic changed after the full run. Windows demo-seed CRLF workaround was
  temporary and restored byte-for-byte in finally; it is not in the diff.
- PostgreSQL fixtures prove forward migration from previous schema twice,
  historical null lineage, atomic item-failure rollback, zero-item completeness,
  shared/cache consumers, ownership/edit/category/item checks, immutable reopen
  evidence, invalid acknowledgment stripping, distinct aggregate membership,
  change proxies, origin expiry and request deletion. Synthetic EXPLAIN uses the
  scoped exposure index. New focused lineage/wizard group: 26 passed.
- Installed Gemini SDK HTTP is intercepted with synthetic credentials and
  confirms exact app invocation counts, recovered/partial usage, empty text,
  missing vs explicit-empty grounding, deadline skips and immutable late timeout
  completion. Installed Neon driver group: 15 passed; shared persistence plus
  consumer query is aborted within a single 500 ms budget, without follow-on work.
- New Playwright lineage: 6 passed across Desktop Chrome, Mobile Safari and
  Mobile Chrome. Combined existing seller/UX fixtures: 39 passed across those
  projects. Tests bundle the real wizard/CSS and intercept all outbound traffic.
  New flows verify top-three/filter/remote-dedup IDs, empty exposure, cancellation,
  selected draft reload and submission through a blocked collector. Network and
  page-error assertions passed. Visual captures are synthetic/local-only. Two capture reruns passed; desktop initial and mobile Safari search screenshots were visually inspected. The acknowledgment concerns committed DOM membership, including scrollable rows, not verified on-screen attention.
- TypeScript passed. Changed/new TS ESLint passed with zero errors and six
  existing SellerWizard hook warnings. Tracked security scan, direct new-file
  secret-pattern inspection (11 files, no matches) and diff check passed.
- No production build, Next-server/live e2e, physical device/screen reader,
  hosted query/migration, real model/provider/email call, commit/push/deploy.
  The approved fixture workflow covers local completion; these are release or
  optional device checks, not required remaining local implementation.

Important remaining limits: observations can be forged/lost; IDs confer no
capability; server history is capped at 365 days and browser acks at 90; reported
usage is a lower bound and estimates are not invoice evidence; missing schema
fails soft; cache rollover can increase fresh calls after a later release.
Current-choice differences and later sheet edits are proxies only. No backfill.

Next concrete action: review the uncommitted diff and additive migration. Any
live migration, release activation, external service/model call, commit, push or
deployment requires separate authorization. No concurrent Slice 8 editor remains.

## Owner-authorized migration and publication (2026-10-14)

Owner explicitly requested live migration execution and commit/push of all Slice
8 worktree changes after local completion. Status: completed. This supersedes
prior migration/commit/push restrictions for this operation; no deployment,
production settings, pruning, customer-row write or real model/email action is
included. Target is the live Neon database configured in main .env.local,
verified against the prior release host fingerprint before any DDL. Apply only
migrations-ai-exposure-lineage.sql in one bounded transaction; pre/post checks
use schema metadata, not customer records. Commit/push telemetry-slice-8 and
verify the remote head; preserve main-only handoff/owner notes.

Live migration result: applied successfully to the prior release Neon target
(host fingerprint 79d6a988e446). Seven additive DDL statements committed in one
transaction with bounded lock/statement timeouts. Read-only metadata verification
passed: 6 nullable new generation columns without defaults, exposure/choice tables
13/10 columns, four valid indexes, 2/4 foreign keys with approved cascade/nulling
and the immutable-choice uniqueness constraint. No customer rows were inspected
or changed; no production settings/pruning/model/email/deployment action. Raw
working-file SHA-256 0597dd5936243b4916c3f6f296f3263024b00ed93f4bac0ce7bdccb29810cb4b.
Committed all 61 Slice 8 files as 977d6c98dafff5adbabd5756bb9b557fe1df05d0 and pushed origin/telemetry-slice-8; exact remote head verified. Final publication handoff is recorded in a documentation follow-up. No required migration/publication work remains. Main-only handoff/owner notes were preserved; no main merge, deployment, production setting change, pruning or model/email action.
