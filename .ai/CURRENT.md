# Current Work

## Session Metadata

- Task: Add safe post-signup referral-code claiming.
- Intended outcome: Let an authenticated user attach a missed referral code in
  Settings, including an approved path after their first real seller submission.
- Status: Completed locally and fully validated; not committed, deployed, or
  applied to production data.
- Current or last agent: OpenAI Codex
- Branch: `main`
- Last updated: 2026-08-07
- Relevant plan: `.ai/plans/2026-08-07-post-signup-referral-code.md`
- Issue/PR: none

## Verified Repository State and Constraints

- `growth_attributions.referral_code` already supports the required data; no
  migration is needed or authorized.
- Existing referral trial and credit-award paths resolve that code through the
  reusable intake-link slug.
- Claims must be authenticated, one-time, and non-self. The product owner has
  approved a 30-day signup grace period, including after seller submissions.
- Existing first-touch marketing attribution must be preserved.
- The worktree began with this coordination file modified and an untracked
  security-scan plan; preserve the prior scan artifacts and plan.
- The prior Codex Security scan remains paused on a Windows inventory-path
  defect and is bound to immutable revision
  `6cd3e15d09367cc897573fc3d159c176286a49d4`.

## Work Completed

- Read repository and suite guidance, the prior handoff, Git status/diff, and
  the relevant referral, attribution, billing, settings, and test paths.
- Verified the feature can reuse the existing schema.
- Created the implementation-ready plan and implemented claim-state and
  one-time claim queries without a schema change.
- Extended `GET /api/referrals` with claim state and added an authenticated,
  Zod-validated `POST` claim endpoint.
- Added the Settings referral-code form, claimed/expired states, and API error
  handling.
- Claims preserve existing first-touch fields, reject unknown/self/replacement
  codes, and are serialized on the account row.
- Successful claims schedule the existing idempotent award path; award
  eligibility now accepts one or more real submissions so late claims can be
  credited retroactively.

## Validation

- Focused Vitest: 5 files / 50 tests passed.
- Full Vitest: 134 files / 685 tests passed.
- `npm exec tsc -- --noEmit` passed.
- Focused ESLint passed.
- `npm run build` passed.
- `npm run security:scan` passed.
- `git diff --check` passed with line-ending warnings only.

## Remaining Required Work

- No required implementation or validation remains within the authorized
  scope.
- Publication remains pending: no commit, push, deployment, migration, or
  production data action was authorized or performed.

## Concurrent Editing Warnings

- Preserve `.ai/plans/2026-08-05-codex-security-standard-scan.md` and all scan
  artifacts/state; do not attempt to resume or replace that scan in this task.
- No other product-source edits were present at startup.

## Recommended Next Action

After explicit authorization, review and commit the intended files, deploy,
and smoke-test a valid, invalid, self, claimed, and expired code in production.
