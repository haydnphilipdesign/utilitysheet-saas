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
| 3 | Admin sees what happened to invitations | Implemented and validated locally 2026-10-07; not committed |
| 4 | Seats in the app [B] | Not started; confirm first |
| 5 | New-member welcome | Not started |
| 6 | Honest marketing and "Start Teams" path | Not started |
| 7 | Admin workspace page | Not started |
| 8 | Payment failure and plan end messages [B] [S] | Not started; confirm first |
| 9 | Request owners and "Mine" filter | Not started |
| 10 | Leave a workspace [R] | Not started; confirm first |
| 11 | Shared seller forms [S] [R] | Not started; needs a decision |

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
