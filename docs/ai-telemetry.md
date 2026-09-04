# AI Telemetry

## Purpose

UtilitySheet uses AI to suggest likely utility providers and provider search results for a seller's property area. The AI telemetry foundation records enough structured data to measure quality, reliability, latency, fallback behavior, and seller acceptance over time without storing sensitive seller/property payloads.

This system is intentionally small. It is not an AI audit log of raw prompts or full responses. It is a durable, redacted event model that can later power reporting, prompt tuning, provider-memory improvements, and an internal AI Review page.

## Tables

### `ai_generation_runs`

One row represents one provider suggestion or provider search run shown to a seller. It stores summarized run metadata:

- `request_id`, `account_id`, `organization_id`: relational context for later joins.
- `feature`: currently `provider_suggestions` or `provider_search`.
- `category`: utility category such as `electric`, `water`, or `trash`.
- `provider`: AI provider name, currently `gemini`.
- `model`: configured Gemini model name.
- `prompt_version`: application-level prompt version, such as `provider-suggestions-v1`.
- `served_pipeline`: suggestion pipeline that served the result, such as `new` or `legacy`.
- `source`: final source, such as `ai_primary`, `ai_verify`, `ai_recovery`, `history_blend`, `fallback`, or `cache`.
- `status`: normalized status: `success`, `fallback`, `error`, `parse_error`, or `quality_rejected`.
- `reason_code` and `upstream_reason_code`: structured failure/fallback reasons from the suggestion pipeline.
- `latency_ms`, `attempt_count`, `suggestion_count`, `cache_hit`.
- `locality_state`, `locality_zip3`, `locality_city`: locality metadata only. No street address is stored.
- `created_at`.

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

Provider names shown to sellers are stored because they are the object being evaluated. Location is limited to state, ZIP3, and city.

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

It does not include provider names, meter numbers, contact values, advanced field answers, or seller/property identity fields.

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
