# Teams plan review: findings and proposed slices

- Status: Stage 2 in progress. The owner approved the recommended order in chat on 2026-10-07 ("I follow your recommendations") and asked for this plan to track progress. Slices are implemented one at a time; see Progress. Slices flagged [B], [S] or [R] are confirmed with the owner again before they start.
- Date: 2026-10-07. Agent: Claude Opus 5.5. Branch: main at `5defe9c`.
- Source: owner request in chat on 2026-10-07 for a top-to-bottom Teams review in two stages.
- Constraints: no live Stripe call, migration or live database read/write without asking; reads are aggregates only; no pricing, seat-minimum, plan-limit, referral or conversion change without approval; no commit, push or deploy until told. Wording follows `.ai/decisions/2026-10-07-dashboard-ui-conventions.md`; no em dashes.

## How this was checked

- Read the code paths listed under each finding. "Verified" means read in code at the cited lines. "Inferred" means a conclusion not reproduced.
- Browser: `tests/settings.spec.ts -g "Teams"` on Desktop Chrome and Mobile Chrome, 10/10 passed (Node 20.19.0, service keys blanked in the process); admin and member Workspace & Team and Billing screenshots reviewed. The fixture covers Settings only. The invitation page, sign-in pages, dashboard and Admin have no fixture and were read in code only.
- Not done: any live database or Stripe read, a signed-in browser, a real invitation email.

## Findings (verified in code unless marked)

### Inviting and accepting

1. A second visit to an invitation link shows "Something went wrong. Invite already accepted" with a button to Billing. `app/api/organization/invites/accept/route.ts:34`, `app/invite/[token]/page.tsx:72,89-93`. The email link is the only link a new member has.
2. Signed in with a different address: "Please sign in with the email address that was invited", with no mention of either address and no sign-out. `accept/route.ts:43-50`, `page.tsx:89-93`. Likely with "Continue with Google" on a personal account.
3. A person with no account lands on "Welcome back, sign in" with nothing about the invitation; sign-up is a small link. `page.tsx:35-38`, `app/auth/login/page.tsx:139-142,255-262`.
4. The page joins on load. It never shows the workspace, the inviter or the role. `page.tsx:19-33`.
5. The email does not say which address to use, that the link lasts 7 days, or what UtilitySheet is. Workspace and inviter names are placed in the HTML unescaped. `lib/email/email-service.ts:583,605,651`.
6. Invitations last 7 days (`invites/route.ts:29-33`). Expired ones disappear from the admin's list and cannot be resent (`organizations.ts:611-631,633-655`). The admin is told nothing when one expires or is accepted.
7. A new invitee gets a personal workspace, Branding Profile and seller form created before they join (`lib/activation/ensure-account-activation.ts:107-142`, reached from `/api/account` in the sign-in pages), then sees the generic dashboard with "Finish optional setup", which creates a default Branding Profile in the team workspace (`app/dashboard/page.tsx:588-611`, `app/api/onboarding/brand-profile/route.ts:31-41`). Effect on the team's existing default: inferred, not traced.
8. Minor: one API error is not translated ("Only organization admins can invite members"); the reused-invite path does not email.

### Seats and billing

9. The portal is opened with `STRIPE_PORTAL_CONFIGURATION_ID_TEAMS || undefined` (`app/api/organization/billing/portal/route.ts:46`). If the variable is unset in hosting, the Default configuration applies, where plan switching is off, so seats may not be changeable anywhere while the app says they are (`billing-section.tsx:283-284`, `workspace-team.tsx:37`). Hosting value: not verified.
10. "Upgrade Pro to Teams" changes the live subscription on one click with no confirmation. `billing-section.tsx:368-379`, `checkout/route.ts:195-213`.
11. A failed Teams payment drops the workspace to Free at once and sets seats to 0, with no explanation in the app. `app/api/billing/webhook/route.ts:17-19,72,127-135`; Billing then shows "Free plan" with upgrade buttons.
12. Seats below members is unflagged (confirmed as described in the handoff). `organizations.ts:500-583,720-813`.
13. No seat change in the app, no Teams-to-Pro path, no trial end for a converted workspace (all confirmed).
14. Marketing "Start Teams" goes to `/auth/signup?plan=teams`; nothing reads `plan`. `lib/marketing-content.ts:134`.

### Roles, sharing and leaving

15. A removed member keeps receiving submission emails, PDF included, for requests they created in the workspace: the owner is always the first recipient and membership is not checked. `app/api/seller/[token]/route.ts:806-808`. Not reproduced.
16. Shared: requests and Branding Profiles (`requests.ts:84-93`, `brand-profiles.ts:13-19`). Not shared: seller forms, which belong to their creator (`lib/seller-forms/server.ts:250-258`). The requests list does not say who owns a request. A removed member's seller form links stop working (`schema.sql:856-864`).
17. Marketing promises "Org-wide packet defaults" (`lib/marketing-content.ts:141`, `PricingSection.tsx:62`). No workspace-level defaults exist.
18. Members can edit or delete any Branding Profile; no role check (`app/api/branding/[id]/route.ts:46,92,167`). Whether that is intended is the owner's call.
19. `GET /api/organization/members` returns the whole workspace row (Stripe identifiers) and every member's phone and company to any member. `members/route.ts:43-48`, `organizations.ts:334-353`.
20. Members cannot leave; the page says so. Account closure in a team is handled (`lib/account/closure.ts:146-200`).

### Admin

21. The workspace page shows members, seats and billing evidence, but no invitations (pending, accepted, expired), no seats used, no plan end date and no seats-below-members flag. `app/(admin)/admin/organizations/[id]/page.tsx`.

## Proposed slices, most valuable first

Flags: [B] touches billing, [S] schema change, [R] changes what a role can do.

1. Invitation acceptance that cannot dead-end (findings 1 to 5). No flags.
2. Removed members stop receiving the team's submissions; trim the members response (15, 19). No flags.
3. Admin sees what happened to invitations: expired ones listed with "Send again", an email to the inviter on acceptance (6, 8). No flags.
4. Change seats inside the app with the checkout rule; confirm Pro to Teams; flag seats below members (9, 10, 12, 13). [B]
5. New-member welcome and a dashboard that fits a member (7). No flags.
6. Honest marketing and a "Start Teams" path that lands on Teams (14, 17). No flags.
7. Admin workspace page: invitations, seats used, plan end (21). No flags.
8. Say so when a payment fails or the plan ends (11). [B] [S]
9. Who owns each request, with a "Mine" filter (16). New feature. No flags.
10. Leave a workspace, and hand a leaving person's requests to an admin (16, 20). [R]
11. Shared seller forms. New feature; needs a decision record. [S] [R]

Not recommended now: self-serve Teams to Pro; trial end for a converted workspace [S].

## Live evidence (owner-authorized read-only aggregates, 2026-10-07)

Counts and dates only; no addresses, names or identifiers were read out.

- No invitation has ever been accepted in production: 4 on record, 0 accepted, 4 expired. No workspace has more than one member.
- The paying workspace (4 seats since 2026-02-18, 26 requests, last on 2026-09-15, all owned by one person) invited 3 different addresses between 2026-02-24 and 2026-03-09.
- One invitee created an account on 2026-03-09, six days after their invitation expired. The admin invited the same address again minutes later. That second invitation, open for 7 days to someone who by then had an account, was also never accepted. That person is in one workspace (their own, created automatically) and has no requests.
- The other two invitees never created an account.
- The second Teams workspace (3 seats, no stored subscription, 1 request) is the owner's test workspace and sent no invitations.
- Conclusion: the team wanted three more people and none got in. The failure is in getting from the email to membership (findings 1 to 6), not in demand. What exactly each person saw is not knowable from the data.
- Owner confirmed with a screenshot that `STRIPE_PORTAL_CONFIGURATION_ID_TEAMS`, `_PRO`, `TEAM_MIN_SEATS` and `TEAM_INVITE_EXPIRY_DAYS` exist in hosting (values not shown), so finding 9 is unlikely; what the portal lets an admin do is still unverified.

## Progress

| # | Slice | State |
|---|---|---|
| 1 | Invitation acceptance that cannot dead-end | Done 2026-10-07; committed `7ce561b` and pushed; deployment not verified |
| 2 | Removed members stop receiving the team's submissions; trim the members response | Done 2026-10-07; committed `c84e9a7` and pushed; deployment not verified |
| 3 | Admin sees what happened to invitations | Done 2026-10-07; committed `e7c4aec` and pushed; deployment not verified |
| 4 | Seats in the app [B] | Done 2026-10-07; committed `58a5632` and pushed; deployment not verified; no real Stripe call made. Decision: `.ai/decisions/2026-10-07-team-seats-changed-in-app.md` |
| 5 | New-member welcome | Done 2026-10-07; committed and pushed; deployment not verified; not seen in a browser |
| 6 | Honest marketing and "Start Teams" path | Done 2026-10-07; committed and pushed; deployment not verified |
| 7 | Admin workspace page | Done 2026-10-07; committed and pushed; deployment not verified; not seen in a browser |
| 8 | Payment failure and plan end messages [B] [S] | Done 2026-10-07; migration applied to the live database, then committed and pushed; deployment not verified |
| 9 | Request owners and "Mine" filter | Done 2026-10-07; committed and pushed; deployment not verified |
| 10 | Leave a workspace [R] | Done 2026-10-07; committed and pushed; deployment not verified |
| 11 | Shared seller forms [S] [R] | Not started. Product rules decided: `.ai/decisions/2026-10-07-shared-seller-forms.md`. Done 2026-10-07 together with form delete (owner's added scope); migration applied to the live database, then committed and pushed; deployment not verified. Plan with per-step outcomes: `.ai/plans/2026-10-07-shared-seller-forms.md` |

## Slice 1: invitation acceptance that cannot dead-end

No schema change, no billing change, no change to what a role can do. The accept route and its seat guard are unchanged.

Scope:

- `GET /api/organization/invites/lookup?token=`: what an invitation is (workspace, inviter, invited address, state) and how the visitor relates to it (signed in, address matches, already a member). The token is the capability; rate limited by IP.
- `GET /api/organization/invites/mine`: open invitations for the signed-in person's own verified address, so the dashboard can show them without the email. Unverified addresses get nothing.
- `app/invite/[token]/page.tsx`: shows the invitation before joining; a plain state and a way forward for each of: open and signed out, open and wrong address (sign out and switch), open and matching (Join), already a member, already used, expired, not found, no free seat, workspace not on Teams.
- Sign-in and sign-up pages say they are part of an invitation when they are.
- Dashboard shows "You've been invited to join X" while an open invitation exists.
- Invitation email: plain wording, the invited address, the expiry date, names escaped.

Acceptance: every state above has a message and a next step; no state links an invitee to Billing; a second visit after joining opens the workspace; names in the email are escaped; an unverified address never sees someone else's invitation.

Validation: type-check, lint on changed files, full unit suite, `tests/settings.spec.ts` and a new invitation browser spec on desktop and phone, screenshots reviewed.

### Slice 1 outcome (2026-10-07)

- Built as scoped. Files: new `app/api/organization/invites/{lookup,mine}/route.ts`, `components/pending-invitation-banner.tsx`; changed `app/invite/[token]/page.tsx` (rewritten), `app/auth/{login,signup}/page.tsx`, `app/dashboard/layout-content.tsx`, `lib/email/email-service.ts` (`buildOrganizationInviteEmail`), `lib/neon/queries/{organizations,index}.ts` (two read queries), `lib/rate-limit.ts` (lookup policy, 30 a minute per IP), both invite routes (pass the expiry to the email). Tests: new `tests/invite.spec.ts`, `tests/unit/{invite-page,pending-invitation-banner}.test.tsx`, `tests/unit/{organization-invite-lookup-route,organization-invites-mine-route,organization-invite-email}.test.ts`; updated `tests/unit/auth-login-return.test.tsx`.
- Behavior changes to know: the page no longer joins on load, the invitee clicks Join; the accept route is untouched; the email states how many days the link works (days, because the reader's time zone is unknown); the lookup shows the invited address to whoever holds the link, which is the same person the email went to.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 211 files / 1524 tests passed; `tests/invite.spec.ts` and `tests/settings.spec.ts` 42/42 on Desktop Chrome, Mobile Safari and Mobile Chrome with service keys blanked in the process; security scan and `git diff --check` passed; desktop and phone screenshots of every invitation state reviewed.
- Not verified: a real sign-up from an invitation in a signed-in browser, a delivered email in a mail client, Google sign-in returning to the invitation, the dashboard banner in a browser (unit-tested only), the hosted site.
- Not in this slice: showing expired invitations to the admin and telling them when one is accepted (slice 3). Until then, an admin still has to type the address again after an invitation expires.
- Owner set `TEAM_INVITE_EXPIRY_DAYS=30` in hosting on 2026-10-07 (reported, not verified here).

## Slice 2 outcome (2026-10-07)

No schema, billing or role change. No UI change.

- Submission emails: the request owner is a recipient only while they are still a member of the request's workspace. When they are not, the workspace's current admins are told instead, whatever the admin-routing setting, and each admin's own "Seller submissions" preference still applies. The owner-only missing-provider-contact alert stops for a former member too. If membership cannot be read, the owner is treated as not a member (the sheet is not emailed to someone who may have left). Personal (no workspace) requests and test drives are unchanged. `lib/notifications/workspace-routing.ts` (`buildSubmissionCandidates`), `app/api/seller/[token]/route.ts`.
- Responses: `GET /api/organization/members` and `GET /api/account` no longer send a workspace's Stripe customer and subscription identifiers to the browser (`toClientOrganization` in `lib/auth/organization-access.ts`); no screen read them. The member list no longer includes each person's phone and company (`getOrganizationMembers`, used only by that route).
- Tests: new `tests/unit/organization-members-route.test.ts`; added cases in `tests/unit/workspace-notification-routing.test.ts`; mocks updated in `tests/unit/seller-post-submission-routes.test.ts` and `tests/unit/seller-request-question-settings.test.ts`; one source-guard string updated in `tests/unit/test-drive-seller-safety.test.ts` (the test-drive guard itself is unchanged).
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 212 files / 1531 tests passed; security scan and `git diff --check` passed. The browser specs were not rerun because no screen changed.
- Not verified: a real submission for a request whose owner was removed (the route's recipient step is covered through the pure helper, not an end-to-end route test).
- Still open, for slice 10: a former member's requests stay in the workspace under their name, and their seller form links stop working.

## Slice 3 outcome (2026-10-07)

No schema, billing or role change. Admin-only screens and routes; members still see no invitations.

- List: `GET /api/organization/invites` now returns pending and expired invitations that were never accepted, each with `status` (`getUnacceptedOrganizationInvites`). An expired one is left out once the same address has a newer invitation or has joined. Workspace & Team shows it with an "Expired" badge, the date, "Send again" and "Remove"; the heading count and the seat count are pending only.
- Send again: `PATCH /api/organization/invites/[inviteId]` uses the new `renewOrganizationInviteWithSeatGuard`. A pending invitation is renewed as before. An expired one holds no seat, so it is renewed only when a seat is free and the address has no other pending invitation and is not a member; the workspace row is locked for that decision. No free seat returns 409 "No seats available". `refreshPendingOrganizationInvite` is removed.
- Remove: `DELETE` on the same route, `getOrganizationInviteForOrganization` and `cancelPendingOrganizationInvite` now accept an expired invitation too (never an accepted one).
- Joined email: after a successful accept, the admin who sent the invitation gets "X joined Y" (`sendOrganizationInviteAcceptedEmail`), only if they are still in the workspace. A failed email never affects joining. There is no setting for it: one email per person who joins.
- Files: `lib/neon/queries/{organizations,index}.ts`, `app/api/organization/invites/{route,[inviteId]/route,accept/route}.ts`, `lib/email/email-service.ts`, `components/settings/{workspace-team.tsx,types.ts}`; tests `tests/unit/organization-invite-{queries,actions-route,accept-route,email}.test.ts`, `tests/unit/organization-invites-route.test.ts`, `tests/settings.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 212 files / 1543 tests passed; `tests/settings.spec.ts` and `tests/invite.spec.ts` 42/42 on three device profiles with service keys blanked; security scan and `git diff --check` passed; desktop and phone screenshots of the admin Workspace & Team tab reviewed. The list, renewal, summary and "open for an address" queries were also run against sample rows in a throwaway local PostgreSQL 17 (started and deleted in the scratch folder, nothing live): full seats refuse an expired renewal, a pending renewal succeeds, a member's old invitation is not renewed, another workspace's id is not found, and a freed seat allows renewal.
- Not verified: a delivered "joined" email, the flow in a signed-in browser, the hosted site.
- For the paying workspace: its expired invitations (3 addresses, the newest per address) will appear in the admin's list with "Send again" once this is deployed. They have 3 free seats, so all three can be sent again.

## Slice 4 outcome (2026-10-07)

Touches billing. Owner confirmed in chat on 2026-10-07 that the app changes the Stripe quantity. Decision: `.ai/decisions/2026-10-07-team-seats-changed-in-app.md`. No schema change, no pricing or minimum change, no change to what a role can do (seat changes were already admin-only, through the portal).

- New `POST /api/organization/billing/seats` (`organizationSeatsBodySchema`): admin of the active workspace only; whole number, at least `TEAM_MIN_SEATS`, at least members plus pending invitations. It retrieves the stored subscription and refuses unless it belongs to the workspace's customer, is `active` or `trialing`, and has exactly one item at the Teams price. It then updates that item's quantity with `create_prorations` and no idempotency key. Lowering writes our count first under the new locked `setOrganizationSeatQuantityWithUsageGuard`, then Stripe, and puts the count back if Stripe fails; raising writes Stripe first.
- Webhook: after a Teams sync, more members than seats records `billing_webhook:seats_below_members` (warning), labelled in Admin Operations. It never fails the webhook and removes nobody's access.
- Billing: a "Seats" section for Teams admins (current seats and monthly cost, seats in use, a number field, "Update seats" behind a confirmation that states the new monthly price and how Stripe prorates). "Upgrade Pro to Teams" now asks for confirmation with seats and monthly price before it changes the subscription. The portal note no longer says seats are changed in Stripe. Workspace & Team shows a note when members exceed seats.
- Files: new `app/api/organization/billing/seats/route.ts`, `tests/unit/organization-billing-seats-route.test.ts`; changed `lib/neon/queries/{organizations,index}.ts`, `lib/validation/schemas.ts`, `app/api/billing/webhook/route.ts`, `app/api/organization/billing/checkout/route.ts` (one message), `app/(admin)/admin/operations/page.tsx`, `components/settings/{billing-section,settings-view,workspace-team}.tsx`, `tests/unit/billing-webhook-subscription-sync.test.ts`, `tests/settings.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 213 files / 1565 tests passed; `tests/settings.spec.ts` and `tests/invite.spec.ts` 45/45 on three device profiles with service keys blanked; security scan and `git diff --check` passed; desktop and phone screenshots of the Seats section, both confirmations and the result reviewed. The seat-count query was run against sample rows in a throwaway local PostgreSQL 17 (deleted afterwards, nothing live): it lowers to the seats in use, refuses to go below them, raises, and does nothing for another subscription or workspace.
- Not verified, and it matters here: no real Stripe call was made. The quantity update, the proration lines on the invoice, and the `customer.subscription.updated` webhook that follows are tested against mocks only. Assumed from Stripe documentation knowledge: updating one item's quantity with `create_prorations` leaves the billing date unchanged and puts prorations on the next invoice.
- Owner actions: in the Stripe dashboard, "Teams Portal" configuration, turn off quantity changes (keep cancellation, invoices and payment methods). After deploy, change seats once on the test Teams workspace in test mode or with a real card and check the invoice preview in Stripe.

## Slice 5 outcome (2026-10-07)

UI only. No API, schema, billing or role change.

- New `components/dashboard/team-welcome.tsx`, shown at the top of the dashboard to a member (not an admin) of a Teams workspace until they choose "Got it" (remembered per workspace in the browser). It says requests and Branding Profiles are shared, seller forms are each person's own, who the admins are (names from the existing members route, with a fallback), and, when they have another workspace, that it is still there in the account menu.
- `app/dashboard/page.tsx`: the "Finish optional setup" prompt is no longer shown to a member of a Teams workspace, because setup creates a default Branding Profile for the workspace.
- Tests: new `tests/unit/team-welcome.test.tsx`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 214 files / 1571 tests passed; `git diff --check` passed. Settings screens did not change, so the browser specs were not rerun.
- Not verified: the welcome in a browser. The dashboard has no browser fixture, so its look on desktop and phone was not reviewed, only its content and behavior in unit tests.
- Found while doing this, not fixed (needs the owner's answer): a person who already has a seller form (every new invitee gets one in their own workspace first) gets a form in the team workspace only if `SAVED_SELLER_FORMS_ENABLED=true` and the rollout includes them (`ensure_seller_form` in `schema.sql`, `sellerFormCreationCapability` in `lib/seller-forms/config.ts`). If production does not allow it, a new member's dashboard shows "Unable to load your reusable link right now." The owner confirmed in chat on 2026-10-07 that both are set in hosting (not verified here), so this should not occur.
- Not in this slice: the personal workspace that is created for an invitee before they join (finding 7) is unchanged.

## Slice 6 outcome (2026-10-07)

Copy and navigation only. No API, schema, billing, pricing or role change. Checkout itself is untouched.

- Claim removed: "Org-wide packet defaults" and "shared defaults" are gone from `lib/marketing-content.ts`, `components/landing/PricingSection.tsx` and `app/(marketing)/pricing/page.tsx`. They now say "Branding Profiles shared by the whole team" / "shared Branding Profiles", which is true (finding 16). `tests/unit/marketing-teams-claims.test.ts` fails if a workspace-wide defaults claim returns to those three places.
- "Start Teams": the link is still `/auth/signup?plan=teams`. Sign-up now reads `plan` (`getSignupPlanDestination` in `lib/auth/post-auth-return.ts`): for `teams` the destination after sign-up is `/dashboard/settings?tab=billing&plan=teams`, through the existing return path, so it survives Google sign-up, the "Sign in" link for someone who already has an account, and an already signed-in visitor. An explicit `next` (an invitation) still wins. The sign-up page says "Create an account to start Teams" and that seats are chosen next; the button reads "Create account".
- Billing: with `plan=teams` in the address, the Teams section is scrolled into view once the account has loaded (`showTeamsFirst` on `BillingSection`). Nothing is started or prefilled; the person still chooses seats and presses "Start Teams".
- Files: `lib/marketing-content.ts`, `components/landing/PricingSection.tsx`, `app/(marketing)/pricing/page.tsx`, `lib/auth/post-auth-return.ts`, `app/auth/signup/page.tsx`, `components/settings/{billing-section,settings-view}.tsx` (the Teams section is wrapped in one element, so its lines are reindented); tests: new `tests/unit/{auth-signup-plan.test.tsx,marketing-teams-claims.test.ts}`, updated `tests/unit/{post-auth-return.test.ts,settings-states.test.tsx}`, `tests/settings.spec.ts`, `tests/account-auth-responsive.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 217 files / 1589 tests passed after the "Start Pro" change; `tests/settings.spec.ts` and `tests/account-auth-responsive.spec.ts` 48/48 on three device profiles with service keys blanked (the auth spec rerun 9/9 after the "Start Pro" change); security scan and `git diff --check` passed; desktop and phone screenshots of the arrival in Billing and of the Teams sign-up page reviewed.
- Not verified: a real sign-up from the pricing page ending in Billing (each hop is tested, the whole trip is not, because sign-up needs the auth provider); the email-verification path, which relies on the destination remembered in the same browser tab; the hosted site.
- "Start Pro" (owner asked in chat on 2026-10-07, after the first pass): `/auth/signup?plan=pro` now ends on `/dashboard/settings?tab=billing`, where "Upgrade to Pro" is the first button; the sign-up page says "Create an account to start Pro". No checkout is started automatically. Unit-tested; not added to the browser spec.
- Not checked: Teams claims outside the pricing surfaces (FAQ, feature pages, blog-style pages) beyond a search for "defaults"; `docs/audits/` still quotes the old claim as history.

## Slice 7 outcome (2026-10-07)

Read-only Admin page. No admin write, so no audit entry or reason applies. No API, schema, billing or role change.

- `/admin/organizations/[id]` Billing card now shows, for a Team workspace, "Seats in use" (members plus pending invitations, the same count the customer's Billing page uses) with a warning when members exceed seats, and "Plan end" from `organizations.subscription_cancel_at` ("Set to end on <date>", "Not set to cancel", or "No paid plan"). "Stored period end" is unchanged.
- New "Invitations" section under Members: every invitation the workspace sent (newest first, up to 100) with invited email, role, Accepted / Pending / Expired with the relevant date, first-sent date and who sent it; a one-line count; "This workspace has not invited anyone." when empty. The page's query names its columns and never reads the join token.
- Files: `app/(admin)/admin/organizations/[id]/page.tsx`; new `lib/admin/workspace-team.ts` (status and seat summary, pure), `components/admin/WorkspaceInvitations.tsx`; `ADMIN.md` (page description); new `tests/unit/admin-workspace-team.test.tsx`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 217 files / 1588 tests passed; security scan and `git diff --check` passed. The invitation query was run against sample rows in a throwaway local PostgreSQL 17 (a table copied from `schema.sql`, started and deleted in the scratch folder, nothing live): it returns only the asked workspace's invitations, newest first, with the inviter's name and a blank inviter when the account is gone.
- Not verified: the page in a browser. Admin has no fixture and needs a database and an admin sign-in, so its layout on desktop and phone was not looked at. The page itself is covered by a source check (columns selected, the new fields present), not a render; the table component and both helpers are rendered and unit-tested.
- Known limits: an accepted invitation stays "Accepted" after that person is later removed (the Members table is the truth for who is in now); "First sent" is the original date, and "Send again" does not change it.

## Slice 9 outcome (2026-10-07)

New feature. No schema, billing or role change: nobody sees a request they could not already see.

- `GET /api/requests`: each row carries `is_mine` (the signed-in account created it) and, in a workspace, `owner_name` (the creator's name, or their email when no name is stored). The response carries `sharedWorkspace`: true when the active workspace has more than one member or still holds requests someone else created (`workspaceHasOtherRequestOwners`). `owner=mine` narrows the list to the caller's own requests as an extra condition inside the existing visibility scope; any other value means everyone. "Mine" is always the signed-in account, never an id from the address.
- Requests page: when the workspace is shared, an "Owner" column (a line on each phone card) showing "You" or the teammate's name, and an "Everyone's requests / My requests" filter that is kept in the address like the other filters and is cleared by "Clear filters". A workspace with one person looks exactly as before.
- A former member's requests show their name; nothing marks them as a former member yet (that belongs with slice 10, which reassigns them).
- Files: `lib/requests/listing.ts`, `lib/neon/queries/{requests,index}.ts`, `app/api/requests/route.ts`, `app/dashboard/requests/page.tsx`, `types/index.ts`; new `app/test-fixtures/requests/page.tsx` (development-only fixture, same pattern as Settings) and `tests/requests-list.spec.ts`; updated `tests/unit/{requests-list-query,requests-list-route,requests-route-advanced-gating}.test.ts`, `tests/unit/requests-workspace.test.tsx`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 217 files / 1598 tests passed; `tests/requests-list.spec.ts` 6/6 on three device profiles with service keys blanked; security scan and `git diff --check` passed; desktop and phone screenshots reviewed. The list, "mine" and shared-workspace SQL were run against sample rows in a throwaway local PostgreSQL 17 (started and deleted in the scratch folder, nothing live): "mine" returns only the caller's rows, another workspace's rows never appear, a blank name falls back to the email, and a workspace whose only foreign request is deleted is not shared.
- Not verified: a signed-in browser against real data, the hosted site, dark mode. The throwaway database used cut-down tables, not the full `schema.sql`.
- Not in this slice: the dashboard home's recent list and the request detail page do not show the owner. Seen and left alone: the count reads "1 requests".

## "Start Pro" starts checkout (2026-10-07, follow-up to slice 6)

Owner asked for this in chat on 2026-10-07. Touches how a payment flow is entered; the checkout route and its guards are unchanged.

- `/auth/signup?plan=pro` now ends on `/dashboard/settings?tab=billing&plan=pro`. Billing, for a Free account that is not in a Teams workspace, calls the existing `POST /api/billing/checkout` once and sends the browser to Stripe, showing "Taking you to Stripe to start Pro" meanwhile. Stripe's page is where the person confirms and pays.
- It never starts when the account is already Pro, the workspace is on Teams, or the page is a return from checkout (`session_id` or `team_checkout` in the address, including after that banner is dismissed). The plan choice is removed from the address before the call, so Back from Stripe or a reload does not start it again.
- A refusal or failure leaves the person on Billing with the server's reason and the ordinary "Upgrade to Pro" button. Teams is unchanged: seats are chosen first.
- Sign-up copy for Pro: "Next you'll go to secure checkout to start Pro."
- Files: `lib/auth/post-auth-return.ts`, `app/auth/signup/page.tsx`, `components/settings/{billing-section,settings-view}.tsx` (`showTeamsFirst` became `arrivalPlan`); tests `tests/unit/{post-auth-return.test.ts,auth-signup-plan.test.tsx,settings-states.test.tsx}`, `tests/settings.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 217 files / 1604 tests passed (the first run had the one known load-sensitive failure in the unrelated `tests/unit/branding-list-page.test.tsx`; it passed alone and in the next full run); `tests/settings.spec.ts` and `tests/account-auth-responsive.spec.ts` 54/54 on three device profiles with service keys blanked; security scan and `git diff --check` passed.
- Not verified: a real redirect to Stripe (the tests answer the checkout call with a refusal, so the hand-off to Stripe's page itself was never exercised), a real sign-up ending in checkout, the referral free month through this path (same route, so expected to behave as from the button).

## Slice 8 outcome (2026-10-07)

Touches billing and schema. Owner approved starting it in chat on 2026-10-07. No change to who has access or when: a failed Teams payment still moves the workspace to Free at once, exactly as before. This slice only records why and says so.

- Schema: new nullable `organizations.subscription_lapse_reason` (`payment_failed`, `payment_failed_ended`, `ended`, with a check constraint) and `organizations.subscription_lapsed_at`. `migrations-organization-plan-lapse.sql`, mirrored in `schema.sql`. Additive and rerunnable. Owner authorized the migration, commit and push in chat on 2026-10-07. It was **applied** to the configured Neon database before the push (psql 17, stop-on-error, transaction-local 10s lock / 180s statement timeouts). Aggregates only: 141 workspaces before and after, row fingerprint (ignoring the new columns) identical, both columns present and nullable, the check constraint present, no value set.
- Webhook: every workspace update passes `getSubscriptionLapseReason(subscription)` (`lib/stripe/subscriptions.ts`): `past_due` and `unpaid` are `payment_failed`; `canceled` is `payment_failed_ended` when Stripe's cancellation reason is `payment_failed`, otherwise `ended`; `paused` is `ended`; a first payment that never completed gives no reason. `updateOrganizationSubscription` keeps a reason only for a workspace that is on Teams at that moment or already has a reason, dates it once when Teams stops, and clears both when Teams is active again; `transferAccountSubscriptionToOrganization` clears both.
- Settings > Billing: a notice above the plan card says what happened, the date, that nothing was deleted and everyone is still a member, and what to do. While Stripe is still retrying (`payment_failed`) an admin gets "Manage Teams billing" and the "Start Teams" controls are replaced by a note (the subscription still exists, and the checkout guard would refuse a second one). After the plan has ended, "Start Teams" stays. Members are told an admin can fix it and get no billing action.
- Dashboard: `components/plan-lapse-banner.tsx` on every dashboard page while the reason is `payment_failed` only (admins get "Open Billing"). An ended plan is explained in Billing only, so nothing sits on every page for good.
- Admin workspace page shows "Teams stopped" with the reason and date.
- Files: new `migrations-organization-plan-lapse.sql`, `components/settings/plan-lapse.tsx`, `components/plan-lapse-banner.tsx`, `tests/unit/plan-lapse.test.tsx`; changed `schema.sql`, `lib/stripe/subscriptions.ts`, `lib/neon/queries/organizations.ts`, `app/api/billing/webhook/route.ts`, `components/settings/{billing-section,types}.tsx`, `types/index.ts`, `app/dashboard/layout-content.tsx`, `app/(admin)/admin/organizations/[id]/page.tsx`, `ADMIN.md`, `tests/unit/{billing-webhook-subscription-sync,billing-webhook-referral-credits,team-billing-transfer-query}.test.ts`, `tests/settings.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 218 files / 1625 tests passed; `tests/settings.spec.ts` 51/51 on three device profiles with service keys blanked; security scan and `git diff --check` passed; desktop and phone screenshots of the failed-payment notice reviewed. The migration was applied twice and the update logic exercised in a throwaway local PostgreSQL 17 (cut-down table, started and deleted in the scratch folder, nothing live): the reason is set when Teams stops, the date does not move when the reason later changes, both clear when Teams is paid again, a workspace that never had Teams gets no reason, and the check rejects an unknown reason.
- Not verified: a real Stripe failed payment, retry or cancellation, and the events Stripe actually sends for them. Assumed from Stripe documentation knowledge, not tested: `cancellation_details.reason` is `payment_failed` when Stripe cancels after retries run out; a `past_due` subscription returns to `active` by itself when the card is fixed. The dashboard banner was unit-tested, not seen in a browser.
- Known limits: once a plan has lapsed the stored subscription id is cleared (existing behavior), so a late event about some other old subscription of the same workspace could change the recorded reason. The existing workspaces get no reason retroactively: the two live Teams workspaces are on Teams, so nothing needs a backfill.
- Not in this slice: the same explanation for a Pro account whose payment fails (same gap, account table, its own small task); any grace period before a failed payment removes Teams (a billing rule, not changed).
- "Start Pro" checkout and slice 8 were committed together, because `components/settings/billing-section.tsx` and `tests/settings.spec.ts` carry both.

## Slice 10 outcome (2026-10-07)

Changes what a role can do: a member can now take themselves out of a workspace. Owner approved the rule in chat on 2026-10-07 (reuse the account-closure hand-over; the removing admin receives by default). No schema or billing change.

- `DELETE /api/organization/members/[accountId]`: an admin can remove anyone as before, and now any member can use it on their own account id to leave. Nobody else can remove another person. An optional `transferTo` names the admin who takes over; it must be a well-formed account id.
- Hand-over: new `removeOrganizationMemberWithHandover` does everything in one statement with the workspace row locked: it refuses a non-member, refuses the last admin, moves the requests and Branding Profiles the person created in that workspace to an admin who stays (the named one; otherwise the admin doing the removing; otherwise the longest-standing other admin), removes the membership and clears the person's active-workspace pointer. It refuses, changing nothing, when there is something to hand over and no admin to take it. Only that workspace's rows move; the person's other workspaces and personal requests are untouched. Before this slice a removed member's requests stayed in the workspace under an account that was no longer in it.
- Workspace & Team: a "Leave this workspace" section for anyone in a workspace with more than one member, with a confirmation that says what happens; the only admin is told to make someone else an admin first. Removing a member now says their work becomes yours and reports what moved ("Their 3 requests and 1 Branding Profile now belong to you"). The line saying leaving is not available is gone.
- `removeOrganizationMember` and `clearActiveOrganizationIfMatches` had no other caller and were removed.
- Files: `app/api/organization/members/[accountId]/route.ts`, `lib/neon/queries/{organizations,index}.ts`, `components/settings/workspace-team.tsx`; new `tests/unit/organization-member-removal.test.ts`, `tests/unit/workspace-leave.test.tsx`; updated `tests/settings.spec.ts`.
- Validation (Node 20.19.0): `tsc` clean; ESLint on changed files clean; full Vitest with native PostgreSQL 220 files / 1646 tests passed; `tests/settings.spec.ts` 57/57 on three device profiles with service keys blanked; security scan and `git diff --check` passed; phone screenshot of the leave confirmation reviewed. The statement itself was run against sample rows in a throwaway local PostgreSQL 17 (cut-down tables, started and deleted in the scratch folder, nothing live): every refusal changes nothing; a removal moves only that workspace's requests and profiles to the right admin; a member with nothing leaves cleanly; the last admin cannot leave.
- Not verified: a signed-in browser, the hosted site, what the dashboard shows right after leaving (the person's active workspace is cleared and the existing activation path picks their next one; that path was not exercised here).
- Unchanged on purpose: the person's seller forms in the workspace stay theirs and their links stop working, as before (the screens now say so). Nobody is emailed when someone leaves or is removed. A person who leaves frees a seat but the workspace's paid seat count does not change. The screen has no picker for which admin receives the work; the route accepts `transferTo` for when one is wanted.
