# Notifications & Immediate Settings Quality Slice

- Status: Implementation complete (2026-07-17); Model B approved and shipped. Live authenticated
  browser QA is the only outstanding validation (not runnable in this non-interactive session).
- Owner: Claude Code
- Date: 2026-07-17
- Source audit: `.ai/plans/2026-07-17-settings-branding-configurability-audit.md`
- Branch: `main`

## Goal

Ship the Notifications + immediate Settings quality items surfaced by the completed configurability
audit: accessible notification switches, a visible dependency between submission emails and the PDF
attachment, a verified decision on the dormant weekly-summary preference, clean personal-vs-workspace
scoping, and (after a product-decision gate) a minimal team notification-routing model.

## Verified Starting Facts

- Settings notifications UI lives in `app/dashboard/settings/page.tsx` (`notifications` tab), with three
  visible `Switch`es: `seller_submissions`, `seller_submission_pdf_attachment`, `contact_resolution`.
  A fourth `weekly_summary` control is commented out. The `collect_electric_meter_number` switch lives
  on the `link`/Seller Form tab.
- Every `Switch` (base-ui `SwitchPrimitive.Root`, rendered as a `role="switch"` button) has only an
  adjacent `<p>` label with no `id`, `htmlFor`, `aria-label`, or `aria-labelledby`. Accessible-name gap
  confirmed for all notification and seller-form switches.
- Preferences persist per account in `accounts.notification_preferences` (JSONB) via `POST /api/account`
  (`accountUpdateSchema`, `record(string, boolean)`, max 40 keys) and `updateAccount`. These are
  personal-account preferences.
- Seller-submission notifications are sent from `app/api/seller/[token]/route.ts` **only** to the owning
  member's `account.email` (the request's `account_id`). There is no team fan-out today. Requests carry
  `account_id` (owning member) and optional `organization_id` (active org at creation).
- `shouldAttachPdf = !accessLocked && seller_submission_pdf_attachment !== false`, and the attachment is
  only ever produced inside the `seller_submissions !== false` branch. So the PDF attachment is
  functionally dependent on submission emails being enabled; the UI does not communicate this.
- Notification and contact-resolution email sends are already wrapped in `try/catch` and never throw out
  of the submission handler. This rule (failures must not block submission) must be preserved.
- Weekly summary: `app/api/cron/weekly-summary/route.ts`, `getAccountsWithWeeklySummaryEnabled`, and
  `sendWeeklySummaryEmail` all exist, but `/api/cron/weekly-summary` is **not** registered in
  `vercel.json` (only `activation-reconcile` and `activation-reengagement` crons are). There is no
  scheduling infrastructure wired for it. This is the verified blocker to exposing the preference.
- Org/member model: `organizations`, `organization_members(role admin|member)`, and admin-only
  membership queries already exist (`getOrganizationMembers`, `getOrganizationMemberRole`, etc.).

## Team Notification Routing — Product-Decision Gate (BLOCKING)

Present the models below, recommend the smallest useful one, and wait for approval before implementing.

- **Model A — Owner-only (status quo, formalized).** No change to recipients; only the request's owning
  member is notified. No new data. Rejected as recommendation: adds no team value; audit called team
  routing out as high-value.
- **Model B — Workspace admin routing toggle (membership-derived) — RECOMMENDED.** One admin-managed,
  workspace-level setting. When ON, seller submissions for that organization's requests also notify the
  organization's admins (derived live from `organization_members` where role = admin), in addition to the
  owner. Each recipient still honors their personal `seller_submissions` preference. Removed members drop
  automatically (recipients derived at send time). No free-form emails, so no invalid-recipient or
  data-leak surface beyond current members. Defaults OFF (backward compatible). Requires minimal
  workspace-level persistence (one org setting).
- **Model C — Free-form workspace recipient list / shared inbox.** Admins enter arbitrary CC addresses or
  a shared inbox. Most flexible, but adds email validation, invalid-recipient handling, more UI, and
  higher risk. Recommend deferring to a future, separately approved project.

Recommendation: **Model B**. Smallest model that adds real TC-team value, keeps personal vs. workspace
scoping clean, is safe with removed members, and invents no unsupported recipient behavior.

## Phases

1. **Immediate quality slice (non-gated, may proceed now).**
   - Give every notification and seller-form `Switch` an accessible name via `id` + `aria-labelledby`
     bound to its visible label text.
   - Make "Attach PDF to submission emails" visibly dependent on "Seller submissions": nest it under the
     seller-submissions row and disable it (with explanatory copy) when submissions are OFF.
   - Keep weekly summary unavailable; document the verified `vercel.json` cron blocker in code and plan.
     Do not expose the toggle.
   - Add focused a11y/interaction tests (accessible-name queries, disabled-dependency behavior).
2. **Team routing (gated) — after Model B approval.**
   - Add workspace-scoped routing setting (admin-only), server-side authorization + org isolation.
   - Extend the seller-submission send to add membership-derived admin recipients, each honoring their
     personal `seller_submissions` pref, with removed-member/invalid-recipient safety and preserved
     non-blocking failure behavior.
   - Backward-compatible default OFF. Clear workspace-level UI copy distinct from personal prefs.
   - Focused API/query/email tests.
   - If persistence changes are needed, add a focused root migration and mirror in `schema.sql`
     (do not apply live).
3. **Validation + handoff.**

## Acceptance Criteria

- All notification and seller-form switches expose a correct accessible name tied to the visible label.
- The PDF-attachment control is clearly, visibly dependent on submission emails (nested + disabled when
  off) and its disabled state matches the server rule.
- Weekly summary remains unavailable with the verified cron blocker documented; no dead/limbo control is
  shipped as if functional.
- Personal-account preferences and workspace-level routing remain distinctly scoped.
- Seller submission cannot be blocked by notification/telemetry failures (preserved).
- If Model B is approved: routing is server-authorized and org-isolated, tolerant of removed/invalid
  recipients, defaults OFF, has clear UI copy, and is covered by focused tests.
- No arbitrary notification-frequency controls are added.

## Validation

- Focused Vitest (notification prefs, new a11y/dependency tests, and any routing API/query/email tests).
- Changed-file ESLint; `npm exec tsc -- --noEmit`; appropriate `npm run build`.
- Authenticated desktop + mobile browser QA of the Notifications tab; accessibility inspection.
- `git diff --check`.

## Implementation Record (2026-07-17)

- Phase 1 shipped: notification-tab switches now expose accessible names via `id` + `aria-labelledby`
  (seller submissions, PDF attachment, contact resolution). The seller-form meter switch already had an
  `aria-label`. PDF attachment is nested under seller submissions, disabled when submissions are off,
  visually dimmed, with copy that flips to "Turn on Seller submissions to attach…". Weekly summary stays
  unexposed; the stale commented-out block is replaced with a comment documenting the `vercel.json` cron
  blocker.
- Phase 2 shipped (Model B): `organizations.notification_settings` JSONB (migration
  `migrations-organization-notification-settings.sql` + `schema.sql`). Shared helper
  `lib/notifications/workspace-routing.ts` holds the setting key, `normalizeWorkspaceNotificationSettings`,
  and the pure `buildSubmissionRecipients` (dedup by lowercased email, personal `seller_submissions`
  honored, per-recipient PDF pref, forced no-attach when access-locked). Queries
  `updateOrganizationNotificationSettings` + `getOrganizationAdminRecipients` (admins joined live from
  membership, emailless accounts excluded) exported from the queries index. Admin-only, active-org-scoped
  `PATCH /api/organization/notifications` with `organizationNotificationSettingsBodySchema`. Seller route
  builds owner + (when enabled) live admins, sends via `Promise.allSettled` inside try/catch so no send
  can block submission; contact-resolution alerts stay owner-only. Settings "Team notifications" card
  (Team orgs only) with admin-gated toggle wired to the new endpoint; loaded from
  `activeOrganization.notification_settings`.
- Files changed: `app/dashboard/settings/page.tsx`, `app/api/seller/[token]/route.ts`,
  `app/api/organization/notifications/route.ts` (new), `lib/notifications/workspace-routing.ts` (new),
  `lib/neon/queries/organizations.ts`, `lib/neon/queries/index.ts`, `lib/validation/schemas.ts`,
  `schema.sql`, `migrations-organization-notification-settings.sql` (new), and tests
  `tests/unit/workspace-notification-routing.test.ts`, `tests/unit/organization-notifications-route.test.ts`,
  `tests/unit/organization-notification-queries.test.ts`,
  `tests/unit/settings-notifications-accessibility.test.tsx` (all new).
- Validation: focused Vitest 25/25 for the new/related settings suites plus 42/42 seller/email regression
  tests; changed-file ESLint clean; `tsc --noEmit` clean; `npm run build` succeeded; `git diff --check`
  clean. Component tests assert accessible names and the disabled dependency through the accessibility
  tree. Live authenticated desktop/mobile browser QA was not run in this non-interactive session.

## Risks / Non-Goals

- Do not run live migrations, send real emails, commit, push, or deploy without separate authorization.
- Do not invent shared-inbox or free-form recipient behavior (Model C) unless separately approved.
- Do not enable the weekly-summary cron until scheduling infrastructure is dependably configured.
