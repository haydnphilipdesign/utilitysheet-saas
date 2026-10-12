# AI Telemetry

## Purpose

UtilitySheet uses AI to suggest likely utility providers and provider search results for a seller's property area. The AI telemetry foundation records enough structured data to measure quality, reliability, latency, fallback behavior, and seller acceptance over time without storing sensitive seller/property payloads.

This system is intentionally small. It is not an AI audit log of raw prompts or full responses. It is a durable, redacted event model that can later power reporting, prompt tuning, provider-memory improvements, and an internal AI Review page.

## Tables

### `ai_generation_runs`

One row represents one provider suggestion or provider search run shown to a seller, or one provider contact lookup made after a seller submits. It stores summarized run metadata:

- `request_id`, `account_id`, `organization_id`: relational context for later joins.
- `feature`: `provider_suggestions`, `provider_search` or `provider_contact`.
- `category`: utility category such as `electric`, `water`, or `trash`. May be empty for a contact lookup.
- `provider`: AI provider name, currently `gemini`.
- `model`: configured Gemini model name.
- `prompt_version`: application-level prompt version, such as `provider-suggestions-v2`.
- `served_pipeline`: suggestion pipeline that served the result, such as `new` or `legacy`.
- `source`: final source, such as `ai_primary`, `ai_verify`, `ai_recovery`, `history_blend`, `fallback`, or `cache`.
- `status`: normalized status: `success`, `fallback`, `error`, `parse_error`, or `quality_rejected`.
- `reason_code` and `upstream_reason_code`: structured failure/fallback reasons from the suggestion pipeline.
- `latency_ms`, `attempt_count`, `suggestion_count`, `cache_hit`.
- `locality_state`, `locality_zip3`, `locality_city`: locality metadata only. No street address is stored.
- `created_at`.
- `prompt_tokens`, `output_tokens`, `thinking_tokens`, `tool_prompt_tokens`: token counts reported by the provider, added up over the AI passes of the run that returned an answer. `tool_prompt_tokens` is the search-result text fed back to the model.
- `search_query_count`: Google Search queries the model ran. `source_count`: distinct web sources the answers were grounded on (a count; the addresses are not stored).
- `thinking_level`: the level sent with the calls (`minimal`, `low`, `medium`, `high`), or `default` when none was sent.
- `error_kind`: the first model-call failure of the run: `timeout`, `deadline` (no time left to start a call), `circuit_open`, `rate_limited`, `empty_response`, `api_error` or `unconfigured`. A run can carry this and still have served an AI answer from another pass.

The usage columns were added by `migrations-ai-usage-telemetry.sql`. They are empty on rows written before it, on every cache hit, and on runs where no call returned an answer. An attempt that failed or timed out reports no usage, although Google may still bill it, so the totals are a floor, not an invoice.

For `provider_contact` rows: `status` is `success` when the model answered (with `reason_code = 'ai_empty'` and `suggestion_count = 0` when it found no usable phone or start/stop link, `suggestion_count = 1` when it did), `error` when the call failed and `parse_error` when the answer was not valid JSON. No provider name and no contact value is stored.

### `ai_suggestion_items`

One row represents one suggestion item that was shown as part of an AI generation run. It stores:

- `run_id`: parent `ai_generation_runs` row.
- `request_id`, `category`: duplicated for simpler correlation queries.
- `rank`: order shown to the seller.
- `display_name`: provider name shown to the seller.
- `normalized_name`: lowercased provider name normalized for matching.
- `canonical_id`: provider canonical ID when available.
- `confidence`: AI/provider confidence when available.
- `source`: copied from the run source.
- `contact_present`: whether phone or website was present in the shown suggestion.
- `selected_by_seller`, `final_entry_mode`, `final_provider_name`, `final_canonical_id`, `final_confidence_score`, `selected_at`: seller-selection correlation fields populated on submission when a shown suggestion is selected.

## Recording Flow

Provider suggestion runs are recorded from `getSuggestions()` after the pipeline produces suggestions. Provider search runs are recorded from `searchProviders()`.

Fresh pipeline results persist:

- A run row in `ai_generation_runs`.
- One item row per shown suggestion in `ai_suggestion_items`.

Provider contact lookups are recorded from `resolveContact()` in `lib/providers/contact-service.ts`, one row per lookup, fresh or cached, linked to the request. `resolveContactFresh()` and `searchProvidersFresh()` (incident and support review) record nothing.

Cached results are also persisted as runs, with:

- `source = 'cache'`
- `cache_hit = true`
- `attempt_count = 0`
- `latency_ms = 0`

When the seller submits, UtilitySheet attempts to match selected suggestions by `request_id`, `category`, and normalized provider name. If the final entry came from a suggested or searched provider, the matching `ai_suggestion_items` row is marked as selected and updated with the final entry mode.

## `utility_entries` Correlation

When a seller accepts a suggested provider or selects a search result, the client now carries:

- `canonical_id`
- `confidence_score`

The seller submission route persists those values to existing `utility_entries.canonical_id` and `utility_entries.confidence_score`. Manual free-text and unknown entries clear those fields.

This lets future analysis compare:

- Suggestions shown.
- Suggestions selected.
- Final submitted utility entries.
- Later dashboard edits.

## Privacy Rules

AI telemetry intentionally does not store:

- Raw prompts.
- Raw AI responses.
- Full street addresses.
- Seller names, emails, or phone numbers.
- Account numbers or meter numbers.
- IP addresses.
- Full seller submission payloads.
- Property Handoff Packet field values (stored packet mode `advanced`).

Provider names shown to sellers are stored because they are the object being evaluated. Location is limited to state, ZIP3, and city. Contact lookups store no provider name, phone number or link, only whether one was found. Usage is stored as counts; search queries and source addresses are not stored.

## Reduced `seller_submitted` Event Logging

The long-lived `event_logs` row for `seller_submitted` now stores a redacted summary instead of the full submitted form payload.

The summary includes:

- `actor = 'seller'`
- `packet_mode`
- `utility_count`
- `utility_categories`
- counts by entry mode: `suggested_confirmed`, `search_selected`, `free_text`, `unknown`
- `advanced_module_count`
- enabled `advanced_modules`
- `advanced_exclusion_count`
- high-level utility configuration such as `water_source`, `sewer_type`, and `heating_type`
- `has_hoa`: the seller's Yes / No / Not Sure answer to the HOA or condo association question, or null when unanswered

It does not include provider names, meter numbers, contact values, advanced field answers, or seller/property identity fields. It also does not include the association details behind a Yes (association name, management company, contact name, phone, email, dues, or the payments-and-documents answer). Those are seller-entered free text and stay in the `requests` row only.

## Failure Behavior

Telemetry writes should never block the seller flow. Suggestion telemetry persistence is best-effort: failures are caught and only warned in non-production environments.

Submission-time selection correlation is also auxiliary. If a matching suggestion item is not found, the seller submission still succeeds and the durable `utility_entries` row remains the source of truth for the final submitted sheet.

Every Gemini JSON caller supplies an explicit response schema alongside JSON mode and Google Search
grounding. A transport-success response without candidate text is retried and ultimately classified as
`provider_error`; later quality gates preserve that upstream reason in telemetry even when a bounded
fallback is served.

Provider suggestion, provider search, and contact cache namespaces include the configured Gemini model
and the application request-format version. Usable AI results retain their normal positive cache
durations. Generic provider/search fallbacks and contact misses are cached for five minutes so a
transient provider incompatibility cannot persist for days or months.

## AI Health Observation

The scheduled monitor (`/api/cron/ops-monitor`, every 15 minutes) reads the fresh runs of the last 24 hours per feature (`lib/ops/ai-health.ts`). Cache hits are ignored. A run counts as degraded when:

- provider suggestions ended on the generic list (`source = 'fallback'`), whatever the cause;
- a provider search or contact lookup failed at the model call (`status` is `error` or `parse_error`). An empty search and a contact that was not found are normal answers.

When a feature has at least 10 fresh runs in the window and 50% or more are degraded, the monitor records one `ai` operational event (`provider_suggestions_degraded`, `provider_search_degraded` or `provider_contact_degraded`, with counts only), which appears under Service issues on Admin Operations. It is repeated once per window while the condition lasts, and a recovery is recorded when the share is back under the threshold with at least one fresh run. The same condition drives an `ai_degraded:<feature>` alert email when alerts are enabled. Nothing is checked or written inside a seller's request.

Thresholds: `OPS_ALERT_AI_SHARE_PCT` (50), `OPS_ALERT_AI_MIN_RUNS` (10), `OPS_ALERT_AI_WINDOW_HOURS` (24). They are starting points, not validated benchmarks. About one in five fresh suggestion lookups ended on the generic list before the prompt work planned for later; a threshold below that level would fire constantly. At low traffic a real outage is reported only once 10 fresh runs have accumulated.

## Admin Telemetry

`/admin/telemetry` shows three AI tables: outcomes by feature and status, usage by feature (fresh runs, AI passes, search queries, tokens, timeouts and other failed calls), and suggestion acceptance by what the seller was shown. Definitions are in `ADMIN.md`, Telemetry.

## Future AI Review Tooling

An internal AI Review page can use these tables to surface questionable runs:

- `status IN ('fallback', 'error', 'parse_error', 'quality_rejected')`
- low confidence suggestions
- categories with high free-text/manual-entry rates
- suggestions shown but not selected
- seller-selected providers later edited in the dashboard
- state or ZIP3/category combinations with frequent fallback

Useful review joins will connect:

- `ai_generation_runs`
- `ai_suggestion_items`
- `utility_entries`
- `event_logs` rows such as `submitted_sheet_edited`

## SQL Examples

### AI Success, Fallback, And Error Rate By Category

```sql
SELECT
    category,
    status,
    COUNT(*) AS run_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY category), 1) AS pct_of_category
FROM ai_generation_runs
GROUP BY category, status
ORDER BY category, status;
```

### Suggestion Acceptance Rate By Category

```sql
SELECT
    category,
    COUNT(*) FILTER (WHERE selected_by_seller IS TRUE) AS selected_count,
    COUNT(*) AS shown_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE selected_by_seller IS TRUE) / NULLIF(COUNT(*), 0),
        1
    ) AS acceptance_rate_pct
FROM ai_suggestion_items
GROUP BY category
ORDER BY acceptance_rate_pct DESC NULLS LAST;
```

### Free-Text / Manual-Entry Rate By Category

```sql
SELECT
    category,
    COUNT(*) FILTER (WHERE entry_mode = 'free_text') AS free_text_count,
    COUNT(*) AS submitted_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE entry_mode = 'free_text') / NULLIF(COUNT(*), 0),
        1
    ) AS free_text_rate_pct
FROM utility_entries
GROUP BY category
ORDER BY free_text_rate_pct DESC NULLS LAST;
```

### Average Latency By Source And Pipeline

```sql
SELECT
    source,
    served_pipeline,
    COUNT(*) AS run_count,
    ROUND(AVG(latency_ms)) AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM ai_generation_runs
WHERE cache_hit IS FALSE
GROUP BY source, served_pipeline
ORDER BY avg_latency_ms DESC;
```

### Quality-Rejected, Fallback, Parse-Error, And Provider-Error Runs

```sql
SELECT
    created_at,
    request_id,
    feature,
    category,
    source,
    status,
    reason_code,
    upstream_reason_code,
    locality_state,
    locality_zip3,
    suggestion_count
FROM ai_generation_runs
WHERE status IN ('quality_rejected', 'fallback', 'parse_error', 'error')
ORDER BY created_at DESC
LIMIT 100;
```

### Suggestions Shown Vs. Seller-Selected Provider Correlation

```sql
SELECT
    r.created_at,
    r.category,
    i.rank,
    i.display_name AS shown_provider,
    i.confidence,
    i.selected_by_seller,
    i.final_entry_mode,
    i.final_provider_name,
    ue.display_name AS submitted_provider,
    ue.entry_mode AS submitted_entry_mode
FROM ai_generation_runs r
JOIN ai_suggestion_items i ON i.run_id = r.id
LEFT JOIN utility_entries ue
    ON ue.request_id = r.request_id
   AND ue.category = r.category
WHERE r.request_id = '00000000-0000-0000-0000-000000000000'
ORDER BY r.created_at DESC, i.rank ASC;
```

### Usage By Feature And Model

```sql
SELECT
    feature,
    model,
    thinking_level,
    COUNT(*) AS fresh_runs,
    COUNT(*) FILTER (WHERE prompt_tokens IS NOT NULL OR search_query_count IS NOT NULL) AS runs_with_usage,
    SUM(attempt_count) AS ai_passes,
    SUM(search_query_count) AS search_queries,
    SUM(prompt_tokens) AS prompt_tokens,
    SUM(tool_prompt_tokens) AS search_result_tokens,
    SUM(thinking_tokens) AS thinking_tokens,
    SUM(output_tokens) AS output_tokens
FROM ai_generation_runs
WHERE cache_hit IS FALSE
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature, model, thinking_level
ORDER BY feature, model, thinking_level;
```

### Model-Call Failures By Kind

```sql
SELECT
    feature,
    error_kind,
    COUNT(*) AS run_count
FROM ai_generation_runs
WHERE error_kind IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature, error_kind
ORDER BY feature, run_count DESC;
```

### Cached Vs. Fresh Suggestion/Search Runs

```sql
SELECT
    feature,
    cache_hit,
    COUNT(*) AS run_count,
    ROUND(AVG(latency_ms)) AS avg_latency_ms
FROM ai_generation_runs
GROUP BY feature, cache_hit
ORDER BY feature, cache_hit;
```
