# Current Work

> This file is the latest cross-agent handoff.
> Keep it concise, factual, and current.
> Replace stale task information instead of accumulating a permanent chronological log.

## Session Metadata

- Task: Separate Workspace & Team administration from Billing and add workspace rename plus pending-invitation management.
- Status: Completed; no required implementation or validation work remains.
- Current or last agent: OpenAI Codex
- Branch: `main`
- Last updated: 2026-07-17
- Relevant plan: `.ai/plans/2026-07-17-workspace-team-settings.md`
- Source audit: `.ai/plans/2026-07-17-settings-branding-configurability-audit.md`
- Related issue or PR: None known.

## Verified State

- The worktree was clean on `main` at `fab994d` before this task began; the Seller Form Defaults slice is already in repository history.
- Only the root `AGENTS.md` applies; no nested repository guidance exists outside dependencies.
- Settings previously combined Stripe subscription controls, Team checkout/portal links, workspace identity, invitations, and members in the `billing` tab.
- Active organization, role, Team plan, seat quantity, and membership are available from authenticated server-side account/organization queries.
- Pending invitations count toward `getOrganizationSeatUsage` and atomic invite creation.
- Existing invite creation reuses a pending invite but does not resend it; no cancel endpoint exists.
- `updateOrganization` already safely generates a unique slug, but Settings does not expose a dedicated workspace rename route.
- No ownership-transfer or leave-workspace behavior exists in the current model; do not invent it.
- During this task, a separate completed coordination file appeared at `.ai/plans/2026-07-17-seller-form-defaults-live-migration.md`. It records an authorized Seller Form Defaults Neon migration performed by another chat. That file was preserved and did not overlap this implementation.

## Approved Approach

- Add a URL-addressable `workspace` Settings tab and keep Billing limited to subscription, checkout, invoices/payment methods, and Stripe seat management.
- Use authenticated active-organization and membership queries for every action; never accept client authority for organization, role, plan, membership, or seats.
- Add a scoped workspace rename route using the existing organization query.
- Add pending-only invite listing plus invite-by-ID resend/cancel routes scoped to the active organization.
- Rotate invite token and expiry on resend; preserve rate limiting, Team gating, and email failure tolerance.
- Keep current member roles/removal rules and record ownership transfer/leave workspace as future work.

## Work Completed

- Read repository guidance, the prior handoff, completed Settings audit, prior completed implementation plan, current clean status/diff, recent commits, Settings Billing/Team UI, organization queries/APIs, invite tests, and schema.
- Confirmed there is no active unfinished implementation plan or concurrent worktree edit.
- Created the focused implementation plan with phases, acceptance criteria, expected files, validation, risks, and non-goals.
- Added strict Zod validation and an authenticated, active-workspace admin-only rename route.
- Added pending-only invitation listing plus organization-scoped resend/cancel queries and routes.
- Resend rotates token and expiry, preserves rate limiting and Team gating, and tolerates email delivery failure without losing the refreshed link.
- Added a dedicated Workspace & Team Settings tab with workspace rename, seat-reservation copy, individual pending-invite actions, and existing member-role controls.
- Reduced Billing to subscription/Stripe management and Team checkout/seat selection; workspace administration is no longer rendered there.
- Added focused authorization, client-authority rejection, organization-isolation, invite lifecycle, and Settings separation tests.
- Preserved Billing subscription, checkout, portal, invoice/payment-method, and Stripe seat-management behavior; no Stripe route or webhook logic changed.
- Confirmed no schema change was required. Ownership transfer and leave-workspace remain explicit future work rather than invented behavior.

## Files Changed

- `.ai/plans/2026-07-17-workspace-team-settings.md`: completed implementation plan and validation record.
- `.ai/CURRENT.md`: final durable handoff.
- `app/dashboard/settings/page.tsx`: separate Workspace & Team and Billing tabs, rename UI, pending-invite actions, seat copy, and preserved member controls.
- `app/api/organization/route.ts`: active-workspace admin-only rename endpoint.
- `app/api/organization/invites/route.ts`: admin-only pending-invite listing.
- `app/api/organization/invites/[inviteId]/route.ts`: organization-scoped resend and cancel endpoints.
- `lib/neon/queries/organizations.ts` and `lib/neon/queries/index.ts`: pending-invite queries and exports.
- `lib/validation/schemas.ts`: strict workspace-name payload schema.
- `tests/unit/organization-route.test.ts`, `tests/unit/organization-invite-actions-route.test.ts`, `tests/unit/organization-invite-queries.test.ts`, `tests/unit/organization-invites-route.test.ts`, and `tests/unit/settings-workspace-team.test.tsx`: focused authorization, isolation, lifecycle, and information-architecture coverage.

## Validation

- Focused Vitest passed: 9 files, 38 tests.
- Changed-file ESLint passed with no warnings or errors.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed with only the repository's existing baseline-browser-mapping notice and Edge Runtime static-generation warning.
- Authenticated Chrome QA passed on `http://localhost:3005/dashboard/settings` at desktop width and a 390px mobile viewport. Billing was subscription/Stripe-focused and excluded workspace administration. Workspace & Team rendered workspace identity, invitation guidance, and members without document-level horizontal overflow; its tab strip and member table used local overflow containers. No console warnings or errors were observed.
- `git diff --check` passed.
- The authenticated workspace available for QA was single-seat, so live Team pending-invitation rows and mutating resend/cancel actions were not exercised. Focused component and route/query tests cover the Team pending state, authorization, resend/cancel behavior, and organization isolation.

## Remaining Required Work

- None.

## Optional Follow-up

- If a non-production Teams workspace with pending invitations becomes available, manually exercise resend and cancel end to end. This is optional because the server/query/component behavior is covered by focused tests.
- Design ownership transfer and leave-workspace only as a future, separately approved data-model and authorization project.

## Concurrent Editing Warnings

- Preserve the unrelated untracked `.ai/plans/2026-07-17-seller-form-defaults-live-migration.md` coordination file created by another chat.
- This task's changes are limited to organization queries/routes, focused tests, Settings, the implementation plan, and this handoff.

## Recommended Next Action

Review and commit this completed slice only if separately authorized. Do not include or remove the unrelated Seller Form Defaults live-migration coordination file without confirming its intended ownership.
