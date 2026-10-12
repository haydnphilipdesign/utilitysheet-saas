# UtilitySheet AI integration, model selection and cost audit

- Date: 2026-10-12. Author: Claude Code (Opus 5.5). Baseline: main at `c83b2eb`.
- Scope: investigation and recommendations only. No application code, configuration, cache, or data was changed.
- Plan and status: `.ai/plans/2026-10-12-ai-integration-audit.md`.

## How to read the evidence labels

| Label | Meaning |
|---|---|
| **Code** | Read directly in the repository at the baseline commit. |
| **Measured** | Aggregate, read-only queries against the configured database on 2026-10-12, covering 2026-08-01 to 2026-10-12 unless stated. Counts, rates and latencies only. No addresses, provider names, or account identifiers were read out. Demo requests excluded. |
| **Docs** | Official provider documentation fetched on 2026-10-12 (links in the Sources section). |
| **Estimate** | My calculation from the above. The assumptions are stated next to each one. |
| **Not verified** | I could not see it (hosting environment values, Google billing, Google Cloud key restrictions). |

---

## 1. Executive summary

The model is not the main problem. The current model is cheap and adequate for most categories, and total AI spend is small (a few dollars to roughly $25 a month, **Estimate**). The larger problems are in the code around the model, and three of them are measurably hurting sellers today.

1. **The suggestion cache is too coarse, and it is serving the wrong town's providers.** Suggestions are cached for 30 days per 3-digit ZIP prefix, not per city. 65% of cached suggestion lists shown since August came from a lookup made for a different city in the same ZIP3 (**Measured**, 568 of 878). When that happens, sellers accept a suggestion 68% of the time, against 82% for a same-city cache hit and 85% for a fresh lookup. For water, sewer and trash, where providers change town by town, it drops to 56% against 77% and 87%.
2. **Provider search is the largest consumer of AI calls and mostly returns nothing.** Search fires a full multi-pass, Google-grounded AI pipeline on every pause in typing, starting at 2 characters. It accounts for 63% of all recorded AI passes, takes a median 7.4 seconds, and ends with zero results 58% of the time (**Measured**). Part of the cause is a logic defect: search reuses the suggestion quality gate, which rejects any answer with fewer than 2 results, so one correct exact match is discarded (**Code**). Roughly 2,300 grounded AI passes produced 66 seller selections.
3. **The pipeline demands several providers where reality has one.** Prompts ask for "5-8 candidates" and "3 to 5 providers", and the quality gate rejects fewer than 2. Electric, gas, water and sewer usually have exactly one provider per address. This pushes the model to pad the list with neighbors and sends honest single answers to a generic national list. 22% of fresh suggestion lookups end on that generic list (36% for water), and sellers accept from it only 31% of the time (**Measured**).
4. **It is slow, and nothing bounds it.** A fresh category lookup takes a median of about 8.5 seconds and 11 to 12 seconds at the 95th percentile, because a second "verify" AI call runs almost every time (94% of fresh lookups). There is no timeout on the Gemini call. The slowest recorded lookups took 130 to 160 seconds (**Measured**).
5. **Cost and token use cannot be seen.** The app records latency and outcomes but not tokens, thinking tokens, or the number of Google searches billed. AI failures do not raise an operations alert. The July incident went unnoticed for five days for this reason.

**Recommendation: Option B, in a fixed order.** First fix the five model-independent defects above (they are bugs, not tuning). Then build a small evaluation script. Only then decide the model with data. Stay on Gemini. Do not move to OpenAI or add Google Maps grounding; neither addresses any problem found here. One correction to the brief: the July trial that was rolled back was `gemini-3.5-flash-lite`, and it was rolled back because it returned empty responses, not because of price (see section 4). That defect was fixed on 2026-07-29, so the current Flash-Lite generation has never had a fair trial.

---

## 2. Current architecture

### 2.1 What uses AI

There is one AI provider (Google Gemini through `@google/genai` ^1.43.0), one client module, and three features. All three run with Google Search grounding and a JSON response schema.

| Feature | Entry point | Trigger | AI calls per fresh run | Cache |
|---|---|---|---|---|
| Provider suggestions | `GET /api/seller/[token]/suggestions` to `getAllSuggestions` in `lib/providers/suggestion-service.ts` | Seller wizard prefetches the current and next category (`components/seller-form/SellerWizard.tsx:507`) | 1 primary + 1 verify (almost always) + 1 recovery (rare) | Redis, 30 days, keyed by account scope + state + ZIP3 + category + model |
| Provider search | `GET /api/seller/[token]/suggestions/search` to `searchProviders` | Every 300 ms pause in typing, from 2 characters (`components/seller-form/steps/UtilityStep.tsx:102`) | 2 to 3 | Redis, 7 days, keyed by exact query text |
| Contact lookup | `resolveContact` in `lib/providers/contact-service.ts`, called after a seller submits (`app/api/seller/[token]/route.ts:771`) | Once per provider that has no contact from history or the seller | 1 | Redis, 90 days hit, 5 minutes miss |
| Public demo | `POST /api/demo/suggestions` | Marketing demo, behind a challenge and rate limit | Same as suggestions, all categories | Shared "public" scope |

Not AI: the Google Places address field (section 5), the address parser (`lib/address/location-parser.ts`, plain code), provider de-duplication (`lib/providers/canonicalize.ts`), and the per-account provider memory that boosts providers a workspace has used before in the same area.

### 2.2 How a suggestion is produced (**Code**)

1. The address is parsed locally into city, state and ZIP. The street is deliberately not sent to the model.
2. Primary pass: a prompt of about 300 to 450 tokens asks for 5 to 8 providers with name, confidence (0 to 1, self-reported), a short rationale, phone and website.
3. Verify pass: runs whenever the primary returned anything and less than 6 seconds have elapsed. It sends the candidate names back and asks for the best 3 to 5. It does not pass along the phone or website from step 2, so the model produces them again.
4. Recovery pass: runs only if neither result passed the gate and time remains.
5. Quality gate: at least 2 results, top self-reported confidence at least 0.45, and a state-name check.
6. Blend with the workspace's own provider history, then cache.
7. If everything failed: a hardcoded list of about 35 national provider names, cached for 5 minutes.

### 2.3 Configuration (**Code**)

| Variable | Default when unset | Notes |
|---|---|---|
| `GOOGLE_AI_API_KEY` (or `GEMINI_API_KEY`) | none | AI disabled when missing; generic list served. |
| `GEMINI_MODEL_NAME` | `gemini-3.1-flash-lite` | One model for all three features. |
| `GEMINI_THINKING_LEVEL` | not sent (model default) | Accepts minimal, low, medium, high. Invalid values are ignored with a console warning. |
| `GEMINI_GOOGLE_SEARCH_GROUNDING` | on | |
| `SUGGESTIONS_TWO_PASS_VERIFY`, `SUGGESTIONS_ENABLE_RECOVERY_PASS` | on | |
| `SUGGESTIONS_MAX_TOTAL_MS` | 6000 | Only decides whether to start another pass. It does not stop a running call. |
| `SUGGESTIONS_MIN_VALID_RESULTS`, `SUGGESTIONS_MIN_TOP_CONFIDENCE` | 2, 0.45 | |
| `ALLOW_UNVERIFIED_AI_CONTACTS`, `INCLUDE_AI_SUGGESTION_CONTACTS` | on | |
| `SUGGESTIONS_SHADOW_MODE`, `SUGGESTIONS_SERVE_NEW_PIPELINE`, `SUGGESTIONS_CANARY_PERCENT` | off | Old A/B switch between a "legacy" and "new" pipeline. Production serves "new" for 100% of runs (**Measured**). |
| `LOCATION_VERIFIER_ENDPOINT` | off | Optional external address checker. Not set locally; hosting value **Not verified**. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | off | Browser key for the address field. |

### 2.4 Volume (**Measured**)

About 120 to 130 requests are created a month. September: 398 fresh suggestion lookups and 463 fresh searches, 1,858 recorded AI passes in total (contact lookups and retries are not recorded, so the true number of Gemini calls is higher). The 10-week window covered 21 states, 63 ZIP3 areas and 173 distinct city and ZIP3 combinations.

---

## 3. Identified issues

Ordered by impact on sellers. Each has a recommendation number used in the roadmap (section 10).

### I1. Cache keyed by ZIP3 serves another town's providers (accuracy, high)

- **Code:** `getCacheKey` in `suggestion-service.ts:230` uses the first 3 ZIP digits and ignores the city whenever a ZIP exists. The prompt, by contrast, includes the city and full ZIP. So the first address looked up in a ZIP3 decides what every other town in that ZIP3 sees for 30 days, within one account.
- **Measured:**

| What the seller was shown | Entries | Accepted a suggestion | Water, sewer, trash only |
|---|---|---|---|
| Fresh AI result | 348 | 85.1% | 87.1% |
| Cached, made for the same city | 217 | 82.0% | 77.2% |
| Cached, made for another city (or origin unknown) | 476 | 67.9% | 55.8% |
| Generic national list | 35 | 31.4% | 37.0% |

- Caveat: "accepted a suggestion" is a proxy for accuracy, not proof. City matching uses the parsed city text, so a few rows may be misfiled. The direction and size of the gap are clear.

### I2. Search calls the AI on every pause in typing and mostly fails (cost, speed, accuracy, high)

- **Code:** 300 ms debounce, minimum 2 characters, then the full primary + verify + recovery pipeline with Google Search each time. Each distinct partial string ("du", "duk", "duke") is its own cache entry.
- **Code, defect:** search passes through `applyQualityGates`, which requires at least 2 results. A correct single match is rejected, the recovery pass runs, and the seller gets the name-matched generic list, usually empty.
- **Measured:** 959 fresh searches; 61% ended on the fallback, 58% showed zero results; average 2.4 AI passes; median 7.4 s. 1,143 search calls came from 118 requests (median 6 per request, maximum 118). Only 66 of 1,085 submitted entries were chosen from search.
- Telemetry cannot tell "the model found nothing" from "the model found one good match and the gate threw it away", because both are recorded as `quality_gate_failed`. The split is unknown.

### I3. The pipeline requires multiple providers where one is correct (accuracy, high)

- **Code:** prompt rule "Return 5-8 candidate providers", verify rule "Return a JSON array of 3 to 5 providers", gate minimum 2. The same prompt also says "Only include providers you are reasonably confident serve this specific area." These conflict for single-provider utilities.
- **Measured:** 21.7% of fresh suggestion lookups end on the generic list (water 35.5%, oil 30.8%, gas 27.8%, sewer 26.6%, electric 17.0%). In a further 19% the primary answer failed the gate and the verify pass, told to return 3 to 5, produced a list that passed. Whether that is verification or padding cannot be known without labelled cases.
- **Measured:** when a seller picks from the list, the first item is the pick 60% of the time overall, but only 56% for water, 43% for trash, 36% for internet. For internet several answers can be right; for water a second or third pick suggests the top answer was wrong.

### I4. No timeout, and the time budget is not a budget (speed, reliability, high)

- **Code:** no timeout or abort signal is passed to `generateContent`. `SUGGESTIONS_MAX_TOTAL_MS` is checked only between passes. Each call may also retry up to 3 times with 0.5 s and 1 s waits.
- **Measured:** fresh suggestion p50 about 8.5 s, p95 11 to 12 s, maximum 160 s. 654 of 699 fresh lookups ran exactly 2 passes. The seller route does not set `maxDuration`.

### I5. The generic list is presented as if it were a local answer (accuracy, medium)

- **Code:** fallback items carry confidence 0.4 to 0.6 and a rationale such as "Largest investor-owned water utility in the US". Only 5 of about 35 entries have state limits, so "Dominion Energy" or "Aqua America" can be offered anywhere.
- **Measured:** 31% acceptance; half the sellers who see it type their own provider.

### I6. Contact details are unverified model output (accuracy, medium)

- **Code:** phone numbers are checked for shape only (10 or more digits); websites for being a valid URL. The Google Search source URLs that come back with each answer are collected (`getGroundingSourceUrls`) but used only by the incident script. Nothing checks that a phone or website is supported by a source. Results are cached 90 days and written into the sheet a buyer relies on.
- **Measured:** coverage is excellent (0 to 4% of named providers end without a contact). Correctness is unmeasured. Only 8 of 239 submitted sheets were edited afterwards, which is a weak positive sign.

### I7. No visibility into tokens, searches, or failures (operations, medium)

- **Code:** `response.usageMetadata` is never read. Telemetry has no token, thinking-token, or search-count columns. Contact lookups write no telemetry at all. `lib/ops/` raises no event for AI fallback rates. The health route reports only whether a key exists.
- Consequence: a wrong model name or an incompatible model produces fallbacks, not errors, exactly as on 2026-07-24.

### I8. State-name filter rejects legitimate providers (accuracy, low to medium)

- **Code:** `filterSuggestionsForState` drops any item whose name or rationale mentions a state other than the property's. "Washington Gas" outside Washington state, "Delaware County Regional Water Authority" in Pennsylvania, or "Kansas City" providers in Missouri are removed. Per-item removals are not recorded, so the frequency is unknown; 6 whole searches were rejected for this reason.

### I9. Smaller findings (**Code**)

- The circuit breaker lives in one server instance's memory and opens after 3 failures. With several categories fetched at once, one bad moment can switch every category to the generic list for 60 seconds.
- The verify pass regenerates phone and website instead of keeping the primary's.
- Self-reported confidence drives both the gate and the ranking. Models are poorly calibrated on this; the check that sources exist would be a better signal.
- Unused code that adds risk and reading cost: the legacy pipeline with shadow and canary switches (about 250 lines, 0 production runs), `generateContent`, `generateJSON`, `resolveContacts`, `getCircuitBreakerStatus`, the deprecated `GEMINI_GROUNDING_DYNAMIC_THRESHOLD`.
- `.env.example` suggests `GEMINI_MODEL_NAME=gemini-3.5-flash`, a model that no longer appears on Google's model or pricing pages.
- The public demo can start up to 18 grounded calls per request. The rate limit bounds it, but there is no evidence of a Google-side spending cap (**Not verified**).

### What is working well

- JSON schema on every call, with the empty-response case treated as a failure (the July fix).
- Model name and request format are part of every cache key, so a model change cannot serve stale results.
- Short cache life for failures.
- The street address and seller identity never reach the model. The search query is fenced and treated as text.
- Workspace provider memory, de-duplication, and a telemetry design that already links what was shown to what the seller chose. That link is what made this audit's measurements possible.

---

## 4. Model comparison

### 4.1 A correction first

The brief recalls trying `gemini-3.5-flash` and reverting on price. The records show something different (**Measured**, plus `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`):

- 18 runs on `gemini-3.5-flash` in July (a brief trial).
- 387 runs on `gemini-3.5-flash-lite` from 2026-07-24 to 2026-07-29. This is the incident: that model returned empty text when Search grounding and JSON mode were combined without an explicit schema. It was rolled back for that reason.
- The schema fix shipped on 2026-07-29 with a regression test. `gemini-3.5-flash-lite` has not been tried since.

### 4.2 Current models and prices (**Docs**, per 1M tokens, standard tier)

| Model | Input | Output (includes thinking) | Default thinking | Status on Google's pages |
|---|---|---|---|---|
| `gemini-3.1-flash-lite` (current) | $0.25 | $1.50 | Not listed | Stable. Listed for pricing and for Maps grounding. Missing from the current Search grounding and thinking tables (see note). |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | minimal | Stable, "recommended for new projects". |
| `gemini-3.6-flash` | $0.75, then $1.50 from 2027-01-01 | $3.75, then $7.50 | medium | "Previous generation Flash". |
| `gemini-3.8-flash` | $0.75, then $1.50 from 2027-01-01 | $3.75, then $7.50 | medium (no "minimal") | Stable, newest Flash, "recommended for new projects". |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | high | Preview only. |
| OpenAI `gpt-6-luna` | $0.10 | $0.50 | | Small tier. |
| OpenAI `gpt-5.6-luna` | $0.20 | $1.20 | | Small tier. |
| OpenAI `gpt-5.4-mini` | $0.75 | $4.50 | | Mini tier. |
| Anthropic Claude Haiku 5.5 | $0.10 | $0.50 | | Small tier. |

Search tool charges (**Docs**):

| Provider | Charge | Free allowance | Retrieved content |
|---|---|---|---|
| Gemini 3 and newer, Google Search | $14 per 1,000 search queries the model runs (one call can run several) | 5,000 a month, shared across models | Not stated on the pages read |
| Gemini, Google Maps | $14 per 1,000 | Shares the same 5,000 | |
| OpenAI web search | $10 per 1,000 calls | None | Billed as input tokens at the model's rate |
| Anthropic web search | $10 per 1,000 searches | None | Billed as input tokens |

Note on `gemini-3.1-flash-lite`: production proves grounded, schema-constrained calls work on it today. Its absence from two current documentation tables, and the Lite line having moved on by one generation, is a signal to have a tested successor ready. No shutdown date is published. `gemini-3.5-flash` is no longer listed at all.

Structured output with built-in tools is documented as a preview feature limited to Gemini 3 series models. UtilitySheet depends on that combination for every call.

### 4.3 Cost per operation (**Estimate**)

Assumptions: about 450 input and 500 visible output tokens per pass; thinking adds about 100 tokens on Lite models at minimal or low and about 1,000 on Flash at medium; retrieved search text is not billed as input on Gemini and is billed (assume 8,000 tokens) on OpenAI and Anthropic. These need the measurements in section 6 to confirm.

| Model | Tokens per pass | Search charge per pass beyond free tier |
|---|---|---|
| `gemini-3.1-flash-lite` | about $0.001 | $0.014 per query |
| `gemini-3.5-flash-lite` | about $0.002 | $0.014 per query |
| `gemini-3.8-flash` | about $0.006 in 2026, $0.012 from 2027 | $0.014 per query |
| `gemini-3.1-pro-preview` | about $0.03 | $0.014 per query |
| `gpt-6-luna` or Claude Haiku 5.5 | about $0.001 | $0.010 per call, no free tier |
| `gpt-5.4-mini` | about $0.009 | $0.010 per call, no free tier |

Monthly, at September's volume (118 requests):

| Scenario | AI passes | Tokens | Search charges | Total |
|---|---|---|---|---|
| Today, `gemini-3.1-flash-lite` | about 2,200 (1,858 recorded + contacts) | $2 to $3 | $0 if the model averages up to 2 queries per pass; about $22 at 3 per pass | $2 to $25 |
| After fixing I1 to I4, same model | 600 to 800 | under $1 | $0 (inside free tier) | under $1 |
| After fixes, `gemini-3.5-flash-lite` | 600 to 800 | $1 to $2 | $0 | $1 to $2 |
| After fixes, `gemini-3.8-flash` | 600 to 800 | $4 to $5 in 2026, $8 to $10 from 2027 | $0 | $4 to $10 |
| After fixes, OpenAI small model | 600 to 800 | about $1 | $6 to $8 | $7 to $9 |

Today a request costs roughly $0.02 to $0.21 end to end. Search charges, not tokens, dominate whenever the free allowance is exceeded, so the number of passes matters far more than the price per token. Once the wasted passes are gone, even the newest Flash model costs less than the current setup may cost today.

### 4.4 Performance and fit

I cannot rank these models on accuracy for utility-provider lookup from documentation or general benchmarks, and I will not guess. The task is narrow: a grounded lookup with a small structured answer. What matters is the search behavior and whether the model reports one provider when there is one. That is exactly what the evaluation in section 9 measures.

- **Stay on Gemini.** The integration is built and hardened around it, Google Search grounding has a free allowance that covers this volume, and Search is the right grounding source for "who provides water in this town".
- **OpenAI or Anthropic:** comparable small-model prices, no free search allowance, and a full rewrite of the client, schemas, grounding metadata handling and tests. No finding in this audit is caused by the provider. Not recommended. If the evaluation later shows Gemini models failing on accuracy, the harness can test another provider before any migration.
- **Multi-model:** not now. One exception worth testing later: contact lookup. It is one call per provider, cached 90 days, and a wrong phone number in a buyer's sheet is the most damaging error the AI can make. A stronger model there would cost cents a month. Decide with evaluation data.

---

## 5. Integration assessment

### 5.1 Grounding with Google Search (in use)

- **Code:** enabled on every call through the `googleSearch` tool, combined with a JSON schema. Correctly implemented for Gemini 3 models.
- Value: high. Without it the model answers from memory, which is weakest exactly where the product needs it (small municipal authorities, current phone numbers).
- Cost: likely $0 today inside the free allowance, up to about $22 a month if the model runs 3 queries a pass (**Estimate**; the count is not recorded).
- Gaps: the returned source list is ignored for validation (I6), and the number of queries is not recorded (I7). The verify pass is grounded too, which doubles search use for unproven benefit.

### 5.2 Google Places address field (in use)

- **Code:** `components/address/GooglePlacesAddressInput.tsx` calls Places API (New) over REST from the browser: Autocomplete with a session token, US only, 250 ms debounce, minimum 3 characters, then Place Details with a field mask of `id,formattedAddress,addressComponents`. Used on the dashboard "new request" page and the public seller form link screen. The per-request seller form does not use it because the address already exists.
- Correctness: sound. Session tokens are created and rotated properly, the field mask keeps the Details call in the cheapest data tier, and it degrades to a plain text field without a key.
- Cost (**Docs**): Autocomplete Requests 10,000 free a month then $2.83 per 1,000; Place Details Essentials 10,000 free then $5 per 1,000. At roughly 130 addresses a month this is $0. How sessions bill under the new API was not stated on the pricing page I read.
- **Not verified:** that the browser key is restricted to UtilitySheet's domains and to the Places API in Google Cloud. It is public by design, so this restriction is the only protection. Worth a two-minute check.
- **Missed opportunity:** Google returns the county and, where it exists, the township. `parseGooglePlaceAddress` discards the county and only uses the township when no city is present. A US mailing "city" is often not the municipality that runs water, sewer and trash. Keeping county and township and giving them to the model is free and targets the weakest categories.

### 5.3 Grounding with Google Maps (not in use): do not add

- **Docs:** it grounds answers in Google Maps place data (places, reviews, addresses, opening hours), accepts a latitude and longitude, costs the same $14 per 1,000 and draws on the same free allowance. It carries display rules: Google Maps sources must be shown and linked next to the content.
- It answers "what is near here", not "whose service territory is this address in". A utility's office location says nothing about where it serves. It would add attribution duties to the seller form for no gain on the core question.
- The one plausible use, confirming a named provider's phone number from its Maps listing, is unproven and adds a second tool to every contact call. Not recommended unless the evaluation shows contact accuracy is a real problem that Search grounding cannot solve.

### 5.4 Authoritative datasets (not in use): optional, later

Electric service territories and broadband availability exist as public datasets. They would give deterministic answers for two categories. For a product at about 130 requests a month this is a larger build and an ongoing data-refresh duty than the problem justifies today. Listed under Option C.

---

## 6. Cost optimization opportunities

| # | Change | Passes removed (**Estimate**) | Notes |
|---|---|---|---|
| C1 | Search: filter locally first (the category's suggestions already loaded, workspace history, the static list); call the AI only after a longer pause and 4 or more characters, or on an explicit "search" action; one pass | 80 to 90% of search passes, about 900 a month | Also the largest speed win. Fixes I2. |
| C2 | Suggestions: one grounded pass by default; verify only when the first answer fails the gate | about 45% of suggestion passes | Decide with the evaluation whether the verify pass earns its place at all. |
| C3 | Do not ground the verify pass if it is kept | Halves search queries for those runs | It only re-ranks names it was given. |
| C4 | Record tokens, thinking tokens and search query counts per run | none directly | Turns every figure in section 4.3 from estimate to fact. |
| C5 | Set a budget alert in Google Cloud billing | none directly | Protects against the demo route or a bug. |

Things that look like savings but are not worth doing: batching all categories into one call (saves little, risks quality on a Lite model, and breaks per-category caching; worth one evaluation run, not a commitment), context caching (prompts are far below the size where it pays), and Batch pricing (the work is interactive).

Fixing I1 (cache per city) increases fresh lookups, perhaps 2 to 3 times for suggestions (173 city areas against 63 ZIP3 areas). That is the right trade: it is the main accuracy fix, and C1 and C2 remove far more passes than it adds.

---

## 7. Accuracy and performance improvements

| # | Change | Addresses | Expected effect |
|---|---|---|---|
| A1 | Cache key: add the city (and use the full ZIP when present) | I1 | Cached results behave like fresh ones: about 68% to 82%+ acceptance overall, 56% to 77%+ for water, sewer, trash (**Measured** gap, **Estimate** of closure). |
| A2 | Allow one result. Ask for "the provider or providers that serve this location; most addresses have one for electric, gas, water and sewer". Gate on "at least 1 result with sources" for those categories | I3 | Fewer generic-list outcomes, less padding. |
| A3 | Search: separate, lighter gate that accepts a single match | I2 | Search stops discarding correct answers. |
| A4 | Use grounding sources as the trust signal: require at least one source for a result to count; prefer it over self-reported confidence | I3, I6 | Fewer fabricated entries. Needs a check of what the source list contains in practice. |
| A5 | Send county and township to the model; store them from Places | 5.2 | Better water, sewer, trash answers at no cost. |
| A6 | Timeout per Gemini call (about 10 s) and a real overall deadline; serve what exists when it expires | I4 | Removes the 130 to 160 s outliers; p95 becomes predictable. |
| A7 | When nothing reliable is found, say so and invite typing, instead of presenting national names as local suggestions; or label them "Common providers" | I5 | Honest failure instead of a misleading list. Needs a small UI decision from the owner. |
| A8 | Keep the primary pass's contacts through verify; for contact lookups, record whether sources were returned | I6, I9 | Consistency, and a first measure of contact reliability. |
| A9 | Narrow the state-name filter so county and city names that contain a state name are not rejected | I8 | Stops dropping "Washington Gas" style providers. |

With C2 and A6, a fresh category should take one grounded call: about 4 to 5 seconds at the median instead of 8.5 (**Estimate** from the single-pass rows, which had a 6.3 to 6.6 s median including overhead).

How to measure, without opinion: the acceptance-by-source table in I1 is reproducible from existing tables. Run it before and two weeks after each change. Add it to Admin telemetry so it is always visible.

---

## 8. Configuration recommendations

### 8.1 `GEMINI_THINKING_LEVEL` as a secret

- **Docs (Vercel, page updated 2026-08-28):** variables are now typed **Config** (readable after saving by members with access) or **Secret** (write-only after saving). Older "Sensitive" variables are treated as Secrets. A Secret cannot be converted in place: delete it and create a Config variable with the same key, then redeploy.
- A thinking level is not a credential. Storing it as Config has no security cost. Both types are available only to people with project access, and neither is exposed to the browser unless the name starts with `NEXT_PUBLIC_`.
- Recommended: recreate `GEMINI_THINKING_LEVEL` as Config. Check that `GEMINI_MODEL_NAME` and the `SUGGESTIONS_*` switches are Config too. Keep `GOOGLE_AI_API_KEY`, database, Stripe, Redis and email values as Secrets.
- Which value: unknown until you recreate it. If it holds an invalid value the code silently ignores it and the model default applies. For a grounded lookup with a small structured answer, `low` is a sensible setting on a Lite model and `minimal` is worth comparing; neither should be chosen by argument. Note `gemini-3.8-flash` does not accept `minimal`, so a model switch can make the current value invalid. The evaluation should run both levels.

### 8.2 Make the running configuration visible

- Show model, thinking level, grounding on or off, and pass settings on an Admin page (not on the public health route).
- Record `model` and thinking level on each telemetry run so a change is visible in the data from the first request.

### 8.3 Safer switching and rollback

- Today a switch is one environment variable plus a redeploy, and cache keys already isolate models. That part is good.
- Missing: an early warning. Add an operations event when the share of fresh runs ending in fallback or provider error passes a threshold over a short window. The existing `lib/ops` alerting can carry it.
- Before any model change: run the evaluation, change the variable, watch the fallback rate and the acceptance table for a day. Rollback is the same variable.
- Remove the shadow and canary switches rather than keep an unused A/B mechanism that doubles calls if switched on by mistake.

### 8.4 Still needed from you to turn estimates into facts

1. Google billing for September by SKU (tokens in, tokens out, Search grounding queries). This settles the $2 versus $25 question in one look.
2. The actual `GEMINI_THINKING_LEVEL` value, visible once recreated as Config.
3. Whether `LOCATION_VERIFIER_ENDPOINT` is set in hosting.
4. The Google Cloud restrictions on the browser Maps key.

---

## 9. Evaluation framework

Sized for one person: one script, one data file, run by hand before a model, prompt or pipeline change. No dashboard, no service.

**Cases (about 60 localities, about 150 locality and category pairs).**

- About 40 from your own history: city, state, ZIP and county where a seller confirmed or typed a provider and the coordinator did not later change it. These are "silver" answers. No street address is needed. Exporting them is a production read that needs your approval.
- About 20 hand-checked hard cases, verified once against the provider's own site: township that differs from the mailing city; unincorporated county land; a city-owned electric utility; an electric cooperative; a deregulated market where the delivery company is the right answer and a retail supplier is not; a provider whose name contains another state's name; a rural propane or oil address; a new subdivision.
- Each case lists the accepted provider names (more than one where that is true, as with internet) and, where known, the correct main phone and website domain.

**What the script does.** For each configuration (model, thinking level, prompt version, one pass or two, grounding on or off, with or without county), it calls the same code path production uses, bypassing cache and workspace memory (the repository already has this pattern in `searchProvidersFresh` and `resolveContactFresh`), and writes one row per case.

**What it records.**

| Measure | How |
|---|---|
| Correct top answer; correct answer in top 3 | Match against accepted names using the existing canonical name matcher |
| Hallucination proxy | Items returned that are not in the accepted set and are out of state or have no source |
| Single-provider honesty | For one-provider categories, how many extra providers were listed |
| Contact accuracy | Website domain and phone match where known |
| Source quality | Number of sources; share from the provider's own or a government domain |
| Schema compliance | Parse and validation failures |
| Latency | p50 and p95 per pass and per case |
| Tokens and searches | From `usageMetadata` and grounding metadata |
| Cost per successful case | Tokens plus searches, divided by cases with a correct top-3 answer |

**Output.** A CSV and a short comparison table in an ignored folder. A change ships only if it does not lower top-1 and top-3 accuracy and improves at least one of accuracy, latency or cost.

**Cost of running it.** About 150 to 300 calls per configuration: well under $1 in tokens. It draws on the same 5,000 free monthly searches as production, so run a few configurations at a time.

**Ongoing check in production.** The acceptance-by-source query from I1, in Admin telemetry.

---

## 10. Prioritized roadmap

| # | Recommendation | Current state | Issue | Proposed change | Benefit | Trade-offs | Effort | Priority |
|---|---|---|---|---|---|---|---|---|
| R1 | Cache per city | ZIP3 key, 30 days | 65% of cache hits come from another city; acceptance 68% vs 82% | Add city (and full ZIP) to the suggestion cache key; bump cache version | Largest accuracy gain available | 2 to 3 times more fresh suggestion lookups | Small (hours, with tests) | Critical |
| R2 | Rework search | AI pipeline on every typing pause; 58% return nothing | 63% of AI passes for 6% of entries; correct single matches rejected | Local filter first; AI on longer pause or explicit action; one pass; its own gate | Removes most AI spend and the 7 s wait | Small UI change in the search box | Medium (1 to 2 days) | Critical |
| R3 | Timeouts and deadline | None | 130 to 160 s worst cases | Per-call timeout, real overall deadline | Predictable waits | Slightly more fallbacks on slow days | Small | Critical |
| R4 | Allow single-provider answers | Min 2 results, "5-8 candidates" | 22% generic-list rate; padding | New prompt wording and per-category gate; new prompt version | Fewer wrong and padded lists | Needs evaluation to confirm; prompt change invalidates caches (fine) | Small to medium | Recommended |
| R5 | Record tokens, searches, contact outcomes; alert on fallback rate | Not recorded; no alert | Cost invisible; July incident unnoticed 5 days | Read `usageMetadata`; small migration for new columns; ops event | Facts instead of estimates; early warning | One additive migration (needs your approval to run) | Medium | Recommended |
| R6 | Evaluation script and case file | None | Model choice is guesswork | Section 9 | Every later decision is measured | Half a day of hand-checking hard cases | Medium (1 to 2 days) | Recommended |
| R7 | Recreate `GEMINI_THINKING_LEVEL` as Config | Secret, value unknown | Cannot see or reason about it | Delete, recreate as Config, redeploy | Visibility | A redeploy | Minutes (owner action) | Recommended |
| R8 | One pass by default; decide on verify with data | Verify runs 94% of the time | Doubles latency and searches, unproven value | Evaluate one pass vs two; keep verify only if it wins | About half the latency and passes | Possible small accuracy loss if verify was helping | Small, after R6 | Recommended |
| R9 | Model trial: `gemini-3.5-flash-lite` and `gemini-3.8-flash` vs current | `gemini-3.1-flash-lite` | Current model is a generation behind and dropping out of doc tables | Run in the evaluation; switch only on a measured gain | Possible accuracy gain; readiness if the current model is retired | A few dollars a month more | Small, after R6 | Recommended |
| R10 | County and township from Places into the prompt | Discarded | Mailing city is not the service municipality | Store and pass them | Better water, sewer, trash | Applies only to addresses chosen from autocomplete | Small to medium | Recommended |
| R11 | Honest fallback | National names shown as local | 31% acceptance, misleading | Empty state or "Common providers" label | Sellers are not misled | UI and wording decision | Small | Recommended |
| R12 | Source-based trust for results and contacts | Sources ignored | Unverified contacts in the buyer's sheet | Require sources; compare website domain | Fewer fabricated contacts | Needs a look at real source data first | Medium | Optional, after R5 |
| R13 | Narrow the state-name filter | Rejects names containing another state | "Washington Gas" style losses | Exempt county and city names | Small accuracy gain | Low | Small | Optional |
| R14 | Remove unused code and fix `.env.example` | Legacy pipeline, shadow switches, stale model | Reading cost, risk of doubling calls | Delete | Simpler | None | Small | Optional |
| R15 | Budget alert and Maps key restriction check | Not verified | Open-ended exposure | Google Cloud console settings | Safety | None | Minutes (owner action) | Recommended |

Suggested order: R7 and R15 today (owner, minutes). Then R1, R3, R2. Then R5 and R6. Then R4, R8, R9, R10, R11 decided with evaluation results. R12 to R14 as time allows.

---

## 11. The three options, and the recommendation

**Option A, minimal changes.** Keep model and architecture; do R1, R2, R3, R7, R15. Fixes the three measured seller-facing defects and most of the waste in a few days. Leaves the single-provider problem, the invisible costs, and the model question open. Low risk.

**Option B, incremental modernization.** Option A, plus measurement (R5, R6), then the prompt and gate redesign, one-pass default, county context and the model trial, each decided by the evaluation. Same architecture, same provider. About one to two weeks of focused work spread over a longer period.

**Option C, substantial overhaul.** Move to another AI provider, split work across several models, or replace AI with authoritative datasets for electric and internet. None of the problems found here is caused by Gemini, and at about 130 requests a month a dataset pipeline costs more to keep current than it returns. The only part worth keeping in view is a stronger model for contact lookups, which the Option B evaluation can test in an afternoon.

**Recommended: Option B, starting with Option A's items.** The reasoning in one paragraph: UtilitySheet's AI results are held back by a cache that ignores the city, a search box that spends most of the AI budget to return nothing, a rule that punishes correct single answers, and a pipeline with no clock. Those are fixable in the existing code and would matter with any model from any provider. Fixing them cuts AI calls by roughly two thirds, which makes even the newest Flash model affordable, and the evaluation script then tells you whether that model is actually better for this task. Keep Gemini. Do not add Maps grounding. Do not adopt a second provider. Upgrade the model only when the numbers say so.

Nothing in this report has been implemented. Each roadmap item needs your approval before work starts, and R5 includes a schema migration that would need separate authorization to run.

---

## Sources

Official pages read on 2026-10-12:

- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Gemini thinking: https://ai.google.dev/gemini-api/docs/thinking
- Grounding with Google Search: https://ai.google.dev/gemini-api/docs/google-search
- Grounding with Google Maps: https://ai.google.dev/gemini-api/docs/maps-grounding
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Google Maps Platform pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Vercel Config and Secret environment variables: https://vercel.com/docs/environment-variables/sensitive-environment-variables

Limits of this audit: documentation pages were read through a summarizing fetch tool, so table details (in particular the absence of `gemini-3.1-flash-lite` from two tables, and per-model defaults) should be confirmed by eye before acting on them. No Google billing, hosting environment values, or Google Cloud console settings were visible. No model was called; all accuracy statements come from production outcomes, not from new tests.
