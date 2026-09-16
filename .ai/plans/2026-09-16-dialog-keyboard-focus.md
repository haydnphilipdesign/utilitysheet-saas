# Plan: Shared dialog keyboard focus containment

## Status

Completed (2026-09-16, Claude Code). Uncommitted in the worktree. No commit, push, deploy, or production action.

## Problem (reproduced)

In an open modal built on `components/ui/dialog.tsx` (Base UI `@base-ui/react` 1.0.0), Tab past the last control can move focus to the page behind.

Reproduction: `.qa-artifacts/specs/dialog-focus-repro.qa.spec.ts`, using the sample dialog on `/onboarding` with mocked APIs.
- **Keys less than a frame apart:** Tab and Shift+Tab escape to `BODY` and then to background controls, in both Chromium and WebKit.
- **Held-Tab repeat interval (16/25/33ms), 120 presses each:**
  - Chromium: 0 escapes.
  - WebKit (Playwright on Windows): 2, 13, and 3 escapes.
- **50ms or more between keys:** no escapes in either engine.

The earlier "Chromium only" observation came from a trace that pressed keys faster than a frame.

## Verified root cause

Base UI's `FloatingFocusManager` (modal) traps focus with visually hidden "inside" guard spans.
- When a guard receives focus, it calls `enqueueFocus()`, which refocuses the first or last control in the **next animation frame**.
- Background content is only marked `aria-hidden` plus `data-base-ui-inert` (`markOthers(..., ariaHidden=true, inert=false)`). It is **not** `inert`.
- A Tab pressed before that frame runs moves from the guard to the document and then to background controls.
- The app wrapper passes Base UI's defaults (`modal` true). It adds no configuration that causes this.
- The preview iframe is not the cause (the escape reproduces in the Feedback dialog, which has no iframe).
- Base UI 1.8.0 (latest) keeps the same design (rAF refocus, aria-hidden only; verified from the published package), so an upgrade would not fix it.
- Neither version exposes an option to make the background inert.

## Approach

Keep Base UI's modal trap and add one narrowly scoped enhancement in the shared wrapper (`DialogContent`): while this popup is open, add `inert` to exactly the background elements Base UI already hid for this modal (`[data-base-ui-inert][aria-hidden="true"]`, never an element containing this popup). Remove it as soon as the popup starts closing (it loses `data-open`), when Base UI un-hides an element, or on unmount.
- The mechanism is a MutationObserver: no keyboard listener and no custom focus trap.
- A module-level reference count prevents overlapping dialogs from removing each other's `inert`. The fix never removes `inert` that it did not add.
- Focus return to the opener happens at popup unmount (after the exit animation), which is after `inert` is released. Tests verify this.
- Nested popups mounted later (Select, menus) are not hidden by the dialog, so they stay interactive.

## Files

- `components/ui/dialog.tsx`, plus new `components/ui/use-inert-modal-background.ts`.
- Test fixture: `app/test-fixtures/dialogs/page.tsx` (+ `dialog-fixtures.tsx`). It returns 404 unless `NODE_ENV === 'development'` and renders the real Feedback dialog, the real DeleteRequestDialog (synthetic request), and a synthetic dialog containing a DropdownMenu (the shared Select wrapper has no consumers), with mocked APIs.
- Browser tests: `tests/dialog-focus.spec.ts` (sample dialog on `/onboarding`, plus the fixture page).

## Acceptance criteria

- For the sample, Feedback, and Delete dialogs, in Chromium and WebKit:
  - opens by keyboard with initial focus inside;
  - Tab and Shift+Tab wrap, including held-Tab timing;
  - background controls never receive focus while open;
  - Escape closes and focus returns to the opener;
  - reopening repeats the same behavior.
- Outside click still closes. Textarea typing still works. The nested menu opens, is keyboard operable, and closing it keeps focus in the dialog.
- The new tests fail before the fix and pass after it. Existing unit and browser regressions still pass.

## Validation

Focused Playwright (all projects), unit tests for affected dialogs, changed-file ESLint, `tsc`, full Vitest.

## Outcome

### Second cause found during implementation

Base UI's `markOthers` intentionally leaves every `[aria-live]` element, and its ancestor chain, un-hidden so announcements still reach screen readers. `components/test-drive/TestDriveCard.tsx` (added in `14e048d`) wrapped the seller-test panel, including its buttons, in `aria-live="polite"`. On `/onboarding` and the dashboard, "Start seller test" therefore stayed exposed behind the sample dialog.

Fix: removed `aria-live` from that wrapper. The messages that need announcing already have `role="alert"` or `role="status"` on text-only elements. Other `aria-live` uses were checked: text-only (requests loading, branding, sheet editor save status), on a page with no dialog (admin reconciliation card), or on a page with no dialog (`TestDriveSuccess`).

### Changes

- `components/ui/use-inert-modal-background.ts` (new): mirrors Base UI's modal `aria-hidden` marking into `inert` while the popup has `data-open`, using a MutationObserver.
  - Releases when closing starts, when an element is un-hidden, or on unmount.
  - Uses a shared reference count and never touches `inert` the app set itself.
  - Skips elements that contain the popup.
- `components/ui/dialog.tsx`: `DialogContent` passes its popup element to the hook through a callback ref. Nothing else changed.
- `components/test-drive/TestDriveCard.tsx`: removed `aria-live` from the panel wrapper, with an explanatory comment.
- `app/test-fixtures/dialogs/` (new, served only by `next dev`) and `tests/dialog-focus.spec.ts` (new).
- No dependency change: Base UI 1.8.0 has the same design, and no option exists in either version.

### Validation (Claude)

- `tests/dialog-focus.spec.ts` checks the sample sheet dialog, the Feedback dialog, the Delete confirmation dialog, a nested DropdownMenu inside a dialog, and outside-click close.
  - Each dialog is exercised in two rounds of: keyboard open, initial focus, a full Tab cycle and a full Shift+Tab cycle with wrap, 50 rapid key presses with no background focus, and Escape with focus returning to the opener.
  - It also checks that Feedback typing works and that no feedback POST or DELETE request is sent.
- **Before the fix** (both fix files reverted, final spec): 15/15 failed on Desktop Chrome, Mobile Safari, and Mobile Chrome.
  - 12 failures: background controls received focus (for example "Background before", "Send feedback", "Background input", "Copy Link", "Start seller test").
  - 3 failures: the background was not inert.
  - Log: `.qa-artifacts/dialog-focus-before-fix.log`.
- **After the fix**: 15/15 passed (`.qa-artifacts/dialog-focus-after-fix.log`), and 45/45 with `--repeat-each=3`.
- Full Vitest: 155 files, 828 tests passed. `tsc --noEmit` passed. ESLint on changed files: clean. `security:scan` passed; `git diff --check` clean.
- Full Playwright: 62 passed, 5 skipped, 5 failed. The failures are all `marketing-mobile.spec.ts` on Mobile Safari (`page.goto('/')` timeout). They are **pre-existing**: the same spec also fails on Mobile Safari with the fix reverted (4 failed, 1 passed). They are unrelated to dialogs.

### Limitations

- WebKit coverage is Playwright's WebKit on Windows (iPhone 14 emulation), not physical Safari or iOS. Physical Safari only Tab-navigates to buttons when its "Press Tab to highlight each item" setting is on.
- `next dev` mounts its dev-tools overlay (`nextjs-portal`) inside a `<script>` element, which Base UI never hides, so it can take focus in development. The spec classifies it as dev tooling; it does not exist in production builds.
- The fix relies on Base UI's internal `data-base-ui-inert` marker and `aria-hidden` marking, both present in 1.0.0 and 1.8.0. Re-run `tests/dialog-focus.spec.ts` after any Base UI upgrade.
- `components/ui/sheet.tsx` builds on Base UI's dialog directly, not on this wrapper, so it keeps the original race. It is used only in admin (`admin/users/users-table.tsx`, `AdminAccountPreview.tsx`). Applying the same hook there is an optional follow-up. No existing dialog nests a popup, so the nested case uses a synthetic fixture.
- Screen-reader output was not tested with a real screen reader. `aria-hidden` behavior is unchanged from Base UI.
- Local QA-only repro: `.qa-artifacts/specs/dialog-focus-repro.qa.spec.ts` (ignored).
