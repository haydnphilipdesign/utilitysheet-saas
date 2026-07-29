# Incident Sheet Review and Repair Implementation Plan

**Status (2026-07-29):** Tooling complete and validated. The read-only production report completed with
6 automatic candidates, 8 customer-confirmation cases, and 55 unchanged entries. Decision review,
repair dry run, and any live repair remain authorization-gated.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a private, read-only review packet for incident-affected sheets and safely repair only corroborated missing contact fields after a separate reviewed dry run.

**Architecture:** Add fresh, no-cache diagnostic interfaces around the existing search and contact services. A local TypeScript command queries incident-window submissions, performs two independent location-aware resolutions, classifies conservative automatic candidates, and renders an untracked HTML decision packet. A separate apply-gated command validates exported decisions and performs an all-or-none optimistic SQL repair with admin and request audit events.

**Tech Stack:** TypeScript, `tsx`, Neon serverless SQL, existing provider services, Zod, Vitest, static HTML/JavaScript.

---

Running the report against production is read-only but still requires an explicit operational command.
Running repair with `--apply` is a production-data mutation and remains separately authorization-gated.
No provider name or existing contact value may be overwritten.

### Task 1: Add an explicit TypeScript operations runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install the local operations runtime**

Run:

```powershell
npm install --save-dev tsx
```

Expected: `tsx` appears in `devDependencies` and the lockfile changes only for that dependency tree.

- [ ] **Step 2: Add safe script entry points**

Add:

```json
{
  "scripts": {
    "incident:provider-report": "tsx scripts/incident/provider-resolution-report.ts",
    "incident:provider-repair": "tsx scripts/incident/provider-resolution-repair.ts"
  }
}
```

Keep every existing package script unchanged.

- [ ] **Step 3: Ignore generated incident artifacts**

Append:

```gitignore
/.incident-reports/
```

The directory may contain property addresses and decisions and must never be tracked.

### Task 2: Expose fresh diagnostic resolution without changing seller behavior

**Files:**
- Modify: `lib/providers/suggestion-service.ts`
- Modify: `lib/providers/contact-service.ts`
- Modify: `tests/unit/suggestion-service.test.ts`
- Modify: `tests/unit/contact-service.test.ts`

- [ ] **Step 1: Write failing no-cache diagnostic tests**

Test that a fresh search returns provenance and neither reads nor writes cache:

```ts
const result = await searchProvidersFresh(
    'Duke Energy',
    'electric',
    '123 Main St, Raleigh, NC 27601'
);

expect(result.outcome.source).toBe('ai_verify');
expect(result.suggestions[0].display_name).toBe('Duke Energy');
expect(getFromCacheMock).not.toHaveBeenCalled();
expect(setInCacheMock).not.toHaveBeenCalled();
```

Test that fresh contact resolution returns parsed data plus failure and grounding URLs without cache:

```ts
const result = await resolveContactFresh('Duke Energy', {
    category: 'electric',
    address: '123 Main St, Raleigh, NC 27601',
});

expect(result).toEqual({
    contact: expect.objectContaining({ main_website: 'https://duke-energy.com/' }),
    failure: null,
    groundingSourceUrls: ['https://duke-energy.com/contact'],
});
expect(getFromCacheMock).not.toHaveBeenCalled();
expect(setInCacheMock).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- tests/unit/suggestion-service.test.ts tests/unit/contact-service.test.ts --run
```

Expected: FAIL because the fresh diagnostic exports do not exist.

- [ ] **Step 3: Export fresh provider search provenance**

Export the existing result shape and add a wrapper that calls the pipeline directly:

```ts
export interface ProviderSearchDiagnostic {
    suggestions: ProviderSuggestion[];
    outcome: SuggestionOutcome;
}

export async function searchProvidersFresh(
    query: string,
    category: UtilityCategory,
    address: string
): Promise<ProviderSearchDiagnostic> {
    const resolvedAddress = await resolveParsedLocation(address);
    return runSearchPipeline({
        query: query.trim(),
        category,
        resolvedAddress,
    });
}
```

Validate query length as the public search does. This wrapper must not consult/write cache, persist AI
telemetry, or blend account-scoped provider memory because the incident report is not a seller run.

- [ ] **Step 4: Export fresh contact resolution metadata**

Refactor the private AI call into:

```ts
export interface ContactResolutionDiagnostic {
    contact: ProviderContact | null;
    failure: JSONFailureReason | null;
    groundingSourceUrls: string[];
}

export async function resolveContactFresh(
    providerName: string,
    context?: ContactLookupContext
): Promise<ContactResolutionDiagnostic> {
    // configuration check, schema-backed Gemini call, and existing sanitization
}
```

`resolveContact()` calls the fresh function after its cache miss, but keeps its current public return
type. The fresh function must not read or write cache.

- [ ] **Step 5: Run diagnostic service tests**

Run:

```powershell
npm test -- tests/unit/suggestion-service.test.ts tests/unit/contact-service.test.ts --run
```

Expected: PASS with unchanged seller-facing service tests.

### Task 3: Build deterministic conservative classification

**Files:**
- Create: `scripts/incident/provider-resolution-core.ts`
- Create: `tests/unit/incident-provider-resolution-core.test.ts`

- [ ] **Step 1: Write failing classification tests**

Cover an exact, corroborated result:

```ts
expect(classifyIncidentEntry({
    entry: unresolvedEntry,
    search: {
        outcome: { source: 'ai_verify' },
        suggestions: [{
            display_name: 'Duke Energy',
            confidence: 0.93,
            contact_phone: '800-777-9898',
            contact_website: 'https://www.duke-energy.com/',
        }],
    },
    contact: {
        contact: {
            customer_service_phone: '1-800-777-9898',
            main_website: 'https://duke-energy.com/',
        },
        failure: null,
        groundingSourceUrls: [],
    },
})).toMatchObject({
    disposition: 'automatic_contact_repair',
    proposedPhone: '1-800-777-9898',
    proposedUrl: 'https://duke-energy.com/',
});
```

Also cover:

- provider names that do not match exactly after canonical normalization;
- fallback search provenance;
- confidence below `0.80`;
- contact and suggestion phone/domain disagreement;
- no corroborating phone or domain;
- an existing phone/URL that must remain untouched;
- suspicious HTML content escaped in the report renderer.

- [ ] **Step 2: Run the core test and verify failure**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-core.test.ts --run
```

Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement the classifier**

Define:

```ts
export type IncidentDisposition =
    | 'automatic_contact_repair'
    | 'needs_customer_confirmation'
    | 'leave_unchanged';

export interface IncidentRepairProposal {
    disposition: IncidentDisposition;
    reasons: string[];
    proposedPhone: string | null;
    proposedUrl: string | null;
}
```

Automatic classification requires all of:

```ts
const acceptedSources = new Set(['ai_primary', 'ai_verify', 'ai_recovery']);
const exact = search.suggestions.find(
    (item) => canonicalProviderKey(item.display_name) === canonicalProviderKey(entry.providerName)
);

const corroboratedPhone =
    normalizePhone(exact?.contact_phone) === normalizePhone(contact.customer_service_phone);
const corroboratedDomain =
    normalizedHost(exact?.contact_website) ===
    normalizedHost(contact.main_website || contact.start_stop_service_url);
```

Require accepted source, exact match, confidence at least `0.80`, a valid fresh contact, and either
matching phone or matching domain. Proposed fields use `null` wherever the current row already has a
value. Suggested/search-selected entries that fail these checks are `needs_customer_confirmation`;
manual entries without enough evidence are `leave_unchanged`.

- [ ] **Step 4: Run classification tests**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-core.test.ts --run
```

Expected: PASS.

### Task 4: Generate the private HTML review packet

**Files:**
- Create: `scripts/incident/provider-resolution-report.ts`
- Modify: `scripts/incident/provider-resolution-core.ts`
- Modify: `tests/unit/incident-provider-resolution-core.test.ts`

- [ ] **Step 1: Implement incident-bound and entry queries**

Require `DATABASE_URL` and Gemini credentials. Derive bounds from model telemetry:

```sql
WITH last_bad AS (
    SELECT MAX(created_at) AS at
    FROM ai_generation_runs
    WHERE model = 'gemini-3.5-flash-lite'
),
bounds AS (
    SELECT
        (SELECT MIN(created_at) FROM ai_generation_runs
         WHERE model = 'gemini-3.5-flash-lite') AS started_at,
        (SELECT MIN(created_at) FROM ai_generation_runs, last_bad
         WHERE model = 'gemini-3.1-flash-lite'
           AND created_at > last_bad.at) AS ended_at
)
SELECT * FROM bounds;
```

Fail closed if either bound is absent. Query non-demo submitted requests whose first
`seller_submitted` event falls inside the bounds. Include all suggested/search entries plus entries
where both contact fields are null. Select request ID, property address, entry ID/category/mode/name,
contact fields, and entry `updated_at`; do not select seller or account contact information.

- [ ] **Step 2: Resolve with bounded concurrency**

Use a concurrency limit of two. For every row, run `searchProvidersFresh()` and
`resolveContactFresh()`, classify it, and retain only redacted resolution metadata needed by the packet.
Log aggregate progress only.

- [ ] **Step 3: Render a self-contained safe report**

Write the report under:

```ts
const outputDirectory = path.resolve('.incident-reports');
const outputPath = path.join(
    outputDirectory,
    `provider-resolution-${INCIDENT_ID}-${Date.now()}.html`
);
```

The page groups by request, defaults automatic candidates to included, and gives ambiguous rows
`Needs customer confirmation` or `Leave unchanged`. Escape every database/model string before inserting
it into HTML. An `Export decisions` button downloads JSON containing:

```ts
{
    incidentId: 'provider-resolution-2026-07',
    generatedAt: string,
    entries: Array<{
        entryId: string;
        requestId: string;
        category: string;
        expectedUpdatedAt: string;
        expectedProviderName: string;
        expectedPhone: string | null;
        expectedUrl: string | null;
        action: 'fill_missing' | 'customer_confirmation' | 'leave_unchanged';
        proposedPhone: string | null;
        proposedUrl: string | null;
    }>;
}
```

- [ ] **Step 4: Add report renderer tests**

Assert grouping, default actions, decision export fields, no account/seller contact fields, and escaping
of `<script>`/`</script>` payloads.

- [ ] **Step 5: Run report tests and local no-env failure check**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-core.test.ts --run
npm run incident:provider-report
```

Expected: tests PASS; the command exits non-zero with a clear missing-environment message and performs
no writes when `DATABASE_URL`/Gemini credentials are absent.

### Task 5: Build all-or-none repair dry run and apply gate

**Files:**
- Create: `scripts/incident/provider-resolution-repair.ts`
- Create: `scripts/incident/provider-resolution-repair-core.ts`
- Create: `tests/unit/incident-provider-resolution-repair.test.ts`

- [ ] **Step 1: Write failing decision and optimistic-update tests**

Test rejection of:

- an incident ID other than `provider-resolution-2026-07`;
- an action other than `fill_missing`;
- any proposal that changes a provider name;
- a row whose `updated_at`, provider, or contact values changed;
- a proposal that would overwrite a non-null field;
- apply mode without `--confirm provider-resolution-2026-07`;
- apply mode without a verified Admin account ID.

Test that dry run emits aggregate counts and changed field names without addresses, provider names, or
contact values.

- [ ] **Step 2: Run repair tests and verify failure**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-repair.test.ts --run
```

Expected: FAIL because validation and repair planning do not exist.

- [ ] **Step 3: Implement strict decision validation**

Use Zod to parse the exported JSON. Build a repair plan only from `fill_missing` entries. Requery current
rows and require exact equality for `updated_at`, provider name, phone, and URL. Fill only null fields
with non-null proposals. Abort the entire plan on any stale or invalid row.

- [ ] **Step 4: Implement dry-run output**

Default mode prints only:

```text
incident=provider-resolution-2026-07 mode=dry-run
selected=<n> eligible=<n> stale=0
phone_fields=<n> url_fields=<n> requests=<n>
No production data changed.
```

It writes a local untracked JSON dry-run artifact with opaque request/entry IDs and field names for
operator review.

- [ ] **Step 5: Implement one-statement all-or-none repair**

In apply mode, require `ADMIN_WRITES_DISABLED !== 'true'`, `--admin-id`, and exact `--confirm`. Verify the
admin row has `role = 'admin'`. Send the plan as JSON to one SQL statement:

```sql
WITH input AS (
    SELECT *
    FROM jsonb_to_recordset($1::jsonb) AS x(
        entry_id uuid,
        expected_updated_at timestamptz,
        expected_provider_name text,
        expected_phone text,
        expected_url text,
        proposed_phone text,
        proposed_url text
    )
),
eligible AS (
    SELECT ue.id
    FROM utility_entries ue
    JOIN input i ON i.entry_id = ue.id
    WHERE ue.updated_at = i.expected_updated_at
      AND ue.display_name IS NOT DISTINCT FROM i.expected_provider_name
      AND ue.contact_phone IS NOT DISTINCT FROM i.expected_phone
      AND ue.contact_url IS NOT DISTINCT FROM i.expected_url
      AND (i.proposed_phone IS NULL OR ue.contact_phone IS NULL)
      AND (i.proposed_url IS NULL OR ue.contact_url IS NULL)
),
guard AS (
    SELECT
        (SELECT COUNT(*) FROM input) AS requested,
        (SELECT COUNT(*) FROM eligible) AS eligible
),
updated AS (
    UPDATE utility_entries ue
    SET contact_phone = COALESCE(ue.contact_phone, i.proposed_phone),
        contact_url = COALESCE(ue.contact_url, i.proposed_url),
        updated_at = NOW()
    FROM input i, guard g
    WHERE ue.id = i.entry_id
      AND g.requested = g.eligible
    RETURNING ue.id, ue.request_id, ue.category
)
SELECT * FROM updated;
```

Extend the same statement with CTE inserts into `admin_audit_logs` and `event_logs`. Metadata contains
incident ID, entry ID, category, and changed field names only—never contact values or addresses. Require
returned row count to equal the plan count and otherwise report no changes.

- [ ] **Step 6: Run repair tests**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-repair.test.ts --run
```

Expected: PASS.

### Task 6: Validate local tooling without touching production

**Files:**
- Modify: `.ai/CURRENT.md`
- Modify: `.ai/plans/2026-07-29-provider-contact-resolution-incident.md`

- [ ] **Step 1: Run the incident tooling suite**

Run:

```powershell
npm test -- tests/unit/incident-provider-resolution-core.test.ts tests/unit/incident-provider-resolution-repair.test.ts tests/unit/suggestion-service.test.ts tests/unit/contact-service.test.ts --run
npm exec tsc -- --noEmit
npm exec eslint -- scripts/incident lib/providers tests/unit/incident-provider-resolution-core.test.ts tests/unit/incident-provider-resolution-repair.test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 2: Inspect generated-artifact safeguards**

Run:

```powershell
git status --short
npm run security:scan
```

Expected: `.incident-reports/` is absent from Git status and the tracked-artifact security scan passes.

- [ ] **Step 3: Update durable handoff**

Record that implementation is locally validated but the production report has not been generated and
no repair has run. The next action is an explicitly authorized read-only report invocation, followed by
review and a separately authorized apply.
