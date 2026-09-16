# Plan: First-use guide and seller test-drive polish

## Status

Completed (2026-09-16, Claude Code). Uncommitted in the worktree. No commit, push, deploy, migration, production data change, or real email was performed.

## Objective

A new agent or TC should quickly understand what UtilitySheet produces, what their seller experiences, and how to use it on a real file, without having to complete a pretend transaction. The seller test becomes a clearly optional, coherent journey with a purpose-built completion screen.

## Verified starting state (main @ fa4f111)

- Sign-up lands on `/dashboard`. `/onboarding` is optional and client-rendered. `/dashboard` is server-auth gated in `app/dashboard/layout.tsx`.
- `components/test-drive/TestDriveCard.tsx` renders on the dashboard (always, after the reusable-link card) and on onboarding (below the hero). Its states are loading, error, eligible, ready, completed, and ineligible. Ineligible shows a dead-end message.
- Starting takes two clicks: POST `/api/test-drive`, then a separate "Open or resume" `window.open` in a new tab.
- Copy includes "production PDF" in the card and the test completion email (`lib/email/email-service.ts`).
- `/s/[token]` passes `isTestDrive` to `SellerWizard` and `SellerLayout` (banner). `SuccessStep` receives only `isDemo`, so test users see "Your agent has been notified... You can safely close this page". The submitting interstitial says "Sending your info to your agent". The "Email me this link" affordance and success "Want a copy?" form are shown for test drives.
- Drafts are stored in `localStorage` (`us_seller_draft:<token>`). WelcomeStep says "Close the tab and come back anytime" without a device qualifier.
- Seller GET marks `sent`/`draft` as `in_progress` on open (unchanged by this task). Demo submissions skip metering, referral credit, admin/contact notifications, and send one owner-only completion email **synchronously** before responding, recording `test_drive_delivery_succeeded|failed`. So `GET /api/test-drive` after a submit returns a known `delivery`.
- Sample output already exists: `UtilitySheetPdfPreview` renders `buildPacketPdfHtml()` (the production builder) with the fictional fixture from `lib/branding/preview-data.ts`. `POST /api/branding/test-pdf` (auth plus rate limit) renders the same fixture through the Chromium pipeline with server-side plan gating. Both are described in `docs/pdf-system-reference.md` ("Preview and test-PDF architecture").
- Analytics are typed in `lib/analytics/events.ts`. Test-drive events exist (`offer_viewed`, `started`, `opened`, `completed`, `seller_link_copied`), and `seller_step_viewed` already uses `location: test_drive_seller_flow`.

## Approach

1. **Shared "See how it works" card** (reuse `TestDriveCard.tsx` file/export). Two side-by-side, equally weighted panels with outline buttons, so the page's primary action stays "Copy seller link":
   - **See a sample sheet**: opens a dialog (new `components/test-drive/SampleSheetDialog.tsx`) that reuses `UtilitySheetPdfPreview` with the saved default Brand Profile when it loads (labelled "fictional sample, shown with your saved default branding"), falling back to generic branding with an honest label. "Download sample PDF" reuses `generateTestPdf` / `POST /api/branding/test-pdf`. No new rendering path.
   - **Try the seller experience**: explains the seller role, fictional answers, and that it doesn't count toward the plan. Start = POST, then **same-tab navigation** to the seller URL (one click, no popup blocker, mobile-friendly). Resume = plain link. Completed = open test sheet / Download PDF, plus the "share your real link" next step. Ineligible = short note linking to Requests (onboarding). On the dashboard the whole card is hidden for ineligible accounts and while loading. If the test-drive state fails to load, the sample panel stays usable and the test panel shows an inline retry.
2. **Seller flow for test drives** (`isTestDrive` only; real and public demo paths unchanged):
   - Banner: "Test mode" with an "Exit to dashboard" link.
   - WelcomeStep variant explaining the seller role, fictional answers, no plan usage, and that progress saves in this browser.
   - Hide the "Email me this link" affordance. Interstitial copy: "Saving your test sheet".
   - New `TestDriveSuccess` in `SuccessStep` (`isTestDrive` prop): fetches `GET /api/test-drive`; on `completed` shows "Open test sheet" / "Download PDF" (existing authorized paths) and delivery copy only for known `sent`/`failed`. Otherwise shows a sign-in/dashboard fallback. Always offers "Back to dashboard" with the next step, and never says the agent was notified.
   - Save copy precision for all sellers: "saves automatically on this device".
3. **Copy**: remove "production PDF" and "Test UtilitySheet" customer copy (card, seller banner, packet banner, test completion email body).
4. **Analytics** (typed, no identifiers): add `sample_sheet_viewed`, `sample_sheet_pdf_downloaded` (`source`, `success`), `test_drive_output_opened` (`source`, `output: web|pdf`), `test_drive_dashboard_returned` (`source`). Widen test-drive `source` to include `seller_success` where needed. Retry and help-contact events use the test-drive location during test drives.

Not changing: onboarding-completion semantics, `/api/test-drive` contract, seller GET status transition, metering, schema, email sending logic, PDF renderer, `/demo`.

## Expected files

- `components/test-drive/TestDriveCard.tsx`, new `components/test-drive/SampleSheetDialog.tsx`
- `components/branding/UtilitySheetPdfPreview.tsx` (optional label/iframe title props only)
- `components/seller-form/{SellerWizard,SellerLayout}.tsx`, `steps/{WelcomeStep,SuccessStep}.tsx`
- `app/dashboard/page.tsx`, `app/onboarding/page.tsx` (placement/copy only)
- `app/packet/[token]/page.tsx` (banner copy only), `lib/email/email-service.ts` (one test-drive copy string)
- `lib/analytics/events.ts`, `lib/test-drive/types.ts`
- Tests: `tests/unit/test-drive-card.test.tsx`, new `tests/unit/sample-sheet-dialog.test.tsx`, new `tests/unit/seller-test-drive-success.test.tsx`, affected onboarding/dashboard tests. New Playwright `tests/test-drive-journey.spec.ts` (all APIs mocked).

## Acceptance criteria

- The reusable link stays the only primary button on onboarding and in the dashboard first-use area, and onboarding remains optional.
- A sample sheet is viewable in one click without creating any request, and its label matches what is shown (saved branding or generic).
- An eligible user starts the seller test in one click and lands in the seller flow in the same tab. Resume is a normal link.
- The test welcome, banner, and success screens say the user is acting as the seller, should use fictional answers, and that the test doesn't count toward the plan. Success never says an agent was notified and states email delivery only when known.
- Test success links to the completed web sheet and PDF (existing token paths from the authorized API) and back to the dashboard.
- Real seller success ("All Done!") and the public `/demo` success are unchanged, apart from the device-precise save copy.
- Loading, error/retry, ready/resume, completed, delivery-failed, and ineligible states render, with keyboard-reachable controls, visible focus, and 44px touch targets.
- Analytics payloads contain no IDs, tokens, addresses, names, or emails.

## Validation

- Focused Vitest for the card, dialog, seller success, onboarding, dashboard, seller layout/wizard, and PDF preview. Then the full `npm test -- --run`.
- Changed-file ESLint and `npm exec tsc -- --noEmit`.
- Playwright (mocked APIs, catch-all abort for unmocked `/api/**`): onboarding first use and the seller test journey at desktop and mobile widths, plus the real seller journey spec and a `/demo` smoke test. Dashboard is server-auth gated, so it is covered by unit tests only.
- `git diff --check`; direct inspection of new files for secrets.

## Risks

- Same-tab start leaves the dashboard. Mitigated by the banner exit link and success "Back to dashboard".
- The seller success fetch of `/api/test-drive` needs the user's session in that browser. Phone/email-opened tests fall back to a dashboard link.
- Hiding the dashboard card for ineligible accounts removes the dead-end message there (intentional).

## Progress log

- 2026-09-16: Plan written after startup audit; implementation begun.
- 2026-09-16: Implemented and validated. Completed.

## Outcome

Implemented as planned, with these additions found during QA:

- `app/onboarding/page.tsx`: the hero title is now a real `h1` (it was a styled `div`, so the page had no heading).
- Outline `<a>`/`<Link>` buttons in the card now go through `cn(buttonVariants(...))`. Without it, `border-transparent` could win and the links rendered borderless. The old card had the same bug.
- `TestDriveSuccess` top-aligns and scrolls to the top on mount, because the long review step left mobile users scrolled below the heading.
- The public `/demo` welcome no longer claims progress is saved (the demo never stores a draft).
- `/api/test-drive` error strings were reworded for customers (status codes and behavior unchanged). The packet-page test banner now has a "Back to dashboard" link.

No durable decision record was needed. These are UI-behavior choices recorded here: same-tab test start, the dashboard hides the guide for accounts with a real submission, and the sample uses the existing Branding preview fixture.

## Validation results

- Vitest: full `npm test -- --run` passed 155 files (823 tests on the first full run, which already included the new suites; the rerun after QA fixes also passed all 155 files). New/updated: `test-drive-card` (10), `sample-sheet-dialog` (4), `seller-test-drive-success` (9).
- `npm exec tsc -- --noEmit`: passed.
- ESLint on all changed files: 0 errors. 12 pre-existing warnings remain in `SellerLayout.tsx`/`SellerWizard.tsx`/packet page (`no-img-element`, `exhaustive-deps`).
- Playwright `tests/test-drive-journey.spec.ts` (new, every `/api/**` mocked): 9/9 passed on Desktop Chrome, Mobile Safari (iPhone 14), and Mobile Chrome (Pixel 7). Covered: onboarding first use, sample dialog, keyboard focus and touch-target size, one-click start, seller test welcome, flow and submit, evaluator success, resume and completed states, no horizontal overflow, no page errors, `/demo` smoke test.
- Playwright `tests/seller-wizard-journey.spec.ts` (real seller path): 6/6 passed on all three projects.
- `npm run security:scan` passed; `git diff --check` clean. New files contain only fictional fixtures (`example.com`, 555 numbers).
- Screenshots were reviewed and kept in the session scratchpad, not the repo. Playwright browsers (chromium 1208, webkit 2248) were installed to the local user cache to run QA.

## Limitations

- `/dashboard` is server-auth gated, so it was not browser-verified. The shared card is covered there by unit tests (`dashboard-reusable-link`) and verified in the browser on `/onboarding`.
- The real `/api/test-drive` + seller submission + email/PDF path was not exercised end to end (by design: no DB writes or email). It is unchanged apart from error copy and remains covered by existing route and safety tests.
- Visual QA used the light theme only.

## Optional follow-up (not required)

- The test invitation email still uses the normal seller-request template. Consider a test-labelled variant.
- The real seller success and other steps share the vertical-centering and retained-scroll pattern that `TestDriveSuccess` now avoids. Check small phones.
- The seller GET still marks a request `in_progress` on open, before any answers (unchanged by design). Reporting could distinguish "opened" from "started".
- Consider analytics dashboards for the new events (`sample_sheet_viewed`, `sample_sheet_pdf_downloaded`, `test_drive_output_opened`, `test_drive_dashboard_returned`). No admin UI was built.
