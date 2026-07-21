# Account Settings and Settings/Branding Integration Review

- Status: Implementation complete; authorized migration and GitHub main publication in progress
- Owner: OpenAI Codex
- Date: 2026-07-21
- Branch: `main`
- Source: User-requested completion of the Account settings investigation and final integration review of the Settings and Branding Profile work.
- Authorization constraints: Do not implement account-management behavior before the approval gate. Do not commit, push, deploy, run migrations, modify production data, send external messages, or perform destructive account actions without separate explicit authorization.

## Goal

Establish the account-security and account-closure lifecycle that the installed Stack Auth SDK and current UtilitySheet data model can safely support, obtain user approval for the exact implementation slice, then complete a focused integration review of Settings and Branding Profile behavior without unrelated refactoring.

## Verified starting state

- `main`, `origin/main`, and `HEAD` are aligned at `46169fc`; the worktree was clean at task start.
- The original configurability audit and the completed Seller Form Defaults, Workspace & Team, Notifications, and Branding Profiles plans have been read in full.
- The accumulated settings/branding work is committed; there is no uncommitted diff. The review range begins before the Seller Form Defaults commit and includes the later self-serve test-drive integration where it touches Branding Profile defaults or output behavior.
- The repository currently tracks generated audit/test artifacts: `.audit-overflow.mjs`, `.audit-shots.mjs`, `playwright-report/index.html`, and `test-results/.last-run.json`. Their provenance and safe cleanup must be reviewed; no deletion is authorized merely by this plan.
- Account-management capabilities and closure semantics have not yet been approved. No password, session, export, or deletion UI/API may be added until repository and installed-SDK evidence is documented and the user approves the lifecycle.

## Phase 1: Account capability and lifecycle investigation (approval gate)

- Inspect the installed Stack Auth package version, server/client APIs, generated types, and existing UtilitySheet auth/account integration.
- Trace billing/subscription state, organization ownership/membership/invitations, requests, capability links, packets, referrals, audit/event records, and deletion constraints from schema, migrations, queries, routes, and tests.
- Document supported, conditionally supported, and unsupported controls for email, password/sign-in methods, sessions, data export, and closure.
- Propose a staged account-closure lifecycle with reauthentication, server-derived authorization, confirmations, auditability, billing safeguards, workspace safeguards, retention/anonymization rules, and recovery/irreversibility boundaries.
- Stop for explicit user approval before implementing any account-management slice.

Acceptance:

- Every requested capability and data domain is tied to current repository or installed-SDK evidence.
- Unsupported Stack Auth behavior and unresolved product/legal decisions are stated plainly.
- The proposal names exact in-scope behavior and explicit non-goals for the post-approval slice.
- No fake password/session UI, destructive route, external billing mutation, or production action is performed.

## Phase 2: Final Settings and Branding integration review

- Review Account, Seller Form Defaults, Notifications, Workspace & Team, Billing, Referrals, Branding Profiles list/editor, PDF Content, and message templates/previews as one product.
- Trace ownership/default precedence, existing-account/link compatibility, organization and token isolation, plan gating, schema/migration parity, and PDF/email/seller-form/web-packet consistency.
- Perform fresh authenticated desktop/mobile browser capture for the user-facing UX/accessibility audit when a safe local session is available; name any blocked states instead of overclaiming.
- Identify only defects caused by or required to complete these settings slices. Defer unrelated refactors.

Acceptance:

- Personal, workspace, reusable-form, request, and Branding Profile ownership is unambiguous in code and UI.
- Defaulting and fallbacks do not contradict each other.
- Organization-scoped and capability-token paths do not disclose or mutate cross-scope data.
- Plan gates match server behavior, and all listed UI controls have bounded accessibility and responsive evidence.
- `schema.sql` matches focused migrations, and no secrets or generated artifacts remain in the reviewed source set.

## Phase 3: Approved implementation and validation

- Implement only the user-approved account-management slice and directly necessary integration fixes.
- Add or update focused tests for each changed domain, then run the complete Vitest suite, lint, TypeScript, production build, security scan, relevant desktop/mobile Playwright flows, `git diff --check`, and direct sensitive-data inspection of every new untracked file.
- Update all relevant plans and `.ai/CURRENT.md` with exact results, remaining risks, and whether required work remains.

Acceptance:

- Approved mutations require recent reauthentication or an explicitly verified equivalent, server-side authorization, typed confirmation, auditable state changes, and safe billing/workspace preconditions.
- Directly relevant integration defects are fixed with focused diffs and regression coverage.
- Validation results and evidence limits are recorded without claiming blocked browser or production behavior.

## Approval and current action

- On 2026-07-21 the user approved the recommended non-destructive Account security/data slice.
- Implementation may cover configuration-aware sign-in controls, password change/reset, other-session
  revocation, verified primary-email change and personal account reconciliation, active-session viewing,
  personal data export, and closure readiness/preflight only.
- Executable closure, Stripe cancellation, workspace asset transfer/deletion, account tombstoning, Stack
  user deletion, and any live migration remain out of scope without separate explicit authorization.
- Current action: implement the approved slice, complete the focused Settings/Branding integration review,
  then run the full requested validation matrix.

## Phase 1 evidence and proposal (2026-07-21)

### Installed and configured Stack Auth capabilities

- Installed package: `@stackframe/stack` 2.8.56. The application constructs `StackClientApp` and
  `StackServerApp` with Next.js-cookie token storage; the current Account tab uses only
  `useUser()`/`signOut()` and shows Stack's primary email as a disabled value.
- The installed SDK exposes contact channels, password update/set, active-session listing/revocation,
  OAuth-provider listing/update/delete, passkey registration, and user deletion. Stack's built-in
  `AccountSettings` component also includes all of these areas plus a direct delete action.
- An initial raw public-config inspection suggested credentials only. Runtime verification through the
  same installed `StackServerApp.getProject()` path used by the application reported Google as enabled,
  and Safari rendered it while Chromium stalled in Stack's suspense-backed project hook. The runtime
  server result is authoritative for product rendering. Login/signup now fetch a no-store public subset
  of that server-derived config, fail closed when it is unavailable, and render only configured methods.
- The built-in Stack delete UI is not safe for UtilitySheet. In this SDK it performs a Stack user
  deletion after a simple confirmation and has no UtilitySheet billing, organization, referral,
  request/public-link, retention, or audit safeguards. It is hidden by the current Stack project
  config and must remain unused.

### Capability matrix

| Requested control | Current support | Proposed behavior |
| --- | --- | --- |
| Change password | Supported for a password user by `updatePassword({ oldPassword, newPassword })`; credentials are enabled. | Use Stack's old-password verification and password rules. After success, offer/perform revocation of every other Stack session. Never send or store the password in UtilitySheet logs or data. |
| Set password for a legacy passwordless user | SDK `setPassword()` exists, but it is not a sufficient step-up proof by itself. | Do not set inline without reauthentication. Send the verified primary email through Stack's password-reset flow and return to Account settings. |
| Change email | Supported as add contact channel -> verify -> mark primary/sign-in. There is no single atomic UtilitySheet method. | Require a recent Stack credential session, add the new address as non-primary/non-sign-in, verify it through Stack, then make it primary and usable for sign-in. Keep the old sign-in email until the new one is verified. Immediately reconcile `accounts.email`; update only the personal Stripe customer email, never Branding Profile contact email or organization billing identity. |
| Sign-in methods | SDK supports OAuth/passkeys/OTP when configured, but this project currently has only email/password. | Show only methods enabled by live project config and the user's state. Hide the currently unsupported Google/passkey/magic-link controls. Defer connection/removal of OAuth providers until a provider is configured and last-sign-in-method safeguards are verified. |
| Active sessions | Supported by `getActiveSessions()` and `revokeSession(id)` with current-session, timestamps, impersonation, and geo metadata. | List current/other sessions, allow confirmed individual or all-other revocation, never allow revoking the current session through that control, and keep ordinary Sign Out for the current session. Server routes must confirm the session ID belongs to the authenticated Stack user. |
| Account-data export | No current UtilitySheet export route or SDK feature covers application data. | Add a rate-limited, no-store, recent-authenticated export generated on demand. Include the user's UtilitySheet account/profile/preferences, memberships, account-owned Branding Profiles and seller-form defaults, owned requests/responses/timeline, and referral/attribution summaries. Exclude passwords, Stack/Stripe/capability tokens, raw IP/user-agent data, secrets, and other members' records. Treat full workspace export as a separate admin-only future feature. |
| Close/delete account | Stack server deletion is technically available even though client deletion is disabled. The UtilitySheet database cannot safely hard-delete an arbitrary account today. | Do not expose direct deletion. Implement a durable closure state machine only after the lifecycle/retention decisions below are approved. Stack deletion is the final external step, never the first. |

### Verified UtilitySheet deletion boundaries

- Live Neon catalog verification matches the important schema delete rules: account deletion cascades
  organization membership, created Branding Profiles, requests, reusable intake link, growth
  attribution, and activation-outreach rows. Request deletion cascades seller utility entries and
  request event logs. AI telemetry and some outreach/product-update references are retained with a
  null account/request reference.
- A direct account delete is blocked when the account appears as an admin/target in
  `admin_audit_logs` or as referrer/referred user in `referral_credits` because those foreign keys use
  `NO ACTION`.
- Organization invitations created by the user keep the organization invite but null the inviter.
  Organizations themselves are not owned by a dedicated owner column; authority is only
  `organization_members.role = admin|member`. Every activated account normally gets an organization,
  but a shared organization can outlive a departing member.
- Shared-workspace assets still carry creator/owner `account_id`: deleting an account can remove
  organization-scoped Branding Profiles and requests that other members currently use. Those assets
  must be transferred to a surviving admin before the account row is anonymized or removed.
- `schema.sql` describes `accounts.active_organization_id` but omits the live/migration foreign key
  (`ON DELETE SET NULL`). This is a confirmed final-integration defect to fix after the approval gate.
- Stripe is the source of truth. Personal Pro billing belongs to `accounts.stripe_customer_id`; Team
  billing belongs to `organizations.stripe_customer_id`. Current webhook handling keeps a scheduled
  cancellation paid until Stripe reports the subscription inactive/deleted.

### Proposed closure lifecycle

1. **Preflight (read-only):** derive the Stack user and UtilitySheet account server-side; require a
   verified primary email and a Stack current session created within five minutes; show personal Pro,
   every workspace role/admin count/member count, Team subscription state, pending invitations,
   owned personal/shared assets, referral-credit state, and audit/retention consequences.
2. **Export and confirmation:** offer the no-store account export before closure. Require the exact
   verified email plus `CLOSE MY ACCOUNT`; require a fresh password sign-in directly through Stack so
   UtilitySheet never receives the password.
3. **Billing guards:** do not automatically cancel Stripe in the first closure version. Block a personal
   Pro account until its subscription has been canceled through the portal and the webhook reports it
   inactive. A user may leave a Team-billed workspace only when another admin remains. A sole member
   of a Team-billed workspace is blocked until the Team subscription is inactive.
4. **Workspace resolution:** for a workspace with other members, require another admin and transfer the
   departing user's organization-scoped Branding Profiles and requests to a designated surviving admin,
   preserving public packet/seller links and request history. Then remove the membership and null
   `invited_by_account_id` on surviving invites. For a sole-member, non-billed workspace, delete the
   organization and its invitations; personal request/public/intake links become invalid.
5. **Referral and audit retention:** promotional credits are not cash and do not transfer. Unapplied
   earned credits expire on closure (requires explicit product approval); retain the ledger, Stripe
   balance-transaction references, and admin/lifecycle audit records against a pseudonymous account
   tombstone. Scrub names, email, phone, company, notification settings, and free-form audit metadata
   that is not required for security/financial retention.
6. **Durable state and cleanup:** add an account lifecycle state (`active`, `closing`, `closed`) and a
   focused lifecycle audit record before deleting data. `closing` must block normal activation so a
   partial failure cannot recreate defaults. In one database transaction, delete personal requests,
   seller responses, intake link, personal profiles, growth attribution, and outreach data; transfer
   approved shared assets; revoke pending invitations addressed to the closing email; pseudonymize the
   retained account tombstone.
7. **External finalization:** revoke every Stack session, then delete the Stack user through the server
   SDK. If Stack deletion fails, keep the account in `closing`, deny normal application access, and
   record a retryable failure. Mark `closed` only after external deletion succeeds. Do not delete the
   Stripe customer/financial ledger automatically.

### Recommended approval scope

Implement the low-risk Account security/data slice first:

1. configured-method-aware Account UI and auth-button correction;
2. password change/reset and other-session revocation;
3. verified primary-email change with UtilitySheet/personal-Stripe reconciliation;
4. active-session viewing/revocation;
5. personal account-data export;
6. closure preflight/readiness UI only, with no destructive action.

Defer executable closure until the user separately approves the tombstone/retention policy,
unapplied-referral-credit forfeiture, automatic transfer of shared requests/profiles to another admin,
and the required lifecycle schema migration. This keeps the supported security controls moving without
pretending the unresolved destructive lifecycle is safe.

## Implementation and final integration result

- Added recent-authenticated Account security, verified-email lifecycle, direct-to-Stack password change,
  active-session review/revocation, personal JSON export, and read-only closure readiness. No executable
  delete/close control exists.
- Added a focused `account_security_events` migration and matching `schema.sql`; the user subsequently
  authorized and the agent transactionally applied it to the configured Neon target. The accepted durable
  boundary is recorded in `.ai/decisions/2026-07-21-account-security-and-closure-boundary.md`.
- Fixed Account display-name reconciliation so activation cannot overwrite a database-only profile edit.
- Fixed stale active-workspace scope across request list/create/detail/edit/remind/submitted-data,
  Branding Profile list/create/read/update/delete/duplicate, reusable-form request creation, onboarding,
  test-drive creation, Team entitlement checks, and weekly-summary selection. Live membership now gates
  organization resources; personal resources remain owner-only. Request creation rejects a client-selected
  Branding Profile outside the authenticated active scope.
- Rechecked ownership/default precedence across Account, Seller Form Defaults, Notifications, Workspace &
  Team, Billing, Referrals, Branding Profiles, PDF Content, and messages/previews. Reusable defaults still
  affect new requests only; request snapshots and public capability URLs remain stable; branded PDF,
  email, seller-form, and web-packet consumers retain the existing profile/request precedence and plan gates.
- Mirrored the existing `accounts.active_organization_id -> organizations.id ON DELETE SET NULL` focused
  migration shape in `schema.sql`. Focused Settings/Branding migration columns, constraints, indexes, and
  backward-compatible defaults match the snapshot.
- Removed tracked generated audit/Playwright artifacts and added ignore rules so reruns do not reintroduce
  them as source.

## Final validation

- Focused account/auth/isolation and Settings/Branding suites passed throughout; final isolation set: 7 files,
  38 tests. Final full Vitest: 127 files, 627 tests passed.
- Playwright: configured auth 6/6, intake 6/6, packet responsiveness 3/3, and seller wizard 6/6 across
  Desktop Chrome, Mobile Chrome, and Mobile Safari. Two Desktop Chrome intake navigations timed out in an
  initial highly parallel combined run; the immediate all-project rerun passed 6/6.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run security:scan`, and changed-file ESLint passed.
- Repository-wide `npm run lint` remains non-zero only for the pre-existing, unrelated
  `components/admin/EventLogTable.tsx:6` explicit-`any` error; 20 existing warnings remain. It was not
  changed because this task forbids unrelated refactors.
- Fresh in-app screenshot capture was blocked by the desktop browser's localhost URL policy. CLI Playwright
  supplied desktop/mobile functional, accessible-name, overflow, and journey evidence, but no fresh visual
  screenshot audit is claimed.
- Final `git diff --check` passed. Direct inspection found no secret/sensitive pattern in any of the
  21 untracked files, and the temporary local server was stopped.

## Remaining risk and required work

- Required implementation work for the approved slice: none.
- The authorized `migrations-account-security-events.sql` migration is applied, so durable database audit
  rows are available; structured server logging remains the failure fallback.
- Stack-primary-email change precedes UtilitySheet/Stripe reconciliation, so a database or Stripe outage can
  require retry/reconciliation; Stripe sync is intentionally best-effort and audited as attempted.
- Executable account closure remains intentionally unavailable pending the separately approved lifecycle
  decisions and migration described above.

## Publication authorization (2026-07-21)

- The user explicitly authorized applying only `migrations-account-security-events.sql` to the configured
  Neon target and pushing the accumulated reviewed Settings/Branding work to GitHub `main`.
- Required procedure: sanitized `.env.local` target confirmation, transactional migration, catalog/index
  postflight, final secret/artifact/diff checks, commit, `origin/main` ancestry proof, `HEAD:main` push, and
  remote SHA verification. No deployment or other production mutation is authorized.
- Migration result: the table did not exist before execution; both statements committed together. Postflight
  verified all six columns/defaults, the primary key, action/status checks, the `accounts(id) ON DELETE SET
  NULL` foreign key, and the `(account_id, created_at DESC)` index. Initial row count was zero.
