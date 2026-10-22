# Plan: New user experience

## Status

In Progress (approved by the user on 2026-10-22: "I agree with everything... let's begin"). Phases 1 to 4 done; Phase 5 (test drive on a real address) remains a draft needing a decision.

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
- Handoff notes (2026-10-22, for a new session; verify before relying on them):
  - The seller test always uses `TEST_DRIVE_PROPERTY_ADDRESS`
    (`[TEST] 123 Maple Street, Anytown, PA 18301`, `lib/test-drive/service.ts`),
    created in `app/api/test-drive/route.ts`.
  - Unverified: whether provider suggestions run, or return anything useful,
    for that fictional address. Check the suggestion path for `is_demo`
    handling and what a test seller actually sees before designing anything.
  - Read `docs/ai-telemetry.md` (redaction rules) and the October suggestion
    work (`git log --since=2026-10-10 --grep=suggest`) first. Seller-test
    requests are excluded from billing, telemetry and ops counts in several
    places (`tests/unit/test-drive-*`); a real address must keep those
    exclusions.
  - Questions for the user: AI cost per test and any cap, whether a real
    address entered by an agent is stored and for how long, and whether the
    fictional address stays as the default with an optional real one.
  - Live numbers at handoff: 13 accounts finished the seller test (of 163);
    since the test launched (2026-07-21), 7 accounts tried it and 1 went on
    to a real submission.

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

Phase 2 implemented 2026-10-22 on branch `new-user-experience` (uncommitted
at the time of writing):

- `after_15m` is now a welcome email (three steps, seller link, branding link)
  and `after_1d` a "Send your first seller link" email with a ready-to-paste
  text message, a one-property request link, and a seller-test nudge only if
  the test is not done. Both say "Reply to this email"; `replyTo` is the
  existing support address (`haydn@multimedium.dev`), defined locally in
  `email-service.ts` because importing `lib/account/closure.ts` would be circular.
- Targeting: open accounts created in the last 7 days with no real request.
  `onboarding_completed_at` no longer matters. A failed send waits 6 hours
  before retrying (`metadata.attempted_at`).
- Found during the work: the cron ran once a day (12:30 UTC), so "after 15
  minutes" really meant up to 24 hours. It now runs at :05/:20/:35/:50.
  `JOB_SCHEDULES` and `jobOverdueMinutes` were generalized so sub-daily jobs
  are judged by their own interval (re-engagement alerts after 2 hours
  without success); the alert summary wording follows the schedule.
- Read-only check against the live database on 2026-10-22: the new rule makes
  1 account due now (welcome stage); the old rule in the same window made 0.
- Not done: a later (day 3 or 7) stage. It needs a migration for the `stage`
  CHECK constraint, and sending before the migration runs would fail to log
  and resend every run, so it must ship with the migration applied first.

Phase 2 committed as 860bca5.

Phase 3 implemented 2026-10-22 on the same branch (uncommitted at the time of
writing). Decisions (taken by Claude under the user's "agree with everything"
approval of this plan's direction):

- `/onboarding` is now "Put your brand on every sheet": brand name, logo
  upload (all plans, existing `/api/branding/upload`), color, contact details,
  live preview, one "Save and go to dashboard" button, and a link to the full
  Branding editor. The seller link, test card, and "Start here" content are
  gone (the dashboard guide owns them). The URL is unchanged because sent
  emails link to it. Teams workspaces see a note that the settings are shared.
- `onboarding_completed_at` is still set when that page saves (it now means
  "saved branding on the setup page") but no longer drives anything except
  testimonial scoring, where that meaning still fits.
- Admin funnel: "Completed onboarding" replaced by "Finished the seller test"
  (submitted demo request). "No setup and no request" became "No request yet"
  in the funnel, admin overview chip, users filter (URL value `no-setup` kept
  for existing links), and the ops follow-up list.
- Deleted unused `/api/onboarding/brand-profile` and
  `/api/onboarding/organization` (no callers; an older review noted the first
  could create a default Branding Profile inside a Teams workspace).
- Playwright `test-drive-journey` and `dialog-focus` specs now use the
  dashboard fixture instead of `/onboarding`; 24/24 passed on all projects.
- Read-only funnel query against the live database: valid; 163 accounts,
  13 finished the seller test, 62 have a request, 101 have no request yet.

Phase 3 committed as 4864f98.

Phase 4 in progress (2026-10-22). Approved by the user: Needs Attention and
Waiting on seller fixes (done, see
[the metric task](../tasks/2026-10-22-waiting-on-seller-metric.md)),
automatic seller reminders as an account setting defaulting to off, and
seller email capture "if implemented properly" (design pending the user).
Data gathered for that design (read-only, live):

- 100 requests had the seller use "Email me this link"; 98 of them were
  submitted. The address is sent to but never stored.
- 722 requests had a seller open the form; 592 were submitted.
- Manual reminders: 12 sent on 6 requests, 2 later submitted.
- Of the 25 requests the new rule flags today, 1 has a seller email.

Decisions 2026-10-22: the user skipped seller email capture ("we already
have the Email me a link button") and approved one automatic reminder.

Phase 4 implemented (uncommitted at the time of writing):

- Needs Attention / Waiting on seller fixes as recorded in the metric task.
- Automatic seller reminders: account preference `auto_seller_reminders`
  (Settings > Notifications, "Emails to your sellers", off by default). Hourly
  job `/api/cron/seller-auto-reminders` (:40) registered in `vercel.json`,
  `SCHEDULED_JOBS` and `JOB_SCHEDULES` (alerts after 3 hours without success).
  Candidates (`lib/neon/queries/automatic-reminders.ts`): owner opted in,
  open and active owner, `sent`/`in_progress`, never metered, not locked or
  demo, seller email present, created in the last 30 days, quiet for 24
  hours, and no earlier reminder of any kind (operation row or legacy
  `reminder_sent` event). Sending reuses `prepareSellerReminder` and
  `executeSellerReminder` (claim, cooldown, idempotency key, outcome record)
  as an agent actor with `automatic: true`, stored as reason `automatic` and
  event `trigger: automatic`. No schema change.
- Live read-only check: 0 requests due now (nobody has the setting on); 1
  would be due if every account turned it on, because reusable-link requests
  carry no seller email.
- Validation: tsc pass; ESLint on changed files pass (3 pre-existing warnings
  in untouched settings files); full Vitest 266 files passed, 1 skipped, 2328
  tests passed; Playwright settings + requests-list specs 63 passed; security
  scan passed; diff check clean.

Phase 5 not started.
