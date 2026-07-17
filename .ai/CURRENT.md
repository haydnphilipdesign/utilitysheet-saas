# Current Work

> This file is the latest cross-agent handoff.
> Keep it concise, factual, and current.
> Replace stale task information instead of accumulating a permanent chronological log.

## Session Metadata

- Task: Implement the Notifications + immediate Settings quality slice from the completed configurability audit (accessible switches, PDF-attachment dependency, weekly-summary decision, personal-vs-workspace scoping, and the approved team notification-routing model).
- Status: Implementation complete and validated (except live authenticated browser QA). Uncommitted on `main`. Awaits separate authorization to commit and to run the migration live.
- Current or last agent: Claude Code
- Branch: `main`
- Last updated: 2026-07-17
- Relevant plan: `.ai/plans/2026-07-17-notifications-settings-quality-slice.md`
- Source audit: `.ai/plans/2026-07-17-settings-branding-configurability-audit.md`
- Prior completed task: Workspace & Team Settings separation (`.ai/plans/2026-07-17-workspace-team-settings.md`).
- Related issue or PR: None known.

## Active Task: Notifications Quality Slice — COMPLETE

- Product-decision gate resolved: **Model B approved** (workspace admin routing toggle, membership-derived
  recipients, defaults OFF). Implemented as described in the active plan's Implementation Record.
- Phase 1 (accessibility/dependency) and Phase 2 (Model B routing) are both implemented.
- Weekly summary remains intentionally unavailable. Verified blocker: `/api/cron/weekly-summary` is not
  registered in `vercel.json` (only activation crons are). The old commented-out toggle was removed and
  replaced with a code comment documenting the blocker. Do not enable the cron until a dependable weekly
  schedule is wired.
- Non-blocking rule preserved: all submission-notification sends run in `Promise.allSettled` inside a
  try/catch in `app/api/seller/[token]/route.ts`; no send can block the seller response.
- Scoping preserved: personal per-account `notification_preferences` (each recipient's own gate) are
  distinct from workspace-level `organizations.notification_settings` (who is eligible).

## Files Changed (uncommitted)

- `app/dashboard/settings/page.tsx`: accessible switch names; nested/disabled PDF-attachment dependency;
  weekly-summary blocker comment; Team notifications card + toggle wired to the new endpoint.
- `app/api/seller/[token]/route.ts`: owner + live-admin recipient fan-out via `buildSubmissionRecipients`
  and `Promise.allSettled` (non-blocking); contact-resolution alerts kept owner-only.
- `app/api/organization/notifications/route.ts` (new): admin-only, active-org-scoped PATCH.
- `lib/notifications/workspace-routing.ts` (new): setting key, normalizer, pure recipient builder.
- `lib/neon/queries/organizations.ts`, `lib/neon/queries/index.ts`: `updateOrganizationNotificationSettings`,
  `getOrganizationAdminRecipients`, exports.
- `lib/validation/schemas.ts`: `organizationNotificationSettingsBodySchema`.
- `schema.sql` + `migrations-organization-notification-settings.sql` (new): `organizations.notification_settings`
  JSONB, default `{}` (backward compatible → routing off).
- New tests: `tests/unit/workspace-notification-routing.test.ts`,
  `tests/unit/organization-notifications-route.test.ts`,
  `tests/unit/organization-notification-queries.test.ts`,
  `tests/unit/settings-notifications-accessibility.test.tsx`.

## Validation

- Focused Vitest: 25/25 across new + related settings suites; 42/42 seller/email regression suites.
- Changed-file ESLint clean; `npm exec tsc -- --noEmit` clean; `npm run build` succeeded; `git diff --check`
  clean.
- Accessibility verified at component level through the accessibility tree (role/accessible-name queries)
  plus the disabled PDF-dependency and admin-only toggle behavior.
- NOT DONE: live authenticated desktop/mobile browser QA (no credentialed browser in this non-interactive
  session). The `settings-notifications-accessibility` and `settings-workspace-team` component tests
  substitute at the component level, but a live pass on the Team workspace toggle and end-to-end admin
  submission fan-out is still recommended.

## Remaining Required Work

- None for implementation. Before this ships: (1) run authenticated desktop/mobile QA of the Notifications
  tab and the Team notifications toggle; (2) apply `migrations-organization-notification-settings.sql`
  to the target database (separately authorized) before or with deploy; (3) commit (separately authorized).

## Concurrent Editing Warnings

- Changes are limited to the files listed above. Preserve any unrelated untracked coordination files.
- The migration is created but NOT applied. Do not run it live without explicit authorization.

## Recommended Next Action

Run authenticated desktop/mobile QA of the Notifications tab (accessible switches, PDF-attachment
dependency) and, on a Team workspace, the new "Team notifications" admin toggle. Then, when separately
authorized, apply `migrations-organization-notification-settings.sql` and commit the slice.
