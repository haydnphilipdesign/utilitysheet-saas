-- Advanced packet field usage analysis
-- Created 2026-09-03 to support docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md
--
-- PURPOSE
--   Answer "are the 33 built-in advanced questions sufficient?" from data that
--   already exists, before funding any new fields or a custom-question builder.
--
-- SAFETY
--   Every query here is READ ONLY and returns aggregate counts only. No query
--   returns a customer-supplied value, a seller answer, an address, or an email.
--   Query 6 deliberately returns only lengths and counts for the notes fields,
--   never their text, because those fields can contain access details.
--   Do not modify these queries to select raw values without a deliberate
--   decision about handling personal data.
--
-- HOW TO READ THE RESULT
--   Query 1 tests the discoverability hypothesis.
--   Query 4 is the single most informative number available: if sellers already
--   leave the existing garage door code blank, they will leave a front door code
--   blank too, and the whole credential expansion is worth much less than it
--   appears.
--   Query 5 tests whether customers are removing the access module, which would
--   make Michelle an outlier and should stop the expansion.


-- ---------------------------------------------------------------------------
-- 1. Advanced mode adoption
--    Low adoption on paid plans means this is primarily a discoverability
--    problem, which validates the cheap Now slice over any new field work.
-- ---------------------------------------------------------------------------

SELECT
    a.subscription_status,
    COUNT(*)                                                        AS workspaces,
    COUNT(*) FILTER (WHERE il.default_packet_mode = 'advanced')     AS default_advanced,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE il.default_packet_mode = 'advanced')
        / NULLIF(COUNT(*), 0)
    , 1)                                                            AS pct_advanced
FROM accounts a
JOIN intake_links il ON il.account_id = a.id
GROUP BY a.subscription_status
ORDER BY a.subscription_status;


-- ---------------------------------------------------------------------------
-- 2. Advanced mode usage at the request level
--    A workspace can default to advanced and still rarely use it, or vice versa.
--    Demo rows and soft-deleted rows are excluded.
-- ---------------------------------------------------------------------------

SELECT
    r.packet_mode,
    COUNT(*)                                              AS requests,
    COUNT(*) FILTER (WHERE r.status = 'submitted')        AS submitted,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE r.status = 'submitted')
        / NULLIF(COUNT(*), 0)
    , 1)                                                  AS pct_submitted
FROM requests r
WHERE r.deleted_at IS NULL
  AND COALESCE(r.is_demo, FALSE) = FALSE
GROUP BY r.packet_mode
ORDER BY r.packet_mode;


-- ---------------------------------------------------------------------------
-- 3. Which modules customers actually enable
--    Modules nobody enables are dead weight. This is also the base rate against
--    which "customers want more access questions" has to be judged.
-- ---------------------------------------------------------------------------

SELECT
    module_key,
    COUNT(*) AS requests_with_module_enabled
FROM requests r
CROSS JOIN LATERAL UNNEST(r.advanced_modules) AS module_key
WHERE r.deleted_at IS NULL
  AND COALESCE(r.is_demo, FALSE) = FALSE
  AND r.packet_mode = 'advanced'
GROUP BY module_key
ORDER BY requests_with_module_enabled DESC;


-- ---------------------------------------------------------------------------
-- 4. THE KEY QUERY. Fill rate per field on submitted advanced requests.
--    advanced_packet_data is shaped { module_key: { field_key: value } }.
--    This counts non-empty answers per field without returning any answer.
--
--    Watch garage_door_code specifically. It is the closest existing analogue to
--    what Michelle is asking for, and its fill rate is the best available
--    predictor of whether sellers would supply a front door code.
-- ---------------------------------------------------------------------------

WITH advanced AS (
    SELECT r.id, r.advanced_packet_data
    FROM requests r
    WHERE r.deleted_at IS NULL
      AND COALESCE(r.is_demo, FALSE) = FALSE
      AND r.packet_mode = 'advanced'
      AND r.status = 'submitted'
),
module_totals AS (
    SELECT
        m.key                         AS module_key,
        COUNT(*)                      AS submitted_with_module
    FROM advanced a
    CROSS JOIN LATERAL JSONB_EACH(a.advanced_packet_data) AS m(key, value)
    GROUP BY m.key
),
field_fills AS (
    SELECT
        m.key                         AS module_key,
        f.key                         AS field_key,
        COUNT(*) FILTER (
            WHERE f.value IS NOT NULL
              AND f.value <> 'null'::jsonb
              AND BTRIM(f.value #>> '{}') <> ''
        )                             AS answered
    FROM advanced a
    CROSS JOIN LATERAL JSONB_EACH(a.advanced_packet_data) AS m(key, value)
    CROSS JOIN LATERAL JSONB_EACH(m.value)               AS f(key, value)
    GROUP BY m.key, f.key
)
SELECT
    ff.module_key,
    ff.field_key,
    mt.submitted_with_module,
    ff.answered,
    ROUND(100.0 * ff.answered / NULLIF(mt.submitted_with_module, 0), 1) AS pct_answered
FROM field_fills ff
JOIN module_totals mt ON mt.module_key = ff.module_key
ORDER BY pct_answered ASC, ff.module_key, ff.field_key;


-- ---------------------------------------------------------------------------
-- 5. Which questions customers deliberately turn OFF
--    advanced_module_exclusions is shaped { module_key: [field_key, ...] }.
--    A field customers actively remove is a field that should not have been
--    built. Heavy exclusion of the access or security modules is the strongest
--    counter-evidence to the whole short-term-rental expansion.
-- ---------------------------------------------------------------------------

SELECT
    m.key                                   AS module_key,
    excluded_field                          AS field_key,
    COUNT(*)                                AS times_excluded
FROM requests r
CROSS JOIN LATERAL JSONB_EACH(r.advanced_module_exclusions) AS m(key, value)
CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(m.value)       AS excluded_field
WHERE r.deleted_at IS NULL
  AND COALESCE(r.is_demo, FALSE) = FALSE
  AND r.packet_mode = 'advanced'
GROUP BY m.key, excluded_field
ORDER BY times_excluded DESC;

-- Same question at the workspace-default level, which is the more deliberate
-- signal because it reflects a considered settings choice rather than a one-off.

SELECT
    m.key                                   AS module_key,
    excluded_field                          AS field_key,
    COUNT(*)                                AS workspaces_excluding
FROM intake_links il
CROSS JOIN LATERAL JSONB_EACH(il.advanced_module_exclusions) AS m(key, value)
CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(m.value)        AS excluded_field
GROUP BY m.key, excluded_field
ORDER BY workspaces_excluding DESC;


-- ---------------------------------------------------------------------------
-- 6. Notes-field pressure, WITHOUT reading the notes
--    If customers are already typing long entries into the free-text notes
--    fields, that is unprompted demand for structured questions and the best
--    evidence available without asking anyone.
--
--    Returns lengths and counts only. These fields can contain access details,
--    so do not change this to select the text.
-- ---------------------------------------------------------------------------

WITH notes AS (
    SELECT
        f.key                                   AS field_key,
        LENGTH(BTRIM(f.value #>> '{}'))         AS chars
    FROM requests r
    CROSS JOIN LATERAL JSONB_EACH(r.advanced_packet_data) AS m(key, value)
    CROSS JOIN LATERAL JSONB_EACH(m.value)               AS f(key, value)
    WHERE r.deleted_at IS NULL
      AND COALESCE(r.is_demo, FALSE) = FALSE
      AND r.status = 'submitted'
      AND f.key IN (
            'smart_home_notes',
            'other_maintenance_providers',
            'service_provider_notes',
            'lawn_exterior_notes',
            'irrigation_notes'
          )
      AND BTRIM(f.value #>> '{}') <> ''
)
SELECT
    field_key,
    COUNT(*)                                        AS non_empty_answers,
    ROUND(AVG(chars))                               AS avg_chars,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY chars) AS median_chars,
    MAX(chars)                                      AS max_chars,
    COUNT(*) FILTER (WHERE chars > 120)             AS answers_over_120_chars
FROM notes
GROUP BY field_key
ORDER BY non_empty_answers DESC;
