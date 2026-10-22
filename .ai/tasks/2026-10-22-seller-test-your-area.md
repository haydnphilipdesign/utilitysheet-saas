---
status: ready
owner: claude
updated: 2026-10-22 15:10
scope: lib/test-drive, app/api/test-drive, lib/neon/queries/requests.ts, lib/validation/schemas.ts, components/test-drive, components/dashboard/first-run-guide.tsx, lib/analytics/events.ts, tests/unit, tests/test-drive-journey.spec.ts
---
# Seller test in the agent's own area (new user experience, Phase 5)

## Goal

Let a new user run the seller test in their own area so the provider
suggestions are ones they recognize. Plan:
[new user experience, Phase 5](../plans/2026-10-22-new-user-experience.md).

Decisions (user, 2026-10-22, "go with your recommendations for everything"):

- Ask for an area (city, state, optional ZIP), never a street address. The
  test address becomes `[TEST] 123 Maple Street, <area>`.
- Optional: blank keeps the fictional Anytown, PA address.
- Up to 3 seller tests per account in total; accounts that already tested can
  run it again in their area within that cap.
- Live suggestion calls allowed for checking.

## Progress

Implemented (uncommitted on `new-user-experience`):

- `lib/test-drive/area.ts` (new, client-safe): `testDriveAddressForArea`
  validates the typed area (letters, digits, space . , ' - only, max 60, a
  city and state must parse) and refuses anything with digits other than a
  trailing ZIP, so a street address is never stored. Keeps the user's text
  rather than the parser's title-cased parts (the parser mangles some names).
- `lib/test-drive/service.ts`: `TEST_DRIVE_LIMIT = 3`; state for `ready` and
  `completed` carries `canStartAnother`.
- `lib/neon/queries/requests.ts`: `getOrCreateTestDriveRequest` takes
  `startAnother` and `limit`; inserts when the account has no test, or when
  asked and under the limit (same advisory lock); returns the inserted row or
  the latest test, plus `testCount`. `getTestDriveRequestState` reads the
  latest test (was the first) and the count. No schema change.
- `app/api/test-drive/route.ts`: optional JSON body `{ area }` (Zod
  `testDriveStartBodySchema`, unknown keys dropped, 2 KB limit). 400
  `invalid_area`, 409 `test_limit`. Area used for the request, structured
  address and invitation email. `request_created` event gets
  `test_area: custom | sample` (no area text).
- Hook `useTestDrive`: `start(area?)`, client-side check, `areaError` for
  `invalid_area` / `test_limit`; analytics `test_drive_started.area` is
  `sample | custom` only.
- UI: `components/test-drive/TestDriveAreaForm.tsx` (new). First run: optional
  "Your area" field above Start seller test. Ready/completed: "Try it in
  another area" while `canStartAnother`. Used in the first-run guide and
  `TestDriveCard`.
- Live check (getSuggestionsFresh, production model gemini-3.5-flash-lite,
  thinking low, no telemetry rows): Anytown, PA 18301 gets East Stroudsburg
  providers; Austin, TX 78704 gets Austin Energy, Texas Gas Service, Austin
  Water, Spectrum. About $0.01 per location for all 9 categories, uncached.
- Account-level demo queries (admin funnel, outreach, admin telemetry) use
  DISTINCT/EXISTS/MIN, so several demo requests per account are safe.
- Known parser quirk (pre-existing, not fixed): "St. Louis" parses as city
  "Louis" (`lib/address/location-parser.ts`). With a ZIP the AI still places it.

## Environment

Read-only live database aggregates and a few live Gemini calls (scratchpad
scripts). `next dev` on 127.0.0.1:3000 with synthetic env for Playwright
(stopped). No writes to any database.

## Validation

- `node node_modules/typescript/bin/tsc --noEmit`: pass.
- ESLint on all changed files: pass.
- `node node_modules/vitest/vitest.mjs run`: 267 files passed, 1 skipped;
  2358 tests passed, 13 skipped (before the placeholder copy tweak; the two
  affected files were rerun after it: 22 passed).
- `playwright test tests/test-drive-journey.spec.ts` (Desktop Chrome, Mobile
  Safari, Mobile Chrome): 12 passed, including the new area test. Screenshots
  in the session scratchpad.
- `node scripts/security/scan-artifacts.mjs`: passed. `git diff --check`: clean.

## Next

User review, then commit when asked. Optional: fix the "St." city parsing.
