# Most recent task (completed, uncommitted): whole-transaction messaging (listing intake through closing)

- Date: 2026-09-16. Agent: Claude Code. Branch: main. Status: **Completed**. No required work remains.
- Plan and full validation: `.ai/plans/2026-09-16-whole-transaction-messaging.md`.
- Changed files:
  - `components/landing/HeroSection.tsx`
  - `components/landing/MarketingStory.tsx`
  - `app/(marketing)/marketing.css` (new `.workflow-moments`)
  - `lib/marketing-content.ts` (FAQ and workflow copy, new "When should I send the seller link?")
  - `app/(marketing)/{page,how-it-works/page,tc-utility-handoff-kit/page,utility-sheet-for-transaction-coordinators/page,utility-sheet-for-real-estate-agents/page}.tsx`
  - `app/dashboard/page.tsx` (two accordion lines)
  - new `components/marketing/copy-template-button.tsx`
  - `tests/unit/tc-utility-handoff-kit.test.tsx`
- Checks:
  - Vitest 22/22 and ESLint clean.
  - Security scan passed.
  - Screenshots at desktop, tablet, and mobile are OK.
  - `tsc` shows only stale `.next` validator errors from the account-closure session's deleted route.
- Reported follow-up: the "seller links stay read-only after submission" copy is not enforced server-side for non-demo requests (see plan).
- Next action: the owner reviews and commits these files separately from the account-closure and dialog work.

---

# Active task (Codex takeover): account password confirmation and self-serve account closure

- Date: 2026-09-16. Current agent: OpenAI Codex (takeover from Claude Code after usage-limit interruption). Branch: main (HEAD `5192ab3`). Status: Phase A (wording) is **completed and uncommitted**. Phase B (executable closure) is **approved and under review/implementation**; the drafted implementation is not yet accepted as correct and closure-specific tests/final validation remain unfinished (decision: `.ai/decisions/2026-09-16-self-serve-account-closure-lifecycle.md`).
- Plan: `.ai/plans/2026-09-16-account-closure-and-password-confirmation.md`. It holds the investigation, the proposed lifecycle, and the four approval decisions.
- Authorization: local code, docs, and tests only. No commit, push, deploy, live migration, production data change, Stripe mutation, real account deletion, or real email.
- Files owned by this task: `components/settings/account-security.tsx`, `lib/account/security.ts`, `tests/unit/account-security-settings.test.tsx`. After approval, the Phase B list in the plan.
- Concurrent-edit warning: the dialog task below left uncommitted changes. Do not edit or revert `components/ui/dialog.tsx`, `components/ui/use-inert-modal-background.ts`, `components/test-drive/TestDriveCard.tsx`, `app/test-fixtures/`, or `tests/dialog-focus.spec.ts` as part of this task.
- Phase A:
  - Changed: `components/settings/account-security.tsx`, `lib/account/security.ts`, `tests/unit/account-security-settings.test.tsx`.
  - Checks: Vitest 6/6 and 4/4, ESLint and `tsc` clean.
- Approved changes to the proposal:
  - UtilitySheet cancels the relevant subscriptions at closure, with no refund.
  - The user picks the admin who receives their shared work.
- Takeover verification: Codex read the project and suite guidance, this handoff, the approved plan/decision, and inspected Git status/diff/untracked files. Marketing and dialog-focus changes are concurrent completed work and remain out of scope.
- Milestone: implementation review and focused closure testing are complete. Codex fixed delayed-webhook tombstone reactivation, approved Stripe-reference retention, shared-asset transfer races, seeded-account claim guards, admin read-only closure visibility, and false-success result-page handling. New focused coverage passes 10 files / 49 tests. `next typegen` regenerated supported route types and `tsc --noEmit` passed before the final edits.
- Static migration review: `migrations-account-closure.sql` matches the `schema.sql` closure columns/table/status constraints/indexes and referral `forfeited` state; query table/column references were checked against the schema. It was not applied.
- Next action: run changed-file ESLint, final TypeScript, full Vitest, production build, security scan, and `git diff --check`; fix only account-closure regressions and record exact results.

---

# Previous task (completed, uncommitted): shared dialog keyboard focus containment

- Date: 2026-09-16. Agent: Claude Code. Branch: main (HEAD `5192ab3`). Status: **Completed**. No required work remains.
- Plan: `.ai/plans/2026-09-16-dialog-keyboard-focus.md` (full evidence, limitations).
- Authorization used: local changes and tests only. No commit, push, deploy, migration, production data change, or real email.
- Worktree:
  - **Uncommitted changes from this task only:**
    - modified: `components/ui/dialog.tsx`, `components/test-drive/TestDriveCard.tsx`, `.ai/CURRENT.md`;
    - new: `components/ui/use-inert-modal-background.ts`, `app/test-fixtures/dialogs/page.tsx`, `app/test-fixtures/dialogs/dialog-fixtures.tsx`, `tests/dialog-focus.spec.ts`, `.ai/plans/2026-09-16-dialog-keyboard-focus.md`.
  - The earlier onboarding finishing pass is already committed (`14e048d`, `5192ab3`). The section below that calls it "uncommitted" is historical.
- Root causes (verified):
  1. Base UI's modal trap (1.0.0; the same in 1.8.0) returns focus from its guard elements one animation frame later, and it hides the page behind the dialog only with `aria-hidden`. Rapid Tab (and held Tab in WebKit) reached background controls.
  2. Base UI keeps `aria-live` regions interactive behind modals. `TestDriveCard` wrapped its buttons in one, which exposed "Start seller test" behind the sample dialog.
- Fix:
  1. The shared `DialogContent` now makes exactly the elements Base UI hid `inert` while the dialog is open, and releases them when closing starts (hook: `components/ui/use-inert-modal-background.ts`).
  2. Removed the control-wrapping `aria-live` in `TestDriveCard`.
  - No dependency change, no keyboard listener, no custom focus trap.
- Validation:
  - New `tests/dialog-focus.spec.ts` (sample, Feedback, and Delete dialogs, a nested menu, outside click) on Chromium, WebKit, and Mobile Chrome: 15/15 fail before the fix, 15/15 pass after, and 45/45 over 3 repeats.
  - Full Vitest: 828 passed. `tsc` and changed-file ESLint are clean. Security scan passed.
  - Full Playwright: 62 passed, 5 skipped, and 5 pre-existing Mobile Safari `marketing-mobile` `goto` timeouts (also failing without the fix).
- Remaining limitations:
  - WebKit is Playwright on Windows, not physical Safari.
  - The `next dev` overlay (`nextjs-portal`) can take focus in development only.
  - The fix depends on Base UI's internal markers; re-run the spec after upgrades.
  - Admin-only `sheet.tsx` (Base UI dialog directly) is not covered.
- Next action: the owner reviews and commits if satisfied. Optional follow-up: investigate the Mobile Safari `marketing-mobile` timeouts separately.

---

# Older task (completed and committed): first-use guide and seller test-drive polish

- Committed in `14e048d` and `5192ab3`. Details, validation, and Codex reviews are in `.ai/plans/2026-09-16-first-use-and-test-drive-polish.md`. No required work remains.
