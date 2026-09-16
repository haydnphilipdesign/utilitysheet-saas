# Current task: first-use guide and seller test-drive polish

- Date: 2026-09-16. Agent: Claude Code. Branch: main (base fa4f111). Status: **Completed**, uncommitted in the worktree. No required work remains.
- Plan: `.ai/plans/2026-09-16-first-use-and-test-drive-polish.md` (Completed; it holds full outcome, validation, limitations, and follow-ups).
- Authorization used: local implementation and tests only. No commit, push, deploy, migration, production data change, or real email.

## What changed

- `components/test-drive/TestDriveCard.tsx` is now the shared "See how UtilitySheet works" card, with two secondary panels:
  - Sample sheet: new `SampleSheetDialog.tsx` reuses `UtilitySheetPdfPreview` and `POST /api/branding/test-pdf`. No request is created. The label says whether saved or placeholder branding is shown.
  - Seller test: one-click start with same-tab navigation, resume link, completed output links, and a next step for the real link.
  - On the dashboard, the card is hidden for ineligible accounts and while loading.
- Seller flow (test drive only): "Test mode" banner with an "Exit test" link, a test welcome variant, and the save-link affordance hidden. New `steps/TestDriveSuccess.tsx` gets the output links from `GET /api/test-drive` and describes delivery only when it is recorded. `SuccessStep` now takes `isTestDrive`.
- Real seller and `/demo` success screens are unchanged. Welcome copy now says progress saves "in this browser", and `/demo` no longer claims saving.
- Copy: removed "production PDF" and "Test UtilitySheet" from UI, API errors, the packet banner (now with a dashboard link), and the test completion email body.
- Onboarding: hero copy explains the output, and the title is now an `h1`.
- Analytics (typed, no identifiers): `sample_sheet_viewed`, `sample_sheet_pdf_downloaded`, `test_drive_output_opened`, `test_drive_dashboard_returned`. Test-drive locations are used for the retry and help-contact events.
- `UtilitySheetPdfPreview` gained optional `label`/`frameLabel` props (defaults unchanged).
- Tests: updated `tests/unit/test-drive-card.test.tsx`; new `tests/unit/sample-sheet-dialog.test.tsx`, `tests/unit/seller-test-drive-success.test.tsx`, and `tests/test-drive-journey.spec.ts`.

## Validation

- Full Vitest passed (155 files). `tsc` passed. Changed-file ESLint: 0 errors (12 pre-existing warnings).
- Playwright test-drive journey passed 9/9 and the real seller journey 6/6, on Desktop Chrome, Mobile Safari, and Mobile Chrome, with all APIs mocked.
- `security:scan` passed; `git diff --check` clean.
- Limitations: `/dashboard` was not browser-verified (server auth). The live DB/email path was intentionally not exercised.

## Next action

The owner reviews the diff (and screenshots from the session) and decides whether to commit and deploy. Optional follow-ups are listed in the plan. No concurrent-editing warnings remain.
