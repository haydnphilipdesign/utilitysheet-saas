# Teams Upgrade and Workspace Switching Plan

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-08-27
- Source: User-authorized fixes following the existing-user Teams investigation.
- Authorization constraints: Code and local validation are authorized. Do not
  commit, push, deploy, run migrations, modify live Stripe/Neon data, or send
  customer communications without separate authorization.
- Durable decision: `.ai/decisions/2026-08-27-team-billing-ownership-and-workspace-isolation.md`

## Goal

Make Teams safe to adopt from either Free or Pro and safe for an existing user
to join: one subscription after a Pro conversion, unambiguous webhook billing
ownership, continued access to every workspace through an authorized switcher,
and invite return paths that survive credential or OAuth authentication.

## Verified facts

- Free and Pro admins currently see `Start Teams` whenever their active
  organization is not already Team.
- Free starts organization Checkout. Pro currently starts a second
  organization subscription and leaves the account Pro subscription active.
- Personal Pro billing is stored on `accounts`; Team billing is stored on
  `organizations`. The webhook currently resolves a Stripe customer against
  the account first, then the organization.
- Stripe supports changing an existing subscription price by replacing the
  existing subscription item and explicitly supplying the new quantity.
  `create_prorations` records the prorated difference for a later invoice
  without requiring an immediate payment attempt.
- Invite acceptance already verifies exact email, Team status, seat capacity,
  and inserts membership atomically before setting the invited organization
  active.
- Accounts may belong to several organizations, but the dashboard displays
  only the active organization and has no membership-guarded switching route.
- New requests are organization-scoped, so prior-workspace records remain
  stored but are not visible while a different organization is active.
- Stack Auth credential sign-in preserves `next`; OAuth uses the configured
  static callback/after-sign-in route unless the application preserves the
  intended post-auth destination separately.
- No schema change is required for either subscription ownership transfer or
  workspace switching.

## Architecture

### Pro to Teams

- Keep Free-to-Team on Stripe Checkout.
- When the authenticated active-workspace admin has an active Pro subscription,
  retrieve and verify that exact subscription and its single Pro item.
- Replace the item with the Team price and requested quantity on the same
  subscription, using Stripe `create_prorations` and idempotency metadata.
- Mark the subscription as organization-owned in Stripe metadata.
- Atomically copy the Stripe customer/subscription state to the organization
  and clear it from the account. The same idempotent transfer is callable by
  the webhook to recover from route/database races.
- Route webhook events by subscription/session metadata first, with the
  existing customer lookup retained as a backward-compatible fallback.
- Reject unknown/multi-item subscription shapes instead of guessing.

### Existing-user workspace access

- Add a server route that accepts only a target organization ID, derives the
  authenticated account, and atomically updates the active pointer only when a
  live membership exists.
- Add a workspace section to the dashboard account menu. Switching performs a
  full dashboard navigation so all server-derived scope and cached client state
  reload against the selected workspace.
- Keep workspaces isolated. Do not automatically migrate or merge existing
  requests, profiles, defaults, or billing data.
- Explain on invite success that the joined workspace is active and other
  workspaces remain available from the account menu.

### Authentication return path

- Persist only validated same-origin relative destinations in session storage
  immediately before OAuth.
- Consume the destination once from the authenticated dashboard and continue
  to the invite page.
- Preserve `next` when moving between custom sign-in and sign-up pages.

## Expected files and areas

- `lib/stripe/client.ts`, `package.json`, `package-lock.json`
- `app/api/organization/billing/checkout/route.ts`
- `app/api/billing/webhook/route.ts`
- `lib/neon/queries/organizations.ts`, `lib/neon/queries/index.ts`
- `app/api/account/active-organization/route.ts`
- `app/dashboard/layout-content.tsx`
- `app/invite/[token]/page.tsx`
- `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`
- `lib/auth/post-auth-return.ts`
- focused tests under `tests/unit/`

## Phase 1: Regression tests and contracts

- [x] Add checkout tests for Free Checkout, Pro in-place conversion,
  authorization, seat validation, unknown subscription shapes, and failed
  Stripe updates.
- [x] Add webhook tests for metadata-first organization ownership and
  idempotent account-to-organization transfer.
- [x] Add switching query/route tests for authentication, live membership, and
  rejecting another organization's ID.
- [x] Add UI/auth tests for workspace selection and preserved invite return
  paths.

Acceptance:

- Tests reproduce the double-subscription and inaccessible-workspace gaps
  before the implementation is considered complete.
- No client-provided account, role, billing state, or membership is trusted.

## Phase 2: Billing conversion and webhook ownership

- [x] Upgrade the Stripe SDK/API version required by current integration
  guidance and resolve resulting types deliberately.
- [x] Implement verified, in-place Pro-to-Team conversion and the atomic local
  ownership transfer.
- [x] Add metadata to new Team Checkout subscriptions and converted
  subscriptions.
- [x] Make webhook routing metadata-first while preserving legacy fallback.
- [x] Update Billing copy and response handling for direct conversions.

Acceptance:

- Pro conversion creates no second customer or subscription.
- After conversion, only the organization owns the active billing identifiers.
- Repeated route/webhook delivery is idempotent.
- Free Checkout behavior remains functional.

## Phase 3: Workspace switching and invite return

- [x] Implement the membership-guarded active-workspace route/query.
- [x] Render and exercise a workspace switcher in the dashboard account menu.
- [x] Preserve and consume safe OAuth destinations and retain `next` across
  sign-in/sign-up navigation.
- [x] Clarify invite success and workspace separation in the UI.

Acceptance:

- A member can switch between every current membership and cannot select any
  other organization.
- Switching fully reloads organization-scoped data.
- An OAuth sign-in begun from an invite returns to and accepts that invite.
- No existing workspace data is copied, deleted, or silently merged.

## Phase 4: Validation and handoff

- [x] Run focused Vitest first, then the full Vitest suite.
- [x] Run changed-file ESLint, `npm exec tsc -- --noEmit`, `npm run build`,
  `npm run security:scan`, and `git diff --check`.
- [x] Inspect new/changed files directly for secrets and sensitive data.
- [x] Mark the plan complete and update `.ai/CURRENT.md` with exact results,
  remaining risks, and the next action.

## Risks

- Stripe mutation can succeed before the database write. Metadata-first
  webhook recovery and an idempotent transfer query are required.
- Existing legacy subscriptions may not contain exactly one expected Pro item;
  those must stop with a support-oriented error rather than be modified.
- Workspace switching changes the authorization scope for nearly every
  dashboard resource, so a full navigation is required after selection.
- OAuth session storage must accept only a validated relative path and must be
  consumed once to avoid redirect loops or open redirects.

## Completion notes

- Completed 2026-08-27 with no schema migration or production mutation.
- Focused regression suite: 11 files / 45 tests passed.
- Full Vitest suite: 143 files / 731 tests passed.
- Changed-file ESLint, TypeScript, production build, security scan, direct
  untracked-file sensitive-pattern scan, and `git diff --check` passed.
- Full-repository ESLint remains blocked by the pre-existing
  `components/admin/EventLogTable.tsx:6` explicit-`any` error and reports 19
  unrelated warnings. This task added no lint findings.
