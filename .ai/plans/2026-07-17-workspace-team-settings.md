# Workspace & Team Settings Implementation Plan

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-07-17
- Source: Completed Settings configurability audit and user-authorized Workspace & Team scope.
- Authorization constraints: Do not commit, push, deploy, run migrations, or modify production data.

## Goal

Separate workspace administration from Billing and let authorized active-workspace administrators rename the workspace and manage pending invitations without weakening Team-plan, seat, membership, or organization-isolation rules.

## Verified repository facts

- Settings is implemented in `app/dashboard/settings/page.tsx`; Billing currently contains both Stripe subscription controls and organization/team administration.
- The active organization is derived server-side from the authenticated account. Organization member and invite routes already enforce membership/admin roles using `getOrganizationMemberRole`.
- Workspace rename already exists as `updateOrganization`, but its current HTTP entry point is the onboarding route and Settings does not expose it.
- Pending invitations count toward `getOrganizationSeatUsage` and the atomic invite-creation guard.
- `GET /api/organization/invites` is admin-only but currently returns all invitations; existing invite creation reuses an active pending invite without resending it.
- Stripe owns subscription, payment method, invoice, and seat-quantity management. No ownership-transfer or leave-workspace model exists.
- The worktree was clean on `main` at `fab994d` before this plan was created. During implementation, a separate completed Seller Form Defaults live-migration handoff appeared at `.ai/plans/2026-07-17-seller-form-defaults-live-migration.md`; it was preserved and did not overlap this task's code.

## Architecture

Add a dedicated `workspace` Settings tab while preserving the existing `billing` tab and Stripe portal/checkout routes. Add a scoped organization rename route and an invite-by-ID route for resend/cancel. Every route derives the active organization, actor account, role, plan, and seat state from authenticated server data; invite queries and mutations include the active organization ID so IDs from another organization cannot be observed or changed.

## Expected files

- Modify `lib/neon/queries/organizations.ts`: pending-invite listing, scoped lookup, resend refresh, and cancellation queries.
- Modify `lib/neon/queries/index.ts`: export the new query helpers.
- Create `app/api/organization/route.ts`: authenticated admin-only workspace rename.
- Modify `app/api/organization/invites/route.ts`: return only active pending invites and keep Team/admin invite creation behavior.
- Create `app/api/organization/invites/[inviteId]/route.ts`: authenticated admin-only resend and cancel actions with organization scoping and resend rate limiting.
- Modify `app/dashboard/settings/page.tsx`: dedicated Workspace & Team tab, rename form, pending-invite rows/actions, member administration, and Billing-only subscription/Stripe content.
- Add or modify focused unit tests under `tests/unit/` for route authorization, organization isolation, invite lifecycle, and Settings information architecture/interactions.

## Phase 1: Server contracts and failing tests

- [x] Add workspace-rename route tests for authentication, active membership/admin authorization, input validation, and rejecting client organization/role identifiers.
- [x] Add invite listing/resend/cancel tests for admin authorization, Team gating, email failure tolerance, and cross-organization invite isolation.
- [x] Add focused Settings tests asserting Billing and Workspace & Team are separate and admin actions render correctly.

Acceptance:

- Unauthorized users and ordinary members cannot rename, resend, or cancel.
- An invitation ID from another organization is treated as not found and is never mutated.
- Tests establish that pending invitations consume seats and that the UI communicates this explicitly.

## Phase 2: Organization queries and APIs

- [x] Implement pending-only invite listing scoped to the active organization.
- [x] Implement scoped invite lookup, token/expiry refresh, and cancellation without a schema change.
- [x] Add the workspace rename route using existing `updateOrganization` and active membership checks.
- [x] Add resend/cancel handlers that preserve Team gating, rate limits, safe email failure behavior, and server-derived organization/role data.

Acceptance:

- Rename returns the updated organization and cannot target a client-selected organization.
- Resend rotates the capability token and expiry for an active pending invite and sends the refreshed link when email delivery succeeds.
- Cancel removes only an active pending invite in the actor's active organization, immediately releasing its seat reservation.
- No Stripe subscription, invoice, payment-method, or webhook behavior changes.

## Phase 3: Settings information architecture

- [x] Add the stable URL-addressable `workspace` tab and rename Billing copy to describe subscription and payment management only.
- [x] Move workspace summary, rename, invitations, pending invitations, and members into Workspace & Team.
- [x] Show pending invitations individually with email, role, expiry/status context, and admin-only resend/cancel actions.
- [x] Preserve member roles and existing role/remove confirmations.
- [x] Keep Team upgrade and Stripe seat management under Billing; link Workspace & Team copy back to Billing where appropriate.
- [x] Record ownership transfer and leave-workspace as future work because the current model does not safely support them.

Acceptance:

- Billing and workspace administration are visibly separate on desktop and narrow/mobile layouts.
- Admins can rename and manage active pending invitations; members see read-only workspace/member context.
- Copy clearly states that active members and pending invitations each reserve one Team seat.
- Existing Team-plan gating and member-role behavior remain intact.

## Phase 4: Validation and durable handoff

- [x] Run focused Vitest route and Settings files.
- [x] Run ESLint on changed TypeScript/TSX files.
- [x] Run `npm exec tsc -- --noEmit`.
- [x] Run `npm run build`.
- [x] Perform authenticated Browser QA on Billing and Workspace & Team at desktop and mobile widths, including an allowed non-production interaction where safe.
- [x] Run `git diff --check`.
- [x] Mark this plan completed and update `.ai/CURRENT.md` with exact files, validation, remaining risks, and next action.

Acceptance:

- Focused tests cover unauthorized actions and organization isolation.
- The production build and type-check pass.
- Authenticated Settings is usable at desktop and mobile widths with no relevant console/runtime errors.
- No migration, commit, push, deployment, or production data action occurs.

## Validation result

- Focused Vitest: 9 files and 38 tests passed, including rename authorization, strict client-authority rejection, pending-invite lifecycle, organization isolation, existing invite acceptance, and Settings regressions.
- Changed-file ESLint passed with no warnings or errors.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed. Output contained only the repository's existing baseline-browser-mapping notice and Edge Runtime static-generation warning.
- Authenticated Chrome QA passed on the local UtilitySheet server at desktop width and a 390px mobile viewport. Billing contained subscription/Stripe content without workspace administration; Workspace & Team showed workspace identity, invitation guidance, and members. The mobile document had no horizontal overflow; the tab strip and member table used local overflow containers. No console warnings or errors were observed.
- `git diff --check` passed. No schema change was required, and this task did not commit, push, deploy, run a migration, or modify production data.
- The authenticated workspace available for QA was single-seat, so live Team pending-invitation rows and their mutating actions were not exercised. Focused component and route/query tests cover the Team pending state, resend/cancel behavior, authorization, and organization isolation.

## Risks and safeguards

- Invite tokens are capabilities. Resend must rotate the token; API responses and logs must not expose unrelated invite data.
- Client-provided organization IDs, roles, plan values, seat counts, and membership claims are never authoritative.
- The active organization and Team status must be re-read server-side for every action.
- Pending-invite cancellation is destructive but recoverable through a new invitation; require confirmation in the UI.
- Ownership transfer and leave-workspace are out of scope and remain future work until a safe server/data model is designed.

## Final integration review (2026-07-21)

- Workspace and Billing remain separate. Rename, invite, membership, notification, and Team billing routes
  continue deriving organization/role/seat/plan state server-side.
- Downstream request and Branding Profile routes now also require the corresponding live membership, closing
  the stale-active-pointer gap after removal. Ownership transfer and leave-workspace remain intentionally
  unsupported pending an approved lifecycle.
