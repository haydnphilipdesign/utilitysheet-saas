---
status: ready
owner: claude
updated: 2026-10-22 22:00
scope: app/dashboard/page.tsx, lib/neon/queries/requests.ts, lib/requests/listing.ts, app/dashboard/requests, components/dashboard/first-run-guide.tsx, lib/email/email-service.ts, types/index.ts, tests/unit
---
# "Waiting on seller" ignores sellers who started from the reusable link

## Goal

The dashboard counts and filters should show every request that is waiting on
a seller, including ones a seller started from the reusable link. The user
asked for this to be fixed (2026-10-22); implemented, not yet committed.

## Progress

Found during the new user experience work (see
[the plan](../plans/2026-10-22-new-user-experience.md)). Verified in code, not
yet fixed:

- `getDashboardStats` (`lib/neon/queries/requests.ts`) returns `sent` and
  `in_progress` separately. The dashboard "At a glance" card "Waiting on
  seller" shows only `stats.sent` and links to `/dashboard/requests?status=sent`
  (`app/dashboard/page.tsx`).
- A seller who enters an address on the reusable link creates a request with
  status `in_progress` (`POST /api/intake/[slug]/start`,
  `lib/seller-forms/intake.ts`). It never counts as "Waiting on seller", so a
  user with one seller mid-form sees 0.
- "Needs attention" has the same blind spot: it only counts `sent` requests
  older than `REQUEST_NEEDS_ATTENTION_DAYS`, so a seller who abandons the
  reusable-link form never shows up there.

Answers found 2026-10-22 (code plus read-only aggregates on the live database):

- Correction: a reusable-link request is created as `draft` at intake start,
  then `GET /api/seller/[token]` moves `draft`/`sent` to `in_progress` the
  moment the seller form opens. One-off requests start as `sent`. So
  `in_progress` means "a seller opened it", for both flows.
- Open requests now: 169 `in_progress` (165 idle 3+ days, 67 created in the
  last 90 days, only 6 with a seller email), 25 `sent` (10 with email),
  2 `draft`. The dashboard "Waiting on seller" shows only the 25.
- Sellers finish fast or not at all: of 772 submitted real requests, 763 were
  submitted within 1 day of creation and 769 within 3 days.
- Only 45 of 772 submitted requests have a seller email; the reusable link
  never collects one. The seller's "email me this link" (`send-link` route)
  sends to an address but does not store it on the request.
- `/api/requests/[id]/remind` requires `seller_email` and refuses submitted
  requests. Reminders are manual only (no cron); 12 sent ever.
- The weekly summary email already shows in-flight work as `sent + inProgress`;
  the dashboard card is the inconsistent one.
- "Needs attention" (list filter, row badge, dashboard card, weekly summary)
  is one shared rule in `lib/neon/queries/requests.ts`: `status = 'sent'` and
  `created_at` older than `REQUEST_NEEDS_ATTENTION_DAYS` (3). Admin views use
  their own 7-day rules and are not affected.
- Caveat: some `in_progress` rows are likely agents trying their own link
  (the dashboard "Open" button), which the data cannot separate.

Open questions before changing anything:

- Should "Waiting on seller" be `sent + in_progress`, and should its link use a
  combined filter (check what statuses `/dashboard/requests` accepts)?
- Should "Needs attention" include stale `in_progress` requests? Reminders need
  a seller email, which reusable-link requests may not have; check
  `/api/requests/[id]/remind` before promising a reminder action.
- Who else reads these numbers: the weekly summary email (`getWeeklyStats`)
  and admin views may use the same definitions.

Decided with the user 2026-10-22 (recommendations 1 to 3 approved) and
implemented, uncommitted, on branch `new-user-experience` as part of Phase 4
of [the plan](../plans/2026-10-22-new-user-experience.md):

- `REQUEST_NEEDS_ATTENTION_DAYS` 3 -> 2, new `REQUEST_NEEDS_ATTENTION_WINDOW_DAYS`
  = 30 (`lib/requests/listing.ts`). Needs Attention = `sent` or `in_progress`,
  no activity (`COALESCE(last_activity_at, created_at)`) for 2 days, created in
  the last 30 days. Applied to all 8 copies in `lib/neon/queries/requests.ts`
  (list filters, row badges, dashboard and weekly stats).
- New list filter `waiting` = `sent` or `in_progress` within the same 30 days;
  `getDashboardStats` returns `waiting`. Dashboard "Waiting on seller" shows it
  and links to `?status=waiting`; Requests filter has "Waiting on seller".
  The 30-day window on "waiting" was added after the live check showed 194
  open requests across all accounts, mostly long abandoned.
- Copy: dashboard Needs Attention description, weekly summary email line, and
  guide step 3 now describe the 2-day rule.
- Row actions already matched recommendation 3 ("Send reminder" only with a
  seller email; copy link otherwise); no change needed.
- Live read-only check: new rule flags 25 requests in 9 accounts (1 with a
  seller email); old rule flagged 25 older `sent` requests.

## Environment

Live database read-only aggregates only (counts).

## Validation

Full Vitest 266 files passed (2328 tests); new embedded-database test
`tests/unit/seller-follow-up-rules.test.ts` covers Needs Attention, Waiting on
seller and dashboard counts against the real schema. `branding-list-page`
failed once in an earlier full run and passed alone (load-related flake).

## Next

Commit with Phase 4 when the user approves.
