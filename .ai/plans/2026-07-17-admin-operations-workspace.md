# Admin Operations Workspace Refinement Plan

## Status

Completed on 2026-07-17. All four phases are implemented and validated; no required Admin work remains.

## Objective

Refine the existing Admin area into a clear operational support workspace while preserving current routes, data models, authorization, audit logging, billing boundaries, and the `ADMIN_WRITES_DISABLED` safety catch.

## Verified Foundation

- The Admin area is a server-rendered Next.js route group with client components for authenticated actions.
- Existing user plan actions update `accounts.subscription_status`; they do not change Stripe subscriptions.
- Team access is derived from an active workspace whose `subscription_status` is `team`; no additional organization-membership semantics are available.
- Auth reconciliation already provides a read-only preview and a guarded POST sync, but the client has no timeout and hides the healthy zero-pending state.
- Request, workspace, and abandonment pages already expose the required underlying data; this task changes hierarchy, naming, presentation, and shared controls rather than adding schema or live automation.
- The previous `/dashboard` refinement is committed locally and remains paused only for authenticated browser QA. Its files are outside this task and must be preserved.

## Phase 1: Navigation, Shell, and Operational Overview

Status: Complete.

- Group existing routes under Operations, Customers, Growth & Content, and Security without changing URLs.
- Use a neutral dense-workspace background while retaining the red Admin Control identity.
- Rebuild `/admin` so the first viewport prioritizes attention items, then activation/recent usage, then paid/customer health.
- Remove vanity totals from the primary hierarchy and link actionable metrics to their operational destinations.
- Treat referral-loop reporting with no observations as an explicit instrumentation/data state instead of four zero cards.
- Add a visible text summary for request-status chart data.

Acceptance criteria:

- The first screen communicates what needs attention and where an operator can act.
- Existing routes remain stable and navigation remains horizontally usable at narrow widths.
- All-zero or unavailable referral instrumentation cannot be mistaken for working zero-valued reporting.
- The request-status chart has an equivalent text summary.

## Phase 2: Customer and Request Operations

Status: Complete.

- Condense User Management account summaries.
- Give auth reconciliation clear checking, healthy, actionable, timeout/failure, refresh, and safe retry states using the current preview/sync endpoints.
- Extract shared user controls used by both the list drawer and full user profile.
- Rename account plan writes to `Entitlement override` and state plainly that they update UtilitySheet access only, not Stripe billing.
- Preserve action reasons, server authorization, policy checks, audit logs, Team-managed blocking, and `ADMIN_WRITES_DISABLED` behavior.
- Improve request list/detail hierarchy and add accessible names/tooltips to unavoidable icon-only inspection actions.

Acceptance criteria:

- List preview and full user detail expose the same supported controls.
- No entitlement action can be mistaken for a Stripe subscription change.
- Reconciliation cannot spin indefinitely without status or recovery guidance.
- Request inspection actions remain clear, keyboard reachable, and non-mutating during QA.

## Phase 3: Workspaces and Seller Progress Monitoring

Status: Complete.

- Rename Organizations to Workspaces in admin-facing copy while preserving `/admin/organizations` URLs.
- Classify existing rows as personal/default workspaces or Team organizations using only subscription, seat, and membership data already returned by current queries.
- Rewrite abandonment terminology into factual seller-progress language.
- Map internal event identifiers to human-readable stages in the primary view and retain identifiers only in a secondary technical disclosure.
- Surface existing request inspection and reminder capabilities without sending communications during QA.

Acceptance criteria:

- Personal workspaces are not counted or described as equivalent to Team adoption.
- Seller stages are understandable without event identifiers or judgmental language.
- Technical event details remain available for support diagnosis.
- Existing recovery actions are discoverable but no recovery communication is sent automatically.

## Phase 4: Focused Coverage, Full Validation, and Handoff

Status: Complete.

- Add or update focused tests for shared user controls, reconciliation states, instrumentation visibility, workspace classification, abandonment labels, and accessible action names.
- Run focused Vitest files, task-scoped ESLint, `npm run lint`, `npm exec tsc -- --noEmit`, `npm run build`, and `git diff --check`.
- Use the available Browser workflow for non-mutating desktop and narrow responsive QA; do not trigger admin writes, reminders, billing changes, or other live mutations.
- Review the final diff, mark this plan completed, and update `.ai/CURRENT.md` with exact validation and residual risk.

Acceptance criteria:

- Focused tests pass and broader validation either passes or isolates unrelated baseline failures.
- Desktop and narrow layouts remain usable without clipped navigation or actions.
- Browser QA proves page identity, meaningful render, no framework overlay, console health, responsive layout, and safe interactions.
- No commit, push, deploy, migration, schema change, production-data modification, or live admin mutation occurs.

Validation results:

- Combined focused Vitest coverage passed: 9 files and 25 tests.
- Task-scoped ESLint passed for every changed Admin, shared theme, helper, and focused test file.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Full `npm run lint` remains blocked only by six pre-existing `no-explicit-any` errors outside the changed Admin scope; task-scoped lint is clean.
- `git diff --check` passed with only line-ending notices.
- Authenticated Chrome QA passed on `/admin`, `/admin/users`, `/admin/requests`, `/admin/organizations`, and `/admin/abandonment` at desktop and narrow widths. Navigation and the user-management drawer were exercised without triggering writes.
- A Base UI hydration warning on the shared theme trigger was isolated during QA and removed for Admin by supplying a stable trigger ID.

## Expected Files and Areas

- `.ai/CURRENT.md`
- `.ai/plans/2026-07-17-admin-operations-workspace.md`
- `ADMIN.md`
- `app/(admin)/layout-content.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/users/`
- `app/(admin)/admin/requests/`
- `app/(admin)/admin/organizations/`
- `app/(admin)/admin/abandonment/page.tsx`
- `components/admin/`
- `lib/admin/`
- focused files under `tests/unit/`

## Constraints and Risks

- Do not change Stripe subscriptions or imply that entitlement overrides do so.
- Do not invent organization membership, workspace types, analytics, abandonment events, or recovery automation.
- Do not weaken admin authorization, reason validation, audit logging, policy checks, or the write safety catch.
- Do not edit testimonials, product-update publishing, or audit-log redesign in this task.
- Preserve the two local commits ahead of `origin/main` and all unrelated customer-dashboard work.
