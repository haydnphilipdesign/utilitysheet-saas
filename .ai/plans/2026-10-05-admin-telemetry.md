# Admin telemetry

- Owner: Codex. Date: 2026-10-05. Status: completed locally; not committed/deployed.
- Scope: saved-form adoption from existing durable form/request provenance; read-only Admin Telemetry page with existing request-event and AI-run summaries.
- Verified: Friday's release records requests.source_form_id/revision; form create/duplicate routes have no dedicated events. Vercel browser events are separate. No schema or production changes needed.
- Files: lib/neon/queries/admin-telemetry.ts; app/(admin)/admin/telemetry/page.tsx; admin navigation; tests; ADMIN.md.
- Metrics: current inventory; accounts with multiple forms in one creator/workspace; rolling 7/30/90-day request cohorts, attribution, completions and accounts using multiple distinct forms in one scope. Exclude admin-owned, demo and deleted requests. Completed means metered_at present. Historical NULL provenance stays unknown. Inventory is not a creation-event count.
- Other telemetry: event type/count/distinct requests and AI feature/status/run/cache/latency aggregates. No payloads, seller text, tokens or locality. Authorize before queries, dynamic rendering, bounded parameterized periods, empty/unavailable states.
- Acceptance: separate workspace baseline forms never inflate adoption; repeated one-form use is not multiple-form use; clear denominators/time semantics; failures never appear as zero; unauthorized access runs no queries.
- Validation: focused auth/query/render tests, TypeScript and affected ESLint; native PostgreSQL aggregation verification if local harness is available.
- Deferred: create/duplicate/click history and Vercel ingestion. Durable records answer actual use without a parallel analytics store.

- Final validation: 18 focused tests passed on Node20.20.2, including real embedded PostgreSQL/PGlite queries and page/navigation rendering. TypeScript, affected ESLint and diff whitespace checks passed. Native PostgreSQL was unnecessary for these read-only aggregates; no concurrency mutations. No live DB/build/browser smoke performed. No required local work remains; review and separately authorize release if desired.


## Expansion: product usage reports
- Status: completed locally (2026-10-05); authorized expansion, no delegation or deployment.
- Add completion/open funnel and median elapsed time; creation channel, packet mode and enabled modules; provider entry-mode mix by category; repeat request creation across adjacent equal windows; reminders/return links/edits; test-drive to later live submission where explicit markers exist.
- Keep existing customer/demo/deletion exclusions. Request cohort uses creation time; provider outcomes use first-submission cohort and current entries. Use only allowlisted event fields, deduplicate request-level events, label denominators and unknowns. No causal claims, no raw text. Vercel-only ingestion remains deferred.
- Validate actual SQL with existing PGlite fixture, render empty/populated states, focused tests, TypeScript and affected lint. No live operations.

- Expansion outcome: all six database-backed reports implemented. 20 focused Node20 tests passed, with PGlite SQL edge cases, populated/empty rendering and sidebar checks. TypeScript/affected ESLint passed. No new data collection or migrations, no required local work remains. Vercel-only reports remain optional; review and separately authorize release.

