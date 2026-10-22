---
status: paused
owner: unassigned
updated: 2026-10-22 15:30
scope: app/dashboard/page.tsx, lib/neon/queries/requests.ts, app/dashboard/requests
---
# "Waiting on seller" ignores sellers who started from the reusable link

## Goal

The dashboard counts and filters should show every request that is waiting on
a seller, including ones a seller started from the reusable link. The user
asked for this to be fixed (2026-10-22); not started.

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

Open questions before changing anything:

- Should "Waiting on seller" be `sent + in_progress`, and should its link use a
  combined filter (check what statuses `/dashboard/requests` accepts)?
- Should "Needs attention" include stale `in_progress` requests? Reminders need
  a seller email, which reusable-link requests may not have; check
  `/api/requests/[id]/remind` before promising a reminder action.
- Who else reads these numbers: the weekly summary email (`getWeeklyStats`)
  and admin views may use the same definitions.

## Environment

None yet.

## Validation

Not run yet.

## Next

Answer the open questions from the code, then decide the definition with the user.
