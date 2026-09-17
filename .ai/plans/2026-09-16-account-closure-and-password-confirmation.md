# Plan: Account password confirmation and self-serve account closure

## Status

- Phase A (password-confirmation wording): **Completed**, Claude Code, 2026-09-16.
- Phase B (executable closure): **Completed and validated locally 2026-09-16** (OpenAI Codex takeover from Claude Code). The approved lifecycle below incorporates the owner's billing and transfer-target decisions. Decision record: `.ai/decisions/2026-09-16-self-serve-account-closure-lifecycle.md`.
- Authorization: local code, docs, and tests only. No commit, push, deploy, live migration, production data change, Stripe mutation, real account deletion, or real email.
- Supersedes the "executable closure deferred" clause of `.ai/decisions/2026-07-21-account-security-and-closure-boundary.md` only after approval.

## Verified current state (2026-09-16)

- `components/settings/account-security.tsx` renders "Sign-in & security" and "Data controls". "Data controls" has a JSON export and a read-only "Account closure readiness" card. No closure action exists.
- `lib/account/security.ts` enforces recent auth: the current Stack session must be less than five minutes old. Password confirmation works by calling `signInWithCredential` from the browser, which creates a new session. The password never reaches UtilitySheet servers.
- **Accounts without a password.** Google OAuth is enabled for this project. For a user with no password, the "Verify identity" button is disabled and the only hint says to sign out and back in. If the five-minute window expires while the page is open, a 403 opens a password dialog that this user cannot complete.
- `/auth/login?next=/dashboard/settings?tab=account` already returns a user to Account settings after email or Google sign-in (`normalizePostAuthReturnTo`).
- **Single activation gate.** Every authenticated route and the dashboard layout reach the account through `ensureAccountRecord` (`ensureAccountActivation` or `getOrCreateAccount`). It **recreates** an account for a Stack user with no row. It also lets a new sign-up **claim** any row with `auth_user_id IS NULL` and a matching email.
- **Foreign keys (`schema.sql`).**
  - Deleting an `accounts` row cascades memberships, Branding Profiles, requests (and so utility entries and event logs), the intake link, question requests, growth attribution, and activation outreach.
  - `admin_audit_logs` and `referral_credits` reference accounts with `NO ACTION`, so a referenced account row cannot be hard-deleted.
- **Shared workspaces.**
  - Organization-scoped requests and profiles are visible to every member by `organization_id`, but still carry the creator's `account_id`.
  - Seller submission uses the request owner's account for Pro status, Free metering, notification email, contact-resolution email, and the referral award (`app/api/seller/[token]/route.ts`).
  - Removing a member today leaves their workspace records in place.
- **Workspace authority** comes only from `organization_members.role`. The existing member API refuses to remove or demote the last admin.
- **Billing.**
  - Personal Pro is on `accounts`; Team is on `organizations`.
  - The webhook routes by subscription metadata, then by customer.
  - `syncOrganizationSubscription` and `syncAccountSubscription` **throw** when the organization or account row is missing. Deleting a workspace with a live Team subscription would therefore make Stripe retry the webhook.
- **Referral credits.**
  - Credits are `earned` or `applied`.
  - `applyEarnedReferralCredits` needs the account's Stripe customer and an active subscription.
  - Applied credits already sit as a Stripe customer balance.
- **Public links.**
  - `/s/[token]` and `/packet/[token]` resolve through `getRequestByToken` / `getRequestBySellerToken` (`deleted_at IS NULL`). A hard-deleted request gives the existing not-found behavior.
  - `/i/[slug]` resolves through `intake_links`.
  - Packets read the Branding Profile live, not from a snapshot.
- **Logos** are public Vercel Blob objects at `brand-logos/<stackUserId>/<timestamp>.<ext>`. A transferred shared profile can point at one, so a prefix-wide delete would break shared logos.
- **Stack Auth 2.8.56.** `ServerUser.delete()` exists. Deleting the Stack user ends every session.
- **Platform admins** (`accounts.role = 'admin'`) and support impersonation sessions (`session.isImpersonation`) exist.
- The privacy policy and terms say nothing about deletion or retention. No legal retention requirement is known or assumed.
- **Concurrency.** The dialog-focus task (another session) owns `components/ui/dialog.tsx`, `components/test-drive/TestDriveCard.tsx`, `app/test-fixtures/`, and `tests/dialog-focus.spec.ts`. This task uses `Dialog` but must not edit those files.

## Phase A: Password confirmation (no approval needed)

- Rename "Verify identity" to "Confirm password" everywhere: the button, dialog title and description, submit label, toasts, the 403 prompts, and the server `RECENT_AUTH_REQUIRED` message.
- Plain explanation: "Re-enter your password to view and change sign-in settings. They stay unlocked for five minutes."
- **Accounts without a password:**
  - Show "Sign in again" instead of a disabled button. It signs out and returns to `/auth/login?next=/dashboard/settings?tab=account`.
  - Explain that the five-minute window starts at sign-in.
  - When a later action hits a 403, the dialog shows the same sign-in-again path, not a password field.
- Server enforcement is unchanged.
- **Tests:** component tests for the password and no-password states, the dialog wording, and the wrong-password message.

## Phase B: Approved closure lifecycle

### What the user sees

1. **Account settings > "Close account"** card, replacing "Account closure readiness". It gives a one-paragraph summary of what closure does and a "Review and close account" button.
2. **Confirm password** (Phase A flow), or sign in again for password-less accounts. The closure review is only available within the five-minute window, and the final submit rechecks it on the server.
3. **Review step**, loaded fresh from the server:
   - **Blockers**, each with a plain explanation and a direct link to fix it (Billing tab, Workspace & Team tab, or support email). "Close account" stays disabled while any blocker exists.
   - **What happens**, shown as counts and names:
     - personal requests and seller links that will stop working (open ones flagged);
     - workspaces that will be deleted;
     - workspaces you will leave, with the admin who will receive your shared requests and Branding Profiles;
     - referral credits that will be forfeited.
   - **Download your data first**: the existing export button. It is optional.
4. **Final confirmation**:
   - type your sign-in email;
   - tick "I understand this is permanent and can't be undone";
   - press "Close account permanently".
5. **Result**:
   - Success: signed out and sent to a public `/account-closed` page ("Your UtilitySheet account is closed", what was removed, how to contact support).
   - Partial failure: the same page in a "finishing up" state with a Retry button and a support contact.

### Eligibility (server-computed at review and again at submit)

Each blocker is shown with the route to resolve it.

- **Session.** Recent sign-in is required. A support impersonation session is refused.
- **Platform admin.** `role = 'admin'` is refused: "Ask another UtilitySheet admin to remove your admin access first."
- **Personal Pro, checked live with Stripe.** Closure is blocked for `past_due`, `unpaid`, or `incomplete`, and while billing cannot be verified. Otherwise UtilitySheet cancels it immediately during closure, without refund or proration.
- **Team-billed workspace where you are the only member.** The same live status check and immediate cancellation rule applies. Shared-workspace Team subscriptions are not touched.
- **Shared workspace (other members).**
  - If you are the only admin, closure is blocked: "Make another member an admin in Workspace & Team."
  - Team billing stays with the workspace and does not block you.
- **Pending invitations addressed to you** do not block. They are revoked.

### Data handling

**Kept, as a pseudonymous tombstone.** The `accounts` row stays, keeping only `id`, `auth_user_id`, Stripe customer/subscription references, role, and timestamps.
- Scrubbed: `email` becomes `closed+<id>@closed.utilitysheet.invalid`; `full_name`, `company_name`, and `phone` are cleared; `notification_preferences` becomes `{}`; `active_organization_id` is cleared.
- Why keep the row:
  - `referral_credits` and `admin_audit_logs` need it (`NO ACTION`);
  - Stripe webhooks and support need to resolve the customer;
  - keeping `auth_user_id` stops `ensureAccountRecord` from recreating the account while Stack deletion is pending;
  - the scrubbed email stops a new sign-up from claiming the row.

**Transferred.** In each workspace that has other members, your requests and Branding Profiles there (`organization_id` = that workspace) move to the surviving admin selected by the user. The earliest-joined remaining admin is preselected.
- Their public seller and packet links keep working.
- Future seller notifications for those requests go to that admin.

**Deleted**, in one database transaction:
- Workspaces where you are the only member: the organization row. Its invitations and your membership cascade, and its requests and profiles become personal and are then deleted.
- All memberships in shared workspaces.
- Personal requests (`organization_id IS NULL`), with their utility entries and event timeline. Seller and packet links then return the existing not-found page.
- Branding Profiles that were not transferred, and your reusable seller link (`/i/[slug]` then shows not found).
- Question requests, growth attribution, and activation-outreach rows.
- Pending invitations addressed to your email.
- `invited_by_account_id` is set to null on invitations you sent to surviving workspaces.

**Deleted after commit, best effort and retried.**
- Logo blobs referenced only by deleted profiles. Logos referenced by transferred profiles or `organizations.logo_url` are kept.
- The Stack Auth user, which removes the sign-in, sessions, and contact channels.

**Forfeited.** Unapplied (`earned`) referral credits get the new status `forfeited`. Credits already applied stay as Stripe customer balance (Stripe is not changed).

**Retained unchanged.**
- The referral ledger, where you are referrer or referred. The other party's credit stays valid.
- `admin_audit_logs`, `account_security_events` (metadata is already PII-free), and closure events.
- Redacted AI telemetry.
- The Stripe customer, invoices, and payment history. UtilitySheet does not delete or edit Stripe records.

**Testimonial outreach logs** about you: recipient name cleared and email replaced with the tombstone address.

### Timing and recovery

- **Recommended: immediate and irreversible.** There is no grace period. Deleted data cannot be restored by support. The optional export plus typed confirmation are the safeguards.
- Why: a recovery window would keep personal and seller data live while the account looked closed. It would need a scheduled finalizer, a cancel-closure path, and rules for public links during the window. None of that exists, and the billing rules already keep renewals from happening.
- Alternative for the owner to consider: a 14-day window in which you can't sign in to use the app, public links are paused, and signing in offers "Cancel closure". Finalization would then run from a cron.

### State machine, idempotency, and partial failure

- New columns `accounts.closure_status` (`active` | `closing` | `closed`), `closure_requested_at`, and `closed_at`.
- New table `account_closures`: one row per account with `step`, `attempt_count`, `last_error_code`, `transferred_to_account_id`, a PII-free `summary`, and timestamps.
- `POST /api/account/closure`:
  - Accepts the typed email and acknowledgement.
  - Requires recent auth, rate-limits, and recomputes eligibility.
  - **Claim:** `UPDATE accounts SET closure_status='closing' WHERE id=$1 AND closure_status='active'`. This is atomic, so a double submit cannot start twice.
  - **Step `data_removed`:** one `sql.transaction([...])`, every statement guarded by `closure_status='closing'`.
    - Workspace deletion is guarded by "still exactly one member".
    - Transfers are guarded by "target is still an admin member".
    - If a guard fails, the affected records simply stay with the tombstone (nothing cascades, because the account row is never deleted). The step is marked and later reported.
  - **Step `assets_removed`:** blob cleanup; failures are logged but do not block.
  - **Step `auth_deleted`:** `stackUser.delete()`. On failure, the account stays `closing` with `last_error_code`.
  - **Final:** `closed`, `closed_at`, a security event, then a confirmation email to the pre-scrub address. The address is captured before the transaction and is not stored afterwards; email failure does not fail closure.
- **Retry.** A repeated POST while `closing` resumes from the recorded step. When `closed`, it returns 200 "already closed".
- **Blocking during closure.**
  - `ensureAccountRecord` returns no account for `closing` or `closed`. All app APIs then give their existing 404 or 401, and the dashboard layout sends the user to `/account-closed`, not to login, which would loop.
  - `/api/account` returns `409 ACCOUNT_CLOSING`, so the login page routes to `/account-closed`.
  - `getAccountSecurityContext({ allowClosing: true })` is used only by the closure route.
- **Recovery for stuck closures.**
  - The user can press Retry on `/account-closed` while their Stack session still exists.
  - A cron (`/api/cron/account-closure-retry`, `CRON_SECRET`) retries `closing` rows older than 15 minutes, up to 5 attempts, then logs `closure_stuck` for support.
  - Support can see closure status on the admin user page (read-only).
- **Webhook tolerance.** Subscription events for a `closed` account, or a Team subscription whose organization was deleted by closure, are acknowledged with 200 and logged, not thrown.

### Files expected (Phase B)

- New: `migrations-account-closure.sql` and the `schema.sql` mirror; `lib/account/closure.ts` (eligibility plus executor); `lib/neon/queries/account-closure.ts`; `app/api/account/closure/route.ts` (GET review, POST execute); `app/api/cron/account-closure-retry/route.ts`; `app/account-closed/page.tsx`; `components/settings/account-closure.tsx`.
- Changed: `components/settings/account-security.tsx`; `lib/account/security.ts`; `lib/neon/queries/accounts.ts`; `lib/neon/queries/account-data.ts` (event actions); `app/dashboard/layout.tsx`; `app/api/account/route.ts`; `app/auth/login/page.tsx` (closing redirect); `app/api/billing/webhook/route.ts` (tolerance); `vercel.json` (cron); the admin user detail page (status display); email template.
- Removed: `app/api/account/closure-readiness/` and its test, replaced by `GET /api/account/closure`.

### Acceptance criteria (Phase B)

- A closure cannot start without recent auth, a non-impersonated session, the matching typed email, and the acknowledgement. Identity comes only from the server.
- Every blocker comes with an explanation and a resolution link, and the button stays disabled until blockers are resolved. The server rejects a submit that has blockers even if the UI is bypassed.
- A double submit, a retry after each failed step, and the cron retry all converge to `closed` without duplicate side effects.
- Shared-workspace requests keep working public links, move to the named admin, and are not deleted. Personal request links return not-found after closure.
- A closing or closed account cannot use the app, is not recreated by activation or reconcile, and cannot be claimed by a new sign-up with the same email. The same email can sign up as a brand-new account after closure.
- Personal Pro and sole-member Team subscriptions are canceled immediately and idempotently without refund or proration. No Stripe customer, invoice, balance, or shared-workspace subscription is deleted or edited.

### Validation (Phase B)

- **Focused Vitest:**
  - eligibility matrix: billing states, sole admin, sole member, impersonation, platform admin;
  - route authorization and recent auth;
  - typed-confirmation mismatch;
  - idempotent claim and resume per step;
  - Stack deletion failure;
  - transaction guard failure;
  - activation block and claim prevention;
  - webhook tolerance;
  - cron auth;
  - component states (blockers with links, review, confirm, success, partial failure, password-less).
- **Checks:** changed-file ESLint, `tsc`, full Vitest, `npm run build`, `security:scan`, `git diff --check`.
- **Database:** SQL migration reviewed statically. It is not run against any live database.

## Approved decisions (2026-09-16)

1. **Timing:** immediate and permanent (as recommended).
2. **Billing (changed from the proposal):** UtilitySheet cancels, immediately and without a refund, the personal Pro subscription and the Team subscription of any workspace where the user is the only member. Closure is blocked while any of those is `past_due`, `unpaid`, or `incomplete`. The "set to cancel first" eligibility rule in the proposal no longer applies. Cancellation becomes the step `billing_canceled`, before `data_removed`, with a status check before each cancel so a retry is safe.
3. **Shared work (changed from the proposal):** the user picks the receiving admin for each shared workspace where they own records. The earliest-joined admin is preselected. The server checks that the target is a current admin other than the user.
4. **Retention:** approved as proposed, including the confirmation email.

## Original proposal: decisions that needed approval

1. **Irreversibility:** immediate and permanent (recommended), or a 14-day recovery window.
2. **Billing:** close once the plan is set to cancel and has no unpaid balance, forfeiting remaining paid time with no refund (recommended). Alternatives: wait until the plan fully ends, or UtilitySheet cancels immediately at closure.
3. **Shared assets:** transfer to the earliest-joined remaining admin (recommended). Alternatives: let the user pick the admin, or leave records owned by the tombstone.
4. **Retention:** a pseudonymous tombstone, the retained referral ledger and audit logs, forfeited unapplied credits, and Stripe records left untouched (recommended). Also a closure confirmation email to the former address.

## Progress log

- 2026-09-16: Investigation complete; plan written.
- 2026-09-16: Phase A complete.
  - Changed: `components/settings/account-security.tsx` (Confirm password wording; Sign in again path for accounts without a password, on the card and on mid-session 403), the `lib/account/security.ts` message, and `tests/unit/account-security-settings.test.tsx` (6 tests).
  - Checks: focused Vitest 6/6 plus the route test 4/4. Changed-file ESLint and `tsc` are clean.
  - Waiting for the owner to approve the lifecycle.
- 2026-09-16: OpenAI Codex took over the interrupted Phase B draft, reconciled it with the accepted decision, and completed the implementation review/fixes.
  - Corrected webhook handling so closing/closed tombstones cannot be reactivated by delayed Stripe events.
  - Preserved approved Stripe references on the tombstone, hardened seeded-account claim guards, and added read-only closure status to the admin user page.
  - Hardened shared-asset discovery and transaction guards for membership changes during closure; retained transferred public links while personal/sole-workspace links are deleted.
  - Added verified-error handling to `/account-closed` so network/server failures are not presented as successful closure.
  - Added closure-focused route, lifecycle, cron, activation, webhook, SQL-contract, settings, and result-page tests. Focused result: 10 files / 49 tests passed.
  - Static migration review found the migration and `schema.sql` mirror aligned for closure columns, step/status constraints, indexes, and the `forfeited` referral state.
  - Final validation: changed-file ESLint passed; supported `next typegen` and `tsc --noEmit` passed; focused closure/security suite passed 10 files / 49 tests; full Vitest passed 161 files / 865 tests; production build passed; security scan passed; `git diff --check` passed with line-ending notices only.
  - After explicit owner authorization, `migrations-account-closure.sql` was applied atomically to the configured Neon database. Post-migration metadata verification confirmed all three account columns, `account_closures`, both named constraints, and both indexes. No application/customer rows were read or changed by verification.
  - Implementation was committed and pushed to `origin/main` in `02296aa` after validation and migration. It is not yet verified as deployed. No required implementation work remains; only these final coordination wording updates are still uncommitted.
