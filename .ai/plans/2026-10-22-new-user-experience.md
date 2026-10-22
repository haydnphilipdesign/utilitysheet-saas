# Plan: New user experience

## Status

In Progress (approved by the user on 2026-10-22: "I agree with everything... let's begin"). Phase 1 done; Phase 2 next.

## Objective

Raise the share of new sign-ups who get a first real seller submission, and get
them there in the first session. Findings and numbers are in
[the review task](../tasks/2026-10-22-new-user-experience-review.md).

## Background

- Activation (first live seller submission) is 26% all time and 15% for the
  last 90 days. Half of all accounts never create anything. Median time to
  first submission is 2.6 h; 27 of 42 activated accounts did it within a day.
- Sign-up goes straight to `/dashboard` (`lib/stack/client.ts`). The setup page
  `/onboarding` is reachable only through a small dashboard link.
- The first-run dashboard asks the user to share a link with a seller they may
  not have yet, shows two empty work cards saying "You are caught up", labels
  the test drive "Optional", and does not change as the user makes progress.

## Verified Facts

- `GET /api/requests?stats=true` (`getDashboardStats`) excludes demo and
  deleted requests and is workspace-aware. `total_requests > 0` means a real
  request exists; `submitted > 0` means a real sheet was submitted.
- A seller who enters an address on the reusable link creates a request at
  `POST /api/intake/[slug]/start` (`lib/seller-forms/intake.ts`), so "sent to a
  seller" becomes observable as soon as a seller starts.
- `GET /api/test-drive` returns `eligible | ready | completed | ineligible`;
  `ineligible` means the account already has a real submission.
- Dashboard first-run state today: `!account.onboarding_completed_at && !invitedMember`
  (`app/dashboard/page.tsx`). `onboarding_completed_at` is only set on `/onboarding`.
- Activation reminder emails (`after_15m`, `after_1d`) target accounts with
  `onboarding_completed_at IS NULL` and no real request, with no lower bound on
  account age (`lib/neon/queries/activation-outreach.ts`). The `stage` column has
  a CHECK constraint limited to those two values.
- Analytics event names are a typed map in `lib/analytics/events.ts`.

## Assumptions

- Hiding the guide is a per-viewer convenience, so browser storage is acceptable.
- Invited members of a paid Teams workspace keep today's behavior (Team welcome,
  no setup prompt); their admin owns setup.

## In Scope (phased)

### Phase 1: First-run dashboard (now)

1. New `FirstRunGuide` on the dashboard, shown while the workspace has no
   submitted real sheet (and not for invited Teams members, or when hidden):
   - Step 1 "See what your seller sees": seller test (start, resume, open
     result) plus the sample sheet. Done when the test is completed or the
     account is already ineligible.
   - Step 2 "Send your link to a seller": copy, text, email, open; a link to
     create a request for one property; a tip for when no seller is at hand
     (email signature, listing checklist). Done when `total_requests > 0`.
   - Step 3 "Get your first finished sheet": while waiting, says who it is
     waiting on and links to the request list. Done when `submitted > 0`.
   - Optional "Add your branding" link to `/onboarding`.
   - Progress ("1 of 3 done") and a "Hide this guide" action.
2. While the guide shows, it replaces the seller link card's setup prompt and
   the separate test-drive card. The two work cards only render once a real
   request exists.
3. The test-drive state logic moves into a shared hook so `TestDriveCard`
   (still used on `/onboarding`) and the guide read the same state.
4. Polish: greet by first name during first run; drop the duplicate
   "Manage seller forms" link (FormShareSelector already links to
   `/dashboard/forms`); show "Start here" only during first run; remove the
   teal tint on `/onboarding`; replace the sign-up page emoji with icons.
5. Analytics: `first_run_guide_viewed`, `first_run_guide_action`, `first_run_guide_hidden`.

### Phase 2: Emails (next, needs care)

- Rewrite `after_15m` as a welcome (what happens next, try the seller test,
  share the link) and `after_1d` as a nudge that differs from it.
- Retarget on "no real request" instead of `onboarding_completed_at`, with a
  created-at lower bound so older inactive accounts are not suddenly emailed.
  The user approved a 7-day window on 2026-10-22: only accounts created in the
  last 7 days are eligible.
- Optional later stage (day 3 or 7) needs a migration for the `stage` CHECK
  constraint: write the migration, do not run it without confirmation.

### Phase 3: Setup page

- Decide `/onboarding`'s role: likely a focused "Add your branding" page (with
  logo upload, which it lacks) since the guide now owns the link and the test.
- Decide what `onboarding_completed_at` means afterwards (it gates Phase 2
  targeting and admin funnel metrics).

### Phase 4: First request follow-through

- Check whether seller reminders are automatic for new accounts; surface a
  "send a reminder" action in guide step 3 if not.

### Phase 5: Test drive on a real address (Draft, needs a decision)

- Let the user test with a real address so provider suggestions appear. Needs
  decisions on AI cost, rate limits, and privacy before any work.

## Out of Scope

- Pricing, plan limits, and billing flows.
- Seller form question changes.

## Files or Areas Expected to Change (Phase 1)

- `components/dashboard/first-run-guide.tsx` (new)
- `components/test-drive/use-test-drive.ts` (new), `components/test-drive/TestDriveCard.tsx`
- `app/dashboard/page.tsx`
- `lib/analytics/events.ts`
- `app/onboarding/page.tsx` (teal tint only), `app/auth/signup/page.tsx` (icons only)
- `tests/unit/first-run-guide.test.tsx` (new), `tests/unit/dashboard-reusable-link.test.tsx`
- `app/test-fixtures/dashboard/` (dev-only fixture added during the review)

## Data, API, Schema, or External-State Impact

Phase 1: none. Client-only; reads existing endpoints. Phase 2 changes who gets
email and may need a migration (not run without confirmation).

## Risks and Edge Cases

- Stats request fails: fall back to today's dashboard, never block the page.
- Shared workspace: stats count teammates' requests; an admin whose teammate
  already submitted is past first run, which is correct for the workspace.
- Paused default seller form: step 2 must say so and link to Seller forms.
- Test-drive request fails: step 1 shows the error with retry; steps 2 and 3
  still work.
- Existing users with no submissions but `onboarding_completed_at` set will now
  see the guide. Intended; they are the inactive group.

## Validation Plan

- Unit: guide step states and progress; dashboard shows guide vs normal view;
  invited member; hidden guide; stats failure fallback; existing dashboard and
  test-drive card tests still pass.
- Full Vitest, `tsc --noEmit`, ESLint on changed files, `git diff --check`.
- Browser walkthrough (mocked APIs, desktop and iPhone) for: brand-new,
  after test drive, request sent but not submitted, activated.

## Outcome

Phase 1 implemented 2026-10-22 (uncommitted, on `main` working tree).
Deviations from the proposal:

- During first run the regular seller link card is not rendered at all (not
  hidden): jsdom and assistive tech saw both copies. The guide shares the
  default form's link from `/api/intake-link`; the saved-form picker returns
  once the guide is gone.
- "Hide this guide" sits at the bottom of the guide (it crowded the header on
  phones). A "Show the getting started guide" button on the link card restores it.
- The greeting falls back to the account's `full_name` when the Stack display
  name is empty.
- Step 3 makes no claim about "Needs your attention": that list only counts
  `sent` requests, and reusable-link requests start as `in_progress`.
- The TestDriveCard `set-state-in-effect` suppression moved with its code to
  `components/test-drive/use-test-drive.ts`.

Follow-up found while verifying: the "Waiting on seller" metric counts only
`sent`, so a seller mid-form on the reusable link shows as 0. Pre-existing;
changing it touches request filters, so it is tracked separately in
[its own task](../tasks/2026-10-22-waiting-on-seller-metric.md).

Phases 2 to 5 not started.
