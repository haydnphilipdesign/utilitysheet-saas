---
status: active
owner: claude
updated: 2026-10-22 19:00
scope: .ai/tasks/2026-10-22-new-user-experience-review.md, .ai/plans/2026-10-22-new-user-experience.md, app/test-fixtures/dashboard, app/dashboard/page.tsx, components/dashboard/first-run-guide.tsx, components/test-drive, lib/analytics/events.ts, app/onboarding/page.tsx, app/auth/signup/page.tsx, tests/unit, lib/email/email-service.ts, lib/neon/queries/activation-outreach.ts, app/api/cron/activation-reengagement, lib/ops, vercel.json, app/(admin)/admin, lib/admin, app/api/onboarding, tests/test-drive-journey.spec.ts, tests/dialog-focus.spec.ts
---

Implementation follows [the plan](../plans/2026-10-22-new-user-experience.md); Phases 1 and 2 committed; Phase 3 done (uncommitted).
# New user experience review

## Goal

Review the path from sign-up to an activated account (first live seller
submission): (1) check activation numbers, (2) walk the flow as a new user on
desktop and phone, (3) write up what works, what is stale, and what is missing,
ranked by likely retention impact. Review only; no product changes yet.

## Progress

- Last deliberate onboarding work was 14e048d (2026-09-16). 161 commits since,
  including saved seller forms, Teams invites, paid sign-ups to Billing, HOA
  questions, slate-blue switch.
- Numbers (read-only aggregates, 2026-10-22, may include owner test accounts):
  163 user accounts; 42 ever had a live seller submission; 82 never created a
  request or test drive. Median signup-to-first-submission 2.6 h (27 of 42
  within a day). Last 90 days: 27 sign-ups, 4 activated, 12 did nothing, 7 sent
  a request the seller never finished. 92 activation reminders sent, 7 followed
  by activation. Setup page completion ~60% Jan-Feb (gated) vs 2 of 19 in Sep.
- Walkthrough done on Desktop Chrome and iPhone 14 (WebKit), no page errors.
  Added dev-only fixture `app/test-fixtures/dashboard/` (renders the real shell
  and dashboard home; 404 outside `next dev`). Uncommitted.
- Main findings (full list given to the user in chat): first run asks for a
  seller the user may not have yet; empty work cards say "You are caught up";
  test drive is labeled optional and uses a fictional address, so it likely
  cannot show provider suggestions; dashboard does not change after progress;
  `/onboarding` is orphaned and still has the teal tint
  (app/onboarding/page.tsx:271); no welcome email and both reminders repeat
  "your link is ready"; duplicate "Manage forms"/"Manage seller forms" links.

## Environment

- `.env.local` holds real credentials. Numbers come from read-only aggregate
  queries (no row-level or personal data printed). The walkthrough runs locally
  with every `/api` call mocked in the browser and synthetic env overrides, so
  no account, request, or email is created.
- Screenshots and scripts live in the session scratchpad, not the repo.

## Validation

Review: walkthrough script (scratchpad) ran against `next dev` with synthetic
env overrides and all `/api` mocked: 26 screenshots, 0 page errors.

Phase 1 (2026-10-22, after final edits):
- `node node_modules/typescript/bin/tsc --noEmit`: pass.
- `node node_modules/eslint/bin/eslint.js` on all changed files: pass.
- `node node_modules/vitest/vitest.mjs run` (full): 264 files passed, 1 skipped;
  2312 tests passed, 13 skipped.
- `node scripts/security/scan-artifacts.mjs`: passed. `git diff --check`: clean.
- Browser check, desktop Chrome and iPhone 14 WebKit, mocked APIs, 7 states
  (new, after test, test in progress, seller started, activated, guide hidden):
  no page errors, no horizontal overflow.

Phase 2 (2026-10-22): `tsc --noEmit` pass; ESLint on changed files pass; full
Vitest 264 files passed, 1 skipped, 2319 tests passed, 13 skipped; security
scan passed; `git diff --check` clean. Email previews rendered for 4 variants
at 900px and 390px (scratchpad). New candidate query run read-only against the
live database: valid, 1 account due.

Phase 3 (2026-10-22): `tsc --noEmit` pass (after `next typegen` and a dev
server start refreshed generated route types for the deleted routes); ESLint
on changed files pass; full Vitest 264 files passed, 1 skipped, 2319 tests
passed, 13 skipped; Playwright `test-drive-journey` + `dialog-focus` on all 3
projects: 24 passed; security scan passed; `git diff --check` clean. Setup
page screenshots (desktop, iPhone, normal and Teams member): no page errors,
no overflow.

## Next

Phases 1 (51f6fd1) and 2 (860bca5) committed on branch `new-user-experience`.
Phase 3 is uncommitted on the same branch, waiting for the user. Then Phase 4
(first request follow-through) per the plan.
