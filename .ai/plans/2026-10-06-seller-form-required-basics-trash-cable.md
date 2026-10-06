# Seller form: required water and sewer, trash always asked, "Same as Internet"

- Status: completed 2026-10-06 (Claude Opus). Uncommitted; no required work remains. Decision record: `.ai/decisions/2026-10-06-required-basics-trash-always-asked-same-as-internet.md`.
- Source of decisions: `.ai/plans/2026-10-06-ux-form-logic-review.md`, "Next seller-form change: owner decisions (2026-10-06)". Evidence: "Findings 10 and 11: data check" in the same file.
- Must not break: `.ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md` (editing sessions, drafts tied to a session, prefill for reopened requests).
- Not authorized: migrations, production database access, real email, commit, push, deploy.

## Verified against the code (2026-10-06, main at bd94750, clean worktree)

- `sellerSubmissionBodySchema` requires `water_source` and `sewer_type` and is `passthrough`. The seller route stores a provider row for every submitted utility that is requested and not `hidden`; a hidden one stores no row. So an unanswered state can live only in the wizard, and "no trash service" can be sent as a hidden trash entry with no server change.
- Trash visibility is decided in the `visibleUtilities` memo in `SellerWizard.tsx` and mirrored by `OPTIONAL_UTILITY_CATEGORIES` and the conditions in `lib/packet/seller-questions.ts`. `lib/seller-form/prefill.ts` also uses that list.
- `reconcileHoaUtilityChoices` resets a conflicting choice to `'not_sure'` and tracks it in `hoaUtilityReselection`; Home Basics uses that list for the explanation, the pressed state and the Continue block.
- `sellerPrefillToWizardState` maps an empty or invalid stored water or sewer value to `'not_sure'`.
- A reopened request starts on Review, or on Home Basics when an HOA conflict is pending. Drafts are merged over the initial state, so missing keys take the initial value.
- The demo (`app/demo/page.tsx`), the saved-form preview (`components/seller-forms/FormEditor.tsx`) and the test drive (`app/s/[token]`) all render `SellerWizard`.
- `lib/demo-pdf-generator.tsx` lists any wizard utility that has a name and an entry mode, ignoring `hidden`.

## Design

1. Water and sewer: `WizardState.water_source` and `sewer_type` become nullable and start `null`. Home Basics disables Continue and states the reason at the button until both are set. An HOA conflict now clears the choice to `null`; `hoaUtilityReselection` is kept only as the draft-only marker that drives the explanation, and is pruned automatically once the field is answered. Prefill maps an empty stored value to `null`, and a reopened sheet with an unanswered basic opens on Home Basics, then returns to Review after any newly needed provider step. A draft positioned past Home Basics with an unanswered basic returns to Home Basics. Old drafts holding `'not_sure'` load unchanged, except that a field listed in an old draft's `hoaUtilityReselection` (a reset, never an answer) loads as unanswered.
2. Trash: the step appears whenever the request includes trash. New wizard-only flag `no_trash_service`; when set, the trash entry is marked hidden (so no row is stored), its provider answer is cleared, and the pickup questions are skipped. Choosing any provider answer clears the flag. The flag is not submitted. `OPTIONAL_UTILITY_CATEGORIES` becomes Internet and Cable/TV.
   - Reopened sheet with trash requested and no trash row: the trash step is asked first, then Review (owner decision 2026-10-06, replacing the first build, which prefilled "No trash service").
   - Old draft: trash was never asked unless ticked. If the restored position is past the trash step and it has no answer, the seller is taken to the trash step (returning to Review if they were there). An old draft's answer for an unticked trash box is dropped so it is asked afresh.
3. Cable/TV: when Internet has a named, visible provider, the first choice is "Same as Internet: <name>". It stores the name as a typed entry (`free_text`) with no contact details or directory id, so contact lookup runs for cable in its own right. Never preselected.
4. Inventory text in `seller-questions.ts` updated to match (required basics, trash condition and no-service answer, optional tick boxes, cable offer).

No change to stored data, the route, the schema, the packet, the PDF or the coordinator editor.

## Files

`components/seller-form/SellerWizard.tsx`, `steps/HomeBasicsStep.tsx`, `steps/UtilityStep.tsx`, `steps/ReviewStep.tsx`, `lib/seller-form/prefill.ts`, `lib/packet/seller-questions.ts`, `lib/analytics/events.ts` (one skip reason), unit tests under `tests/unit/seller-wizard-*`, `utility-step-meter-flow`, `seller-questions-inventory`, and the seller Playwright specs.

## Acceptance

- Continue on Home Basics is disabled with a visible reason until water and sewer are answered; "Not Sure" is accepted; HOA stays skippable.
- The HOA conflict explanation still appears and the cleared choice must be replaced.
- Trash is asked whenever requested; "I'm not sure" still stores an unknown row; "No trash service at this home" stores no trash row and skips pickup questions.
- Cable/TV offers "Same as Internet" only when Internet has a name, and copies the name only.
- Reopened prefill, old drafts, preview, demo and test drive load and behave as described above.
- Inventory matches the form.

## Validation

Focused Vitest for the wizard, steps, prefill and inventory; full Vitest; `tsc --noEmit`; ESLint on changed files; mocked seller Playwright specs on Desktop Chrome and Mobile Chrome.

## Outcome (2026-10-06)

Built as designed. Deviations and additions:

- A reopened sheet sent to Home Basics first (empty water or sewer, or an HOA conflict) now continues to Review afterwards instead of walking every provider step again.
- `hoaUtilityReselection` was kept, but only as the reason shown to the seller. Required-ness, the pressed state and navigation all come from the unanswered value.
- "No trash service" clears the trash provider answer in the wizard, because the demo PDF lists any named utility regardless of `hidden`.
- Analytics: `seller_utility_skipped` gained the reason `no_service` (`lib/analytics/events.ts`).
- No change was needed to the schema, seller route, storage, packet, PDF or coordinator editor.

Results (Node 22.22.2; CI uses 20):

- Full Vitest: 197 files passed, 1 skipped; 1332 tests passed, 8 skipped. New file `tests/unit/seller-wizard-required-basics-trash-cable.test.tsx` (25 tests).
- `tsc --noEmit` clean. ESLint on changed files: 0 errors, 8 pre-existing warnings (6 hook warnings in `SellerWizard.tsx`, 2 img warnings in `SellerLayout.tsx`).
- Playwright, mocked APIs, Desktop Chrome and Mobile Chrome (seller flow, journey, review-edit, reopen, saved-form preview, intake, test drive and demo): 57 passed, 1 skipped by design. Four new browser tests.
- Phone-size screenshots of Home Basics, the trash step, the Cable/TV step and Review were reviewed by eye.

Not verified: Mobile Safari, a real phone, screen readers, the hosted database, `next build`, PDF output (unchanged code).
