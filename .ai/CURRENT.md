# Current Work

> This file is the latest cross-agent handoff.
> Keep it concise, factual, and current.
> Replace stale task information instead of accumulating a permanent chronological log.

## Session Metadata

- Task: Build the self-serve authenticated Test UtilitySheet experience for newly registered users.
- Status: Completed; no required implementation or validation work remains.
- Current or last agent: OpenAI Codex
- Branch: `main`
- Last updated: 2026-07-21
- Relevant plan: `.ai/plans/2026-07-21-self-serve-test-utilitysheet.md`

## Verified Repository State and Constraints

- `HEAD`, local `main`, and `origin/main` began aligned at `df39f81`; no commit, push, deployment,
  migration, production email, or production-data action was performed.
- The pre-existing untracked `.ai/plans/2026-07-21-live-growth-notification-migrations.md` is an
  intentional completed live-schema verification artifact and remains untouched.
- `requests.is_demo` already provides the durable marker, so this feature requires no schema change.
- The generic public `/demo`, reusable seller-link contract, and normal request/seller behavior remain intact.

## Work Completed

- Added authenticated GET/POST `/api/test-drive`, server-derived verified recipient and fictional identity,
  active workspace/Branding Profile/intake defaults, rate limiting, and transaction/advisory-lock-backed
  create-or-resume behavior that sends at most one invitation.
- Removed client-controlled `isDemo` from ordinary request creation; the normal route always creates a
  non-demo request and retains monthly-limit enforcement.
- Reused the real seller persistence, web packet, branded production PDF, and completion-email paths while
  making demo submission idempotent and excluding quota/metering, AI/provider-memory writes, contact
  resolution, referral credit, workspace-admin fan-out, contact alerts, and acquisition/referral content.
- Added owner-only test completion delivery with a required production-PDF attempt and durable success/fail
  event state. Delivery or telemetry failure never rolls back the submitted demo or removes review links.
- Added the shared Test UtilitySheet card to onboarding and dashboard with eligible/loading/error,
  creating, resume, completed, delivery-failed, and live-submission-ineligible states plus safe typed analytics.
- Excluded demos from customer lists/counts/stats/Needs Attention/weekly summaries, activation outreach,
  provider memory, Branding Profile usage, admin latest requests, and admin abandonment/seller-progress data.
- Added focused route, query, seller safety, packet/email, operational-exclusion, and component coverage.

## Validation

- Full Vitest: 119 test files passed after making one new effect-timing assertion deterministic.
- Final focused regression/safety run: 7 files, 38 tests passed.
- Changed-file ESLint: 0 errors; 12 existing warnings remain in touched packet/seller components.
- `npm exec tsc -- --noEmit`: passed.
- `npm run build`: passed; `/api/test-drive` appears in the route manifest.
- Signed-in browser QA: onboarding and dashboard at 390px, 768px, and 1440px had visible ineligible-state
  cards, no horizontal overflow, and no console errors. The available account already had real submissions,
  so eligible-state interaction remained covered by component/API tests and no email/test record was created.
- `npm run security:scan` and direct new-file sensitive-data inspection: passed.
- `git diff --check`: passed.

## Remaining Work and Risks

- Required: none.
- Browser limitation: a live eligible-account email/PDF round trip was intentionally not executed because
  safe QA had no eligible fixture and production email/data actions were prohibited. The server, component,
  email attachment, packet, and failure paths are covered by tests.
- Optional: review and stage/commit the focused diff only when explicitly authorized.

## Concurrent Editing Warnings

- No active task-specific file ownership warning remains.
- Preserve unrelated work, especially `.ai/plans/2026-07-21-live-growth-notification-migrations.md`.

## Recommended Next Action

Review the self-serve test-drive diff and validation evidence; no additional implementation is required.
