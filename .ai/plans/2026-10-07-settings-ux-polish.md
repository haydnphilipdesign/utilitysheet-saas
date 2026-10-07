# Plan: Settings UX polish (Account, Notifications, Workspace & Team, Billing, Referrals)

## Status

Completed (2026-10-07, Claude Opus 5.5). Owner approved the review findings
in chat with qualifications (below). UI only. Committed and pushed to main with
owner authorization.

## Objective

Give the rest of `/dashboard/settings` the same treatment as Seller forms: easy
to scan, plain wording that does not assume the user is an agent, and no doubt
about whether a change saved. Reference: `.ai/plans/2026-10-07-seller-forms-ux-polish.md`
and `.ai/decisions/2026-10-07-dashboard-ui-conventions.md`.

## Verified facts

- `app/dashboard/settings/page.tsx` (1370 lines) holds every tab except the
  security/data cards (`components/settings/account-security.tsx`,
  `account-closure.tsx`) and `components/referrals/referral-credit-card.tsx`
  (also rendered `compact` on the dashboard home).
- The page starts from hard-coded Free defaults and all-on notification
  defaults, and shows them while `/api/account` loads or after it fails.
- `POST /api/account` accepts `full_name` and/or `notification_preferences`;
  either alone is valid.
- Inactive tab panels unmount, so state that must survive a tab switch lives
  above the tabs.
- Free usage counts submitted sheets (`getMonthlyUsage`); sending requests is
  not limited on any plan.
- Team checkout rules on the server: whole seats, minimum 3, not below seats
  already in use (members plus pending invitations).
- Invite create returns `inviteUrl` plus `emailSent`, or `reused: true` with no
  `emailSent`; resend returns `inviteUrl` and `emailSent`.
- Checkout returns to `?tab=billing&session_id=...` (Pro) or
  `&team_checkout=success|cancel` (Teams). Plan changes arrive by webhook.
- `subscription_ends_at` is the current period end written by the webhook for
  active plans. Nothing in the current API says a plan is set to cancel.
- Settings has no `window.confirm` and no "Pro Only" items. It has two
  hand-rolled confirmation dialogs.
- No browser spec covers Settings. `app/test-fixtures/seller-forms` is the
  development-only pattern for mocked-API browser tests.

## Scope (finding IDs from the review)

- B1/X1: every tab shows a loading state, and a "couldn't load, try again"
  state, instead of defaults. No checkout or portal button renders until the
  account has loaded.
- B2: seat count is typed freely and validated (whole number, minimum 3, not
  below seats in use) before checkout. Pricing and minimums unchanged.
- B3/N1: each notification switch shows saving, saved or failed beside it. A
  failed save returns the switches to the last saved values. Saves stay
  serialized; the latest change wins.
- B4: profile save sends `full_name` only.
- B5: Sign-in & security distinguishes loading, load failure and the
  confirm-it's-you gate.
- X2: Profile and Workspace name show unsaved/saved/error beside the button.
- X3/X4: plain wording, sentence case, "Teams", "admin", "workspace"; shared
  section component; title icons kept.
- X5: both hand-rolled confirmations use `ConfirmDialog`.
- A1 to A4, N2, N3, W1 to W4, L2 to L5, R1, R2 as reviewed.
- L1: on return from checkout, reload the account and show "confirming" until
  the reloaded plan matches; never read plan state from the URL.
- Seller forms tab: contents unchanged; layout checked in screenshots.

Owner decisions: team notifications stay in Workspace & Team with a pointer
from Notifications (P1); no invite role picker (P2); tab order unchanged (P3);
server checkout guard deferred (P4); a cancellation end date is shown only if
the current API already provides it (P5, it does not, so deferred).

## Out of scope

API routes, schema, permissions, billing rules, plan gating, the account
closure flow's behavior, Seller forms contents, the dashboard home card
(`compact` referral card keeps its current behavior).

## Expected files

- `app/dashboard/settings/page.tsx` (becomes a thin wrapper)
- new `components/settings/{settings-view,settings-ui,profile-section,notifications-section,workspace-team,billing-section,types}.tsx`
- `components/settings/account-security.tsx`
- `components/referrals/referral-credit-card.tsx`
- new `app/test-fixtures/settings/page.tsx`, new `tests/settings.spec.ts`
- `tests/unit/settings-*.test.tsx`, `tests/unit/account-security-settings.test.tsx`
- `.ai/decisions/2026-10-07-dashboard-ui-conventions.md` (applied-in list)

## Acceptance criteria

- Before the account loads, and when it fails to load, no tab shows a plan,
  a preference value, or a checkout/portal button.
- "10" can be typed as a seat count; an invalid count disables the button and
  says why.
- A failed notification save shows the failure beside the switch and the
  switch shows the saved value.
- Profile save body is exactly `{ full_name }`.
- Invite messages only say an email was sent when the response says so.
- A checkout return never shows a plan as active unless the reloaded account
  says so.
- Members and admins see the same read-only reasons as before; no control
  became available to a role that could not use it.
- No horizontal overflow at phone width on any tab.

## Validation

`tsc`; ESLint on changed files; full Vitest; `tests/settings.spec.ts` and
`tests/saved-seller-forms.spec.ts` on Desktop Chrome, Mobile Safari and Mobile
Chrome; desktop and phone screenshots of every tab reviewed.

## Risks

- Unit tests assert on current wording and control names; they change with it.
- The browser fixture has no signed-in Stack user, so Sign-in & security is
  exercised there in its password-less variant only; unit tests cover the
  password variant.
- Billing and security wording must keep its meaning (proration, single
  subscription, what sign-out does).

## Outcome

Implemented as scoped. No API route, schema, permission, billing rule or plan
gate changed; every request body is the same as before except the profile save,
which now sends `{ full_name }` only (already valid for `POST /api/account`).

Details and deviations:

- `page.tsx` is a thin wrapper around `components/settings/settings-view.tsx`,
  which owns the account, notification and workspace data so it survives a tab
  switch. The fixture route passes a stand-in user.
- Seat count is a text field with a numeric keypad, validated on the client
  with the server's rules; the server remains the gate.
- Invite create and resend say "emailed" only when `emailSent === true`.
  `reused` says no new email was sent. Known API error strings that say
  "organization" are reworded on the client; unknown ones show as returned.
- Checkout return: the page reloads the account every 3 seconds, up to 5 times,
  and says "confirming" until the reloaded plan matches, then offers "Check
  again". `session_id` and `team_checkout` are removed from the address bar.
- Members are a stacked list with named text buttons instead of a table with
  icon buttons. The notification "Contact resolution alerts" is now labelled
  "Missing provider contact alerts" (same preference key).
- Free usage bar is the primary color (amber near the limit, red at it).
- Card title icons kept; the save-button floppy icon and per-card background
  overrides were dropped to match Seller forms.
- The referral card shows loading and a retry on the Referrals tab; the compact
  dashboard card still renders nothing until loaded. Its wording changed on
  both.
- `account-closure.tsx` is untouched.
- Added on phones: the open tab's name is scrolled into view in the tab strip.

Deferred, not done:

- P4: `POST /api/billing/checkout` had no visible existing-subscription check
  in the part read (to the Stripe session parameters). Unverified; needs its
  own task.
- P5: no cancellation end date. `subscription_ends_at` is the current period
  end for active plans and nothing in the current API says a plan is set to
  cancel.

Validation (Node 20.19.0; `DATABASE_URL`, `RESEND_API_KEY`, `GOOGLE_AI_API_KEY`
blanked in the browser-run process only): `tsc`; ESLint on changed files; full
Vitest with the local native PostgreSQL binary, 204 files / 1446 tests passed;
`tests/settings.spec.ts` (new, 7 tests) and `tests/saved-seller-forms.spec.ts`,
60/60 across Desktop Chrome, Mobile Safari and Mobile Chrome; security scan;
desktop and phone screenshots of every tab reviewed, including the Seller forms
embed, failed loads, failed saves and the member view.

Not verified: a signed-in browser, dark mode, the hosted site, a real Stripe
return, and Sign-in & security in the browser for a password account (the
fixture has no signed-in user; unit tests cover it).
