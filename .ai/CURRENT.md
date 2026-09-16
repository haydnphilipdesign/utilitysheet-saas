# Current task: first-use guide and seller test-drive polish

- Date: 2026-09-16. Last agent: Claude Code. Branch: main. Status: **Completed.** No required work remains.
- Commit and worktree state:
  - The initial implementation is committed as `14e048d` (HEAD).
  - The follow-up fixes below are **uncommitted**: `.gitignore`, `components/branding/UtilitySheetPdfPreview.tsx`, `components/test-drive/SampleSheetDialog.tsx`, `tests/unit/sample-sheet-dialog.test.tsx`, `tests/unit/utilitysheet-pdf-preview.test.tsx`, plus this file and the plan.
  - Nothing was pushed or deployed by Claude. Deployment status is unverified.
- Plan: `.ai/plans/2026-09-16-first-use-and-test-drive-polish.md` (see "Follow-up" for full detail).
- Authorization: local changes and tests only. No commit, push, deploy, migration, production data change, or real email.

## Follow-up completed this session (Claude)

- **Sample freshness fixed.** The dialog body mounts per opening and refetches branding and plan with `no-store`. Stale responses from a closed opening are discarded, a failed load is not cached, and preview, download, and analytics share the same per-opening context. Fallback copy separates "no branding" from "couldn't load".
- **Preview component.** The decorative iframe is `tabIndex={-1}`. The new `scrollContained` prop (default unchanged) lets the dialog avoid nested scrolling.
- **Verification by Claude.**
  - Unit tests: 8 sample-dialog tests (5 fail against `14e048d`, all pass now). Full Vitest: 155 files, 828 tests.
  - `tsc` and changed-file ESLint are clean. Committed Playwright: 15/15. `security:scan` passed.
  - Signed-in dashboard and dark-theme QA: 25/25 across 5 projects (desktop light and dark, iPhone WebKit light and dark, Pixel dark).
- **Dashboard verification method.** A temporary development-only harness route rendered the real dashboard client components with mocked APIs. A real Stack login was not used because activation can write to the configured database. The harness was **deleted** from `app/`; a copy and re-run steps are in `.qa-artifacts/README.md`.
- **States checked.** The first-run dashboard in eligible, ready, completed (delivery failed), error/retry, and ineligible states, plus the sample dialog (keyboard, close, reopen, download, 429). Onboarding, the seller test welcome and banner, and test completion were checked in both light and dark themes. Contrast checked in both themes.
- **Screenshots.** `C:\Users\haydn\Documents\norma_suite\utility-sheet\.qa-artifacts\screenshots\` (50 PNGs, git-ignored).
- **Remaining limitations.**
  - No real Stack session, real API responses, or physical devices were used.
  - Pre-existing app-wide issue (not fixed): in Chromium, Tab past the last control escapes Base UI dialogs, the existing Feedback dialog included. This belongs in a separate `components/ui/dialog.tsx` task.
- **Next action.** The owner reviews the uncommitted follow-up diff and decides whether to commit and deploy. Optional: a shared dialog focus-trap task.

## Independent review — 2026-09-16, Codex

- Reviewed new components and integration against first-use brief; reran focused card/sample/success tests: 3 files, 23 tests passed. Did not independently repeat browser/full-suite validation; results above are Claude's report.
- Repository changed during review: implementation now exists in commit `14e048d`; worktree was clean afterward. Earlier "uncommitted" status is superseded. Codex did not commit, push, or deploy; deployment status was not verified.
- Follow-up found: SampleSheetDialog loads branding once per mount (`loadStartedRef`). On /onboarding, viewing a sample, saving new branding/contact details, and reopening the dialog continues showing/downloading the old branding; failed initial branding loads also remain cached as placeholder until reload. Recommend refresh on each opening or explicit invalidation after branding saves, with a regression test. This is a bounded polish fix, not evidence of a seller-flow failure.
- Actual authenticated dashboard and dark theme remain unverified in browser. Review complete; no application files changed by Codex. Next: address preview freshness and perform first-run dashboard/dark-theme QA before treating visual acceptance as complete. Coordinate with Claude before edits because a concurrent commit occurred during review.

## Finishing-pass review — 2026-09-16, Codex

- Read Claude's finishing report, updated plan and follow-up diff. Preview freshness fix addresses the previously identified one-load cache; per-opening body cleanup discards late responses. Preview scroll containment defaults remain unchanged outside the sample dialog.
- Independently reran sample-sheet-dialog and utilitysheet-pdf-preview: 2 files / 17 tests passed. Full-suite, browser, contrast and screenshot findings remain Claude-reported; not independently repeated in this review.
- Dashboard client UI was exercised via a mocked development harness, not an authenticated end-to-end session. This is useful UI coverage; real auth/API integration remains unverified.
- Shared Chromium dialog focus escape remains a reported accessibility defect, not merely cosmetic. Recommend a separate bounded reproduction/fix with keyboard regression coverage across sample and existing dialogs before calling accessibility polish complete. No shared-dialog edits made here.
- Review completed. No application changes by Codex; only this handoff appended. HEAD remains 14e048d with Claude's finishing-pass changes uncommitted. No commit, push, deployment, live data or email action performed. Next: address the reported shared focus defect; release authorization remains with owner.
