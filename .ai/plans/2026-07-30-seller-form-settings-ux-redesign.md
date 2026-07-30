# Plan: Seller Form Settings UX Redesign

## Status

Completed

## Objective

Make reusable seller-form settings easier to understand, scan, customize, and
save without changing the underlying request or packet behavior.

## Background

Customer feedback showed that per-question Advanced controls were not
discoverable even though they already existed. The current Seller Form tab is
long, places seller questions under "Completed packet defaults," opens every
enabled module by default, uses a passive comparison plus a separate mode
select, and presents two save buttons for one conceptual set of defaults.

## Verified Facts

- The intake-link API accepts branding, utility categories, packet mode,
  Advanced modules, and field exclusions in one POST request.
- Form availability is an immediate independent update.
- The custom form URL has a separate Pro/Teams update and save action.
- The electric-meter preference currently auto-saves through account
  notification preferences.
- Advanced configuration is shared between Settings and new-request creation.
- Existing field additions from
  `.ai/plans/2026-07-30-advanced-packet-requested-fields.md` are complete,
  validated, and still uncommitted/unpublished.

## Assumptions

- A refined, compact utility-product aesthetic should preserve the existing
  design system rather than introduce a new visual language.
- The Settings view should initially collapse all module details and permit one
  expanded module at a time.
- The shared configurator redesign should also improve new-request creation.

## In Scope

- Reorganize the Seller Form tab into access/sharing, seller questions, and
  completed-packet presentation.
- Replace the packet-mode select with selectable Simple/Advanced cards.
- Simplify module rows and make them single-open, collapsed accordions.
- Replace large included/excluded field cards with readable checkbox rows.
- Consolidate seller-form and packet defaults into one save request and sticky
  save/reset bar.
- Add a Preview form action.
- Increase question and supporting-text readability.
- Update focused tests and durable coordination files.

## Out of Scope

- New APIs, schema changes, arbitrary custom questions, packet rendering
  changes, or changes to capability-link security.
- Combining immediate form availability, custom URL, or notification
  preference persistence into the intake-link transaction.
- Commit, push, deployment, or production data changes.

## Proposed Approach

1. Refactor `AdvancedModuleConfigurator` to use one controlled internal
   disclosure at a time, switches for modules, and checkbox rows for questions.
2. Replace the mode select in Settings with accessible radio-card buttons.
3. Recompose the Seller Form tab so mode and question controls live under
   "What sellers are asked," while Branding Profile lives under "Completed
   packet."
4. Replace the two default-save handlers/buttons with one combined API payload,
   plus a sticky dirty/saved state and reset action.
5. Add a Preview form action beside the reusable link controls.
6. Update tests for hierarchy, accessible controls, combined save payload,
   collapsed behavior, and preview link.

## Files or Areas Expected to Change

- `app/dashboard/settings/page.tsx`
- `components/advanced-modules/AdvancedModuleConfigurator.tsx`
- `tests/unit/settings-reusable-link-mode.test.tsx`
- New focused configurator test if warranted
- `.ai/CURRENT.md`
- This plan

## Data, API, Schema, or External-State Impact

- No API contract or database schema change.
- One combined intake-link POST replaces two separate defaults POSTs.
- No external state is changed during implementation or validation.

## Risks and Edge Cases

- Free users must retain readable, disabled Advanced controls.
- A module with zero included questions must still block save.
- Combined save responses must preserve every draft value in local state.
- Reset must restore canonical module ordering and normalized exclusions.
- Disclosure and checkbox controls must remain keyboard accessible.
- Shared configurator changes also affect the new-request flow.

## Validation Plan

- Focused Settings and Advanced configurator/wizard tests.
- Full Vitest suite.
- TypeScript and focused ESLint.
- Production build.
- Security scan and `git diff --check`.

## Validation Results

- Redesign-focused Vitest: 3 files / 13 tests passed.
- Focused Settings Vitest after reset/checkbox coverage: 1 file / 3 tests
  passed.
- Full Vitest: 134 files / 672 tests passed.
- `npm exec tsc -- --noEmit` passed.
- Focused ESLint passed for the Settings page, shared configurator, analytics
  event map, and updated test.
- `npm run build` passed.
- `npm run security:scan` passed.
- `git diff --check` passed with line-ending warnings only.

## Acceptance Criteria

- The page hierarchy matches the user’s mental model.
- Simple/Advanced choice is made directly on descriptive cards.
- Modules are collapsed initially and only one is expanded at a time.
- Questions are scannable checkbox rows with readable type.
- A single save action persists all non-immediate seller-form defaults.
- Dirty, saved, invalid, and reset states are clear.
- Users can preview their reusable seller form from Settings.
- Existing settings and new-request behavior remain compatible.

## Handoff Notes

Implementation and validation are complete locally. No commit, push, or
deployment was authorized or performed. Preserve the completed Advanced field
work and do not add customer email exports to source control.
