# Plan: Professional Requests Workspace

## Status

Completed on 2026-07-17.

All four phases and required validation are complete. No required implementation work remains.

## Objective

Make `/dashboard/requests` a professional, URL-driven workspace whose pagination, search, filters, and sorting operate across the complete authenticated account or active-organization request scope.

## Background

The current page calls `/api/requests` without pagination parameters. The API defaults to ten rows, and the page then searches and filters only those rows in the browser. There is no pagination UI, so older rows and matching results beyond the first ten records are silently unreachable.

The current schema supports `closing_date`, `created_at`, `last_activity_at`, and the four request statuses. Dashboard stats and weekly summaries currently define “Needs attention” as a `sent` request created more than three days ago. The PRD describes a narrower future system-failure concept, but no implemented request flag or schema field supports it.

## Verified Facts

- `getRequests` already scopes personal accounts to `account_id` with `organization_id IS NULL`, and active organization accounts to organization requests plus the user's pre-organization personal requests.
- Locked rows are sanitized in the API before reaching the client.
- Existing actions include request details, seller-link copy, reminder POST with authorization/rate limits/cooldown, submitted-sheet review/edit for paid accounts, public packet opening, and PDF generation.
- Manual request creation currently creates `sent` requests by default. Draft status exists in the schema and request detail/configuration path, but there is no general draft-form resume backend.
- Existing unrelated edits in seller/intake/packet files and local audit artifacts must remain untouched.

## In Scope

- Validated API list parameters and pagination metadata.
- Account-scoped server search, status and Needs Attention filtering, and deterministic schema-backed sorting.
- Centralized current Needs Attention definition.
- URL-owned list state with refresh and back/forward behavior.
- Compact toolbar visually attached to the list.
- Navigable property/address rows.
- Existing status-appropriate actions on desktop and mobile.
- Intentional loading, error, no-data, and filtered-zero states.
- Focused query, route, and component tests.
- Non-mutating responsive browser QA at approximately 390px and 1440px.

## Out of Scope

- New database fields, migrations, bulk actions, notification systems, or reminder behavior.
- A new draft editor or other speculative backend capability.
- Changes to billing, authorization, token boundaries, rate limits, plan enforcement, deployment, or production data.
- Commits, pushes, deployments, migrations, or live reminder/email actions.

## Proposed Approach

### Phase 1: Shared list contract and server correctness

1. Add a small request-listing contract for supported filters, sort values, page size, and the three-day Needs Attention threshold.
2. Extend `getRequests` to apply search, status/attention filtering, count, page clamping, and deterministic sorting inside SQL while preserving the exact account/organization scope.
3. Prevent unpaid search from matching hidden locked-row address or seller details.
4. Validate API query parameters and return data plus `total`, canonical `page`, `limit`, `totalPages`, `hasPreviousPage`, and `hasNextPage`.
5. Add focused query and route tests for scope, search, filters, sort whitelisting, totals, clamping, locked-row search protection, and metadata.

### Phase 2: URL-driven workspace UI

1. Treat `q`, `status`, `sort`, and `page` URL parameters as the authoritative list state.
2. Debounce search URL replacement; use navigable URL updates for status, sort, reset, and pagination.
3. Fetch only the server-filtered page and canonicalize an out-of-range page returned by the API.
4. Replace the separate filter card with a compact toolbar at the top of the list card.
5. Add result counts, clear-filter behavior, pagination controls, and accessible loading/error/empty states.

### Phase 3: Responsive rows and actions

1. Make property addresses links to the existing request detail route.
2. Show a clear primary action: Continue for drafts, Copy seller link for sent/in-progress, Review for submitted, and View for locked rows.
3. Reuse existing reminder, packet, PDF, and submitted-sheet edit capabilities only where already allowed.
4. Give mobile cards the same safe contextual actions as desktop and retain secondary actions in an accessible menu where appropriate.
5. Add focused component tests for URL/query behavior, pagination, state rendering, navigable rows, and status-specific actions.

### Phase 4: Validation and handoff

1. Run focused Vitest files first.
2. Run affected lint, full TypeScript type-check, and production build.
3. Use the available browser workflow for non-mutating QA at about 390px and 1440px, avoiding every reminder, email, delete, or other mutation.
4. Review the final diff for unrelated changes, update this plan to Completed, and finalize `.ai/CURRENT.md`.

## Files or Areas Expected to Change

- `app/dashboard/requests/page.tsx`
- `app/api/requests/route.ts`
- `lib/neon/queries/requests.ts`
- `lib/requests/listing.ts` (new shared list contract)
- `components/requests/RequestListActions.tsx` (new focused action component, if confirmed useful during implementation)
- `tests/unit/requests-list-query.test.ts` (new)
- `tests/unit/requests-list-route.test.ts` (new)
- `tests/unit/requests-workspace.test.tsx` (new)
- `.ai/CURRENT.md`
- `.ai/plans/2026-07-17-requests-workspace.md`

## Data, API, or Schema Impact

- No schema or migration changes.
- `GET /api/requests` gains validated search/filter/sort inputs and additional pagination booleans while preserving the existing response fields.
- Account and active-organization visibility rules remain unchanged.

## Risks and Edge Cases

- Searching locked rows by hidden address or seller name could leak information through totals; unpaid searches must exclude hidden locked details.
- Filtering can make a previously valid page out of range; the query returns a canonical clamped page and the UI replaces the URL.
- `closing_date` is nullable; closing-date sorts place missing dates last and use stable secondary ordering.
- Concurrent navigation or search responses can race; client fetches need cancellation or stale-result protection.
- Drafts have no full resume editor; “Continue” must link to the existing details/configuration route without implying unsupported editing.
- Browser QA must not activate reminder, email, deletion, PDF generation, or other live mutations.

## Validation Plan

- Focused query tests: `npm test -- tests/unit/requests-list-query.test.ts`
- Focused route tests: `npm test -- tests/unit/requests-list-route.test.ts`
- Focused UI tests: `npm test -- tests/unit/requests-workspace.test.tsx`
- Combined focused run: `npm test -- tests/unit/requests-list-query.test.ts tests/unit/requests-list-route.test.ts tests/unit/requests-workspace.test.tsx`
- Lint: `npm run lint`
- Type-check: `npm exec tsc -- --noEmit`
- Production build: `npm run build`
- Browser QA at approximately 390px and 1440px with URL-state, filtering, pagination, state, navigation, console, and layout checks.

## Implementation Result

- `GET /api/requests` now validates and forwards normalized page, limit, search, status, Needs Attention, and sort parameters while deriving scope and locked-detail access only from the authenticated account.
- The request query applies account/organization scope, deleted-row exclusion, search, filters, deterministic sorting, filtered totals, and page clamping before pagination.
- Unpaid search cannot match hidden address or seller details on locked rows.
- The workspace stores `q`, `status`, `sort`, and `page` in the URL, debounces search, cancels stale requests, and canonicalizes an out-of-range page.
- A compact toolbar, result summary, pagination, navigable addresses, accessible loading/error/no-data/zero-result states, and responsive request cards replace the previous client-filtered list.
- Desktop and mobile reuse existing safe actions by status: Continue/View, seller-link copy, reminder when eligible, Review, Open packet, Download PDF, and submitted-sheet edit.
- The existing Needs Attention definition remains `sent` for more than three days. The narrower future PRD concept still has no schema-backed request flag.
- Draft Continue opens the existing request detail/configuration surface because no general draft-resume editor exists.

## Validation Results

- Combined focused Vitest: passed, 3 files and 16 tests.
- Final focused workspace Vitest after browser-found styling fix: passed, 1 file and 5 tests.
- Full Vitest: passed, 88 files and 475 tests.
- Task-scoped ESLint: passed.
- TypeScript: `npm exec tsc -- --noEmit` passed.
- Production build: `npm run build` passed.
- `git diff --check` passed; Git only reported existing LF-to-CRLF working-copy notices.
- Full `npm run lint` remains blocked by pre-existing unrelated `no-explicit-any` errors in invite/admin/banner/update-test files; no changed Requests file is implicated.
- Authenticated read-only browser QA passed at 1440px and emulated 390px: page 2 showed records 21–22 of 22, Needs Attention produced a correct zero-result state, created-oldest sorting changed the URL and result order, back/forward restored URL state, mobile cards exposed the expected contextual actions, no horizontal overflow was present, and the browser console had no warnings or errors.
- Browser QA did not click reminders, downloads, packet links, edit links, copy actions, or any other mutation. The temporary localhost authentication cookies and viewport override were removed after QA.

## Acceptance Criteria

- Every request in the authenticated account/organization scope is reachable through pagination.
- Search finds matching requests outside the first page without exposing another account or hidden locked-row details.
- Status, Needs Attention, and supported sorting operate in the database before pagination.
- Totals, canonical pages, page counts, and zero-result states remain correct after filtering.
- URL state survives refresh and browser back/forward navigation.
- The toolbar is compact and visually part of the request list.
- Property addresses and rows have clear detail navigation.
- Desktop and mobile expose the important safe status-specific actions.
- Loading, error, no-data, and filtered-zero states are accessible and intentional.
- Focused tests, lint, type-check, production build, and responsive browser QA pass, or any pre-existing failure is clearly isolated and documented.
- No unrelated work is reverted or reformatted, and no live mutation or production action is performed.

## Handoff Notes

OpenAI Codex completed the implementation inline on `main` without committing. Preserve the pre-existing modified files `app/i/[slug]/page.tsx`, `app/packet/[token]/page.tsx`, `app/s/[token]/page.tsx`, and `components/seller-form/SellerLayout.tsx`, plus the untracked audit scripts and reports.

No required work remains. The next action is user review of the uncommitted Requests diff. Optional future product work would require a deliberate schema/product decision before replacing the retained three-day Needs Attention rule.
