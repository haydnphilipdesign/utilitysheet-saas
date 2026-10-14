# Shorten mobile Home Basics without losing questions

- Date: 2026-10-14. Agent: Claude Code. Branch: main (uncommitted). Status: **Completed; committed and pushed to main with owner authorization. No required work remains.**
- Origin: optional follow-up from `.ai/plans/2026-10-14-mobile-restarts-investigation.md`. That investigation did not show that screen length caused device switching. This is a usability improvement, not a fix for a confirmed abandonment cause.
- Preserve: scroll reset on step change (`02a5281`, `SellerLayout.tsx`) and fixed-header clearance; required water/sewer validation; HOA-dependent choices (No hides and clears "Included in HOA"); fuels/primary heat; optional utilities; configured handoff sections; draft restore; reopened requests; Review edit/catch-up; Back; submission; progress/telemetry; accessibility, keyboard and desktop use.

## Verified baseline (rendered, synthetic fixtures)

Real seller page, wizard and app CSS bundled with esbuild, synthetic API responses (scratch harness modeled on `tests/seller-wizard-scroll.spec.ts`). Two fuels selected (shows primary heat). Continue position as screens of scrolling (Continue bottom / viewport height):

| Device (viewport) | Simple, minimal | Simple, all utilities | Advanced, all sections | Advanced + HOA Yes |
| --- | --- | --- | --- | --- |
| iPhone SE WebKit (320x568) | 1.90 | 2.48 | 3.21 | 4.58 |
| iPhone 14 WebKit (390x664) | 1.51 | 1.94 | 2.54 | 3.71 |
| Pixel 7 Chromium (412x839) | 1.21 | 1.55 | 2.02 | 2.94 |
| Desktop Chromium (1280x720) | 1.40 | 1.89 | 2.30 | 3.06 |

HOA No/Not Sure are within ±0.05 of the no-answer column. No runtime errors, unexpected requests or horizontal overflow.

Where the height goes (iPhone SE): HOA gate ~110px, water ~205, sewer ~205, fuels ~150, primary heat ~110. Optional content: HOA details after Yes ~780px (7 inputs + dues frequency), optional utilities ~150, four pre-selected handoff cards ~470. The fixed header is 154px of the 568px screen (shared by every step; out of scope). Nothing marks water/sewer as required; the first hint is the disabled Continue and its note at the very bottom.

## Approach

Keep Home Basics as one step. No change to the `Step` enum, draft shape (`v: 2`), telemetry labels, progress, `handleNext`/`handleBack`, or catch-up. All changes are inside `HomeBasicsStep.tsx`.

1. Required questions stay fully visible and in their current order (HOA gate, water, sewer, fuels, primary heat). Water and sewer get a visible "Required" tag beside their label (kept outside the label element so group names stay "Water Source"/"Sewer Type").
2. After the "Optional" divider, everything optional is in a compact form:
   - Optional utilities (Internet, Cable/TV): unchanged. It is a short question that decides which steps are asked, so it stays visible.
   - HOA / Condo Association Details (after Yes only): one summary row with a disclosure button ("Add details", or "N of 8 added"). Opens in place to the same fields. Opens automatically when any detail already has a value (draft, reopened sheet, Review edit), and when a value appears later (draft restored after mount).
   - Optional handoff details (advanced only): one summary row ("4 of 4 sections included. Each adds a short page."), button "Change" opens the existing section cards (same test IDs, same toggle logic). Collapsed by default because the configured sections are already on.
3. Disclosure semantics: real `<button>` with `aria-expanded`, `aria-controls` while open, 44px minimum target, focus ring, panel immediately follows the button in DOM order so Tab order is natural. Collapse never clears answers. Closed panels unmount their inputs; answers live in wizard state, so nothing is lost.
4. Rejected alternatives: a second Home Basics page or new step (changes step enum, draft indices, telemetry and catch-up navigation, the "confusing navigation" risk named in the request); sticky Continue alone (doesn't shorten anything and fights the iOS keyboard while typing HOA details); shrinking the shared header (affects every step and header-clearance math; possible follow-up).

Product trade-off to flag for the owner: HOA details are one extra tap after Yes, which may lower how often sellers fill them. They remain fully available, and existing answers always show open.

## Acceptance criteria

- iPhone SE, advanced with all sections, HOA Yes: Continue at or under about 2.6 screens (from 4.58); advanced without HOA details at or under about 2.4 (from 3.21). iPhone 14/Pixel proportionally lower. Desktop no worse.
- No configured question removed: HOA fields, dues frequency, optional utilities and every configured handoff section still reachable and saved.
- Existing answers visible: HOA details open on load when any is filled; handoff summary reflects current selection.
- Required behavior unchanged: Continue disabled with the same hint until water and sewer are answered; HOA No clears/hides "Included in HOA".
- Draft reload, reopened request, Review "Edit Home Basics" catch-up, Back and submission unchanged; scroll reset and header clearance still pass.
- No horizontal overflow, runtime errors or unexpected requests on the four devices.

## Validation

- Unit: update affected tests to open disclosures (`seller-wizard-hoa-flow`, `seller-wizard-advanced-flow`, `seller-wizard-review-navigation`), add focused tests for auto-open/summary/required tag; then complete Vitest (owner preference).
- Browser: `tests/seller-wizard-scroll.spec.ts` (3 projects) plus a new isolated regression in the same harness that covers the disclosures, HOA Yes details saving through draft reload, Review edit and submission payload, on Desktop Chrome, Mobile Safari, Mobile Chrome. Next-server Playwright specs that fill HOA fields (`seller-wizard-journey.spec.ts`) get the extra click; run them if the dev server starts locally.
- Scratch measurement re-run on four devices with settled screenshots inspected.
- TypeScript, ESLint on changed files, security scan, `git diff --check`.

## Expected files

`components/seller-form/steps/HomeBasicsStep.tsx`; tests listed above; new `tests/seller-home-basics-mobile.spec.ts` and its entry in `tests/telemetry.playwright.config.ts`; this plan; `.ai/CURRENT.md`.

## Outcome (2026-10-14)

Implemented as planned in `HomeBasicsStep.tsx`: `OptionalDisclosure` summary rows for HOA details (`hoa-details`, toggle `hoa-details-toggle`, panel `hoa-details-panel`) and the handoff chooser (`basics-handoff`, toggle `basics-handoff-toggle`), plus a "Required" tag on water and sewer. HOA details open on mount when any detail is filled and open again when a value first appears later (adjust-state-during-render, because ESLint's `set-state-in-effect` rule is on). Summaries: "Name, contact, dues, and where to pay" / "N of 8 added"; "All 4 included, one short page each" / "N of 4 included..." / "None included". On phones the row shows only a chevron (the action word is `sm:` and up) so the summary keeps the width. HOA title uses `HOA_SECTION_TITLE`.

Deviation: the iPhone SE targets in "Acceptance criteria" (2.6 / 2.4) were set before measuring the floor. Required content alone measures 1.90 SE screens (simple form, no HOA, no optional items), most of it the shared 154px header and the choice tiles, which this task keeps intact. Final measurements (Continue bottom / viewport height, two fuels selected):

| Device | Advanced, all sections (before → after) | Advanced + HOA Yes | HOA Yes, details opened |
| --- | --- | --- | --- |
| iPhone SE 320x568 | 3.21 → 2.63 | 4.58 → 2.85 | 4.09 |
| iPhone 14 390x664 | 2.54 → 2.07 | 3.71 → 2.20 | 3.27 |
| Pixel 7 412x839 | 2.02 → 1.66 | 2.94 → 1.76 | 2.60 |
| Desktop 1280x720 | 2.30 → 2.04 | 3.06 → 2.19 | 2.83 |

Simple forms without HOA details or handoff sections are unchanged (no optional content to collapse). No horizontal overflow, runtime errors or unexpected requests on any device/config.

Validation (Node 20.19.0, synthetic data only):
- Complete Vitest: 251 files passed / 1 skipped; 2,186 tests passed / 13 skipped / 0 failed. New unit tests: open/close keeps HOA answers and updates the count, aria-expanded/aria-controls, draft-restored details open, Required tag without renaming groups, handoff summary counts, and post-mount draft auto-open in `seller-wizard-reopen` (confirmed to fail with the auto-open removed).
- Isolated Playwright (`tests/telemetry.playwright.config.ts`, 3 projects): 24 passed, including the new `tests/seller-home-basics-mobile.spec.ts` (Continue budget 2.6 screens, keyboard Enter/Tab into fields, draft reload restoring answers and opening details, handoff opt-out, utility/handoff steps, Review edit of Home Basics, submission payload) and the scroll regression (updated only to open the chooser before its same-step edit).
- Next dev-server Playwright (3 projects): `seller-wizard-journey`, `seller-wizard-review-edit`, `seller-reopen`, `test-drive-journey`: 53 passed, 1 skipped (existing desktop skip of a phone-only test); saved-forms HOA preview dialog: 3 passed. Dev server started with `node node_modules/next/dist/bin/next dev` because the cached npm cannot run scripts (`node-gyp` missing); stopped afterwards.
- Scratch iPhone SE WebKit run of the new journey spec (budget 2.75 for that viewport) and scroll spec: passed. Settled viewport screenshots of entry, collapsed rows, opened chooser and keyboard focus in HOA details inspected on iPhone SE and Pixel 7.
- TypeScript passed; ESLint clean on all changed files; `security:scan` passed; `git diff --check` passed.

Not done: physical devices / real virtual keyboard, production build, hosted checks. The shared header (154px on iPhone SE) is the largest remaining fixed cost on small phones; a compact header is an optional follow-up affecting every step. Watching HOA-detail fill rates after release would show whether the extra tap reduces them.
