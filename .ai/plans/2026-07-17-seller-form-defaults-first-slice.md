# Seller Form Defaults First Slice Implementation Plan

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-07-17
- Source: Completed Settings and Branding Profile configurability audit plus the user-approved implementation scope.
- Authorization constraints: Do not commit, push, deploy, run a live migration, or modify production data.

## Goal

Turn the current Settings “Seller Link” area into a coherent “Seller Form Defaults” experience where an authenticated user can pause/reactivate the reusable form, choose its Branding Profile and utility categories, and preserve the existing packet-mode/module behavior.

## Verified repository facts

- Settings is implemented in `app/dashboard/settings/page.tsx`; the stable tab key is `link` and should remain unchanged.
- The reusable form is one `intake_links` row per account and already has `is_active`, packet-mode defaults, advanced modules, and advanced-module exclusions.
- Both `GET /api/intake/[slug]` and `POST /api/intake/[slug]/start` currently return a generic 404 for missing or inactive links.
- Reusable-form starts currently choose the active workspace default Branding Profile and all `UTILITY_CATEGORY_KEYS`.
- Branding Profiles are scoped to either the active organization or the account when there is no active organization.
- “Collect electric meter number” is persisted in account notification preferences and consumed by the seller request route; this slice will move its presentation without changing that established persistence behavior.
- Existing uncommitted changes are the completed audit handoff and audit plan. They are intentional and must be preserved.

## Architecture

Add `default_brand_profile_id` and `default_utility_categories` to `intake_links`. A null Branding Profile ID continues to mean “use the current workspace default,” preserving legacy effective behavior; utility categories default to the complete canonical category list. The authenticated intake-link API will validate all updates with Zod, enforce account/organization profile scope, and expose only the profile summaries needed by Settings. Public metadata and start routes will normalize saved categories, resolve the selected profile within scope with fallback to the workspace default, and continue returning a private 404 for inactive links.

## Expected files

- Create `migrations-intake-link-seller-form-defaults.sql`: additive columns and safe defaults only.
- Modify `schema.sql`: mirror the final `intake_links` shape.
- Modify `types/index.ts`: reuse/extend existing UtilityCategory typing where needed.
- Modify `lib/validation/schemas.ts`: add the authenticated intake-link update schema.
- Modify `lib/neon/queries/intake-links.ts`: type/normalize/persist seller-form defaults.
- Modify `lib/neon/queries/brand-profiles.ts`: add scoped selected-profile lookup with default fallback.
- Modify `lib/neon/queries/index.ts`: export new query helpers.
- Modify `app/api/intake-link/route.ts`: return/update status, Branding Profile, and category defaults while preserving packet/module gating.
- Modify `app/api/intake/[slug]/route.ts`: use saved public presentation defaults and preserve generic inactive-link failure.
- Modify `app/api/intake/[slug]/start/route.ts`: copy saved defaults into newly created requests.
- Modify `app/dashboard/settings/page.tsx`: rename the visible Settings concept and create clear access, form-field/presentation, and packet sections.
- Modify focused unit tests under `tests/unit/`; add a public metadata route test if no existing seam covers it.

## Phase 1: Contract and persistence

- [x] Add failing route/query tests for active status, scoped Branding Profile selection, utility-category validation, legacy fallbacks, and inactive public behavior.
- [x] Add the focused migration and update `schema.sql`.
- [x] Add normalizers, scoped profile resolution, intake-link persistence, and barrel exports.
- [x] Add the Zod update schema and integrate it into the authenticated API without weakening existing slug or paid packet/module checks.

Acceptance:

- Existing rows resolve to the workspace default Branding Profile and every canonical utility category.
- A profile outside the active account/organization scope cannot be saved or consumed.
- An empty, unknown, or malformed category set cannot be saved; malformed stored data safely falls back to all categories.
- Active-status updates are available without changing paid packet/module entitlements.

## Phase 2: Public data flow

- [x] Update public metadata to return the selected public Branding Profile fields and saved categories.
- [x] Update public start creation and event logging to use the saved Branding Profile and categories.
- [x] Keep packet-mode and advanced-module paid gating unchanged.
- [x] Verify inactive links return the same generic 404 response on both metadata and start paths without account/profile disclosure.

Acceptance:

- New reusable-form requests receive the saved Branding Profile ID and categories.
- Free accounts still fall back to Simple mode when an old row contains Advanced mode.
- Existing per-request seller links and submitted request behavior are unchanged.

## Phase 3: Settings experience

- [x] Keep the `link` tab key and `/api/intake-link` URL stable while renaming visible copy to “Seller Form” / “Seller Form Defaults.”
- [x] Add an immediately persisted active/paused control with explicit state and consequence copy.
- [x] Add a Branding Profile selector with a “workspace default” option and scoped profile choices.
- [x] Add accessible category controls requiring at least one category and a single save action for form defaults.
- [x] Move the meter-number switch into a labeled seller-form fields section while preserving its existing account-preference persistence.
- [x] Visually separate form access/default fields from completed packet mode/modules.

Acceptance:

- Desktop and narrow layouts clearly communicate which controls affect the reusable seller form.
- Paused state is visible and reversible; the stable URL remains available for later reactivation.
- Branding/category save state and validation are clear and accessible.
- Packet/module behavior and plan badges remain intact.

## Phase 4: Validation

- [x] Run focused Vitest files first:
  - `npm test -- tests/unit/intake-link-route.test.ts tests/unit/intake-start-route.test.ts tests/unit/settings-reusable-link-mode.test.tsx tests/unit/settings-notification-preferences.test.tsx`
  - Include any new public metadata/query-focused test file in the same run.
- [x] Run ESLint only on changed TypeScript/TSX files.
- [x] Run `npm exec tsc -- --noEmit`.
- [x] Run `npm run build` because the change crosses schema, server routes, and client UI.
- [x] Perform authenticated Chrome QA on Settings at desktop and narrow/mobile widths.
- [x] Perform public reusable-form QA for active rendering at desktop and mobile widths; verify paused-link failure through focused route tests because the hosted schema was intentionally not migrated.
- [x] Run `git diff --check`.

Validation outcome:

- Combined focused Vitest run passed: 6 files and 28 tests.
- Changed-file ESLint, TypeScript, production build, and `git diff --check` passed.
- Authenticated Settings and the active public reusable form passed desktop and 390px-wide Chrome QA without horizontal overflow or console errors.
- The configured database was inspected read-only and does not yet contain the new columns. No save/pause action was sent from the browser, no migration was run, and no production data was modified.

## Risks and safeguards

- The migration is additive and must not be run against a live database without separate authorization.
- Selected Branding Profiles must be resolved with account/organization scope; never use the existing unscoped `getBrandProfile(id)` for this path.
- Public errors must remain generic and must not reveal whether the account, profile, or inactive row exists.
- The existing cookie resume path should continue returning the already-created draft; defaults apply only when a new request is created.
- No multiple links, saved presets, taxonomy customization, packet redesign, or unrelated Settings cleanup is in scope.

## Final integration review (2026-07-21)

- Stable `/api/intake-link`, `/i/[slug]`, and per-request capability URLs remain unchanged. Defaults still
  apply only when a new reusable-form request is created.
- Public start now uses only the live membership-derived active workspace; a stale account pointer cannot
  place a new request into a workspace the account has left. Scoped Branding Profile/category resolution,
  paused-link generic 404 behavior, plan fallback, and existing-link compatibility remain intact.
