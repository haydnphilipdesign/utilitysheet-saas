# Admin Operations Overview Refinement

## Status

Completed and validated locally on 2026-08-24 by Claude Code, then committed as
`7f00139` and pushed to `origin/main` with the user's explicit authorization.
No migration was run and no production data action was taken.

## Validation Results

- Focused Vitest: 3 files / 29 tests passed.
- Full Vitest: 136 files / 707 tests passed (was 134 / 685 before this task).
- `npm exec tsc -- --noEmit` passed.
- `npm run lint`: 1 error, 20 warnings, all pre-existing and in untouched files.
  The single error is `components/admin/EventLogTable.tsx:6` (`no-explicit-any`),
  which predates this task and was not introduced or worsened here.
- `npm run build` passed; `/admin/growth` is present in the route manifest.
- `npm run security:scan` passed.

The redesign was **not** viewed in a running browser. Rendering `/admin`
requires a live Neon database and an authenticated admin session, neither of
which was available locally. Verification was code-level plus component tests.
This is the main open risk and is worth a visual pass before deploying.

## Goal

Make `/admin` answer the three questions the operator actually opens it for, in
priority order:

1. How big is the business right now (accounts, paid, requests)?
2. What happened recently (new requests, new signups)?
3. What needs a human?

Everything that is analysis rather than daily operations moves to the page where
it would be acted on.

## Verified Current Behavior

Verified by reading the source on 2026-08-24, not assumed.

- `app/(admin)/admin/page.tsx` renders four sections and roughly twenty figures
  at uniform visual weight.
- `getActivationFunnelStats()` in `lib/admin/activation-funnel.ts` computes
  `totalAccounts`, `dashboardReady`, `onboardingCompletionRate`,
  `firstRequestRate`, `inactiveRate`, `activationToHabitRate`, and
  `sellerLinkReady`. A repo-wide grep confirms **none of these seven are
  rendered anywhere in the application.** The total account count is therefore
  not available on the dashboard at all.
- Paid figures live in the third section, below the activation section and the
  request chart, split across three cards.
- Recent requests are capped at `LIMIT 5` and rendered in the narrower half of
  an `xl:grid-cols-[1.05fr_0.95fr]` grid.
- The `Overview` recharts bar chart is wrapped in `aria-hidden="true"` and is
  immediately followed by a `<ul>` listing the same status counts as text, so
  the largest element on the page duplicates the list beneath it.
- The three "Needs attention" figures are cumulative backlog counts with no
  time bound, so they only ever grow.
- There is no signup-trend or period-over-period query anywhere in `lib/admin/`.
- `components/admin/Overview.tsx` and `components/admin/RecentActivity.tsx` are
  imported only by `app/(admin)/admin/page.tsx`.
- `components/admin/StatsCard.tsx` is already imported by nothing. It is
  pre-existing dead code and is out of scope here.
- `recharts` is imported only by `components/admin/Overview.tsx`.
- `components/ui/status-badge.tsx` is the canonical request-status color and
  label source (`STATUS_STYLES`, `getStatusStyle`).
- `ADMIN.md` documents every admin route and every overview metric's list
  filter, so both must be updated with this change.

## Approved Approach

### `/admin` new structure, in render order

1. `AdminPageHeader`.
2. **Business strip**: Users, Paid, Requests, Seller submissions (7d). Compact,
   no explanatory prose, each figure links to its filtered list, each carries a
   short 7-day delta where one is meaningful.
3. **Recent**: two columns, recent requests (12 rows) in the wider column and
   new signups (8 rows) in the narrower one.
4. **Needs attention**: single row of compact link chips, not three large tiles.
5. **Request lifecycle**: one CSS stacked bar with inline counts, replacing both
   the recharts chart and the duplicated list.

### Moves off `/admin`

- Acquisition sources and packet referral instrumentation move to a new
  `/admin/growth` page.
- Activation rate, habitual accounts, and the seven currently-unrendered funnel
  fields are displayed on `/admin/growth` rather than deleted.
- Team and personal/default workspace counts move to an `AdminStatStrip` on
  `/admin/organizations`.

Deviation from the original proposal: activation rate and habitual accounts go
to `/admin/growth` rather than the `/admin/users` stat strip, because the
`/admin/users` strip reflects the current search filters and these funnel
figures are always computed over all `role = 'user'` accounts. Mixing the two
would make the strip mean two different things at once.

## Expected Files

- NEW `lib/admin/operations-overview.ts`
- NEW `components/admin/RecentRequestsList.tsx`
- NEW `components/admin/RecentSignupsList.tsx`
- NEW `components/admin/RequestLifecycleBar.tsx`
- NEW `app/(admin)/admin/growth/page.tsx`
- NEW `tests/unit/admin-operations-overview.test.ts`
- NEW `tests/unit/admin-operations-dashboard.test.tsx`
- REWRITE `app/(admin)/admin/page.tsx`
- EDIT `app/(admin)/layout-content.tsx` (add Growth nav item)
- EDIT `app/(admin)/admin/organizations/page.tsx` (workspace stat strip)
- EDIT `ADMIN.md`
- DELETE `components/admin/Overview.tsx`, `components/admin/RecentActivity.tsx`

No schema change. No migration. All new queries are read-only aggregates over
existing columns.

## Acceptance Criteria

- Total account count and paid account count are both visible in the first
  screen of `/admin` without scrolling.
- Recent requests show at least 12 rows with address, account, status, and date.
- New signups are listed with an indication of whether the account has done
  anything yet.
- No figure is rendered twice on the same page.
- Every figure on `/admin` links to the list that contains the rows it counted,
  including the activation rate, which is currently the only unlinked metric.
- Nothing that `getActivationFunnelStats()` computes is discarded; anything not
  on `/admin` appears on `/admin/growth`.
- Request-status colors come from `STATUS_STYLES`, not new ad-hoc colors.
- `ADMIN.md` route and filter documentation matches the shipped routes.

## Validation

- Focused Vitest on new and touched admin tests.
- Full Vitest run.
- `npm run lint` on touched files.
- `npm exec tsc -- --noEmit`.
- `npm run build`.

## Risks and Notes

- The nav test `tests/unit/admin-layout-navigation.test.tsx` asserts exactly
  four `aria-labelledby` groups. Adding Growth inside the existing
  `Growth & Content` group keeps that at four.
- Deleting `Overview.tsx` leaves `recharts` an unused dependency. Removing the
  dependency is deliberately **not** part of this task; it is recorded as
  optional follow-up.
- The stale-in-progress predicate on `/admin` must keep excluding demo requests
  so it continues to agree with `/admin/abandonment`.
