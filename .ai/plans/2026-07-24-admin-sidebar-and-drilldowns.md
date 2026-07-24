# Admin Sidebar Navigation and Overview Drill-Down Plan

## Status

Completed on 2026-07-24 by Claude Code. All four phases are implemented and validated. Committed as
`454e951` and pushed to GitHub `main` with the user's explicit authorization; no migration or deployment
was authorized or performed. Follow-up to the completed
`.ai/plans/2026-07-17-admin-operations-workspace.md`.

## Objective

Make the Admin v2 information architecture usable day to day by moving the grouped navigation into a left
sidebar, repairing overview metrics that link to destinations which cannot show the counted set, and fixing
two layout regressions introduced with the two-row header. No route, authorization, audit, entitlement, or
billing behavior changes.

## Context

The Admin v2 redesign replaced six flat header links with nine links in four labeled groups on a second
header row. The user reports sustained difficulty adapting. Review found three defects beyond ordinary
adjustment cost, plus a navigation pattern that is overbuilt for the current link count.

## Verified Findings

Verified by reading the current code, not assumed:

- `AdminFilterBar` sticks at `top-[4.5rem]` (72px) with `z-20`
  (`components/admin/primitives.tsx:57-68`), but the two-row header is roughly 108px tall at `sm` and above
  and sits at `z-40` (`app/(admin)/layout-content.tsx:45-118`). The filter bar scrolls under the header on
  every list page. The 4.5rem value was correct for the pre-v2 single-row 64px header.
- The header contains two separate links to `/dashboard`: an icon arrow
  (`layout-content.tsx:49-57`) and a text button (`layout-content.tsx:71-77`).
- `/admin/users` accepts only `q`, `role`, `plan`, `sort`, `dir`, `page`, `pageSize`
  (`app/(admin)/admin/users/page.tsx:55-64`). It has no activation filter.
- Overview attention items "No setup and no request" and "Core setup incomplete"
  (`app/(admin)/admin/page.tsx:229`, `:237`) both link to bare `/admin/users`, so the counted accounts
  cannot be located from the destination.
- "Paying accounts" counts `subscription_status = 'pro'` OR active workspace on Team
  (`lib/admin/activation-funnel.ts:204-211`) but links to `?plan=pro` (`admin/page.tsx:334`), which is a
  strict `ac.subscription_status = 'pro'` match (`lib/admin/index.ts:205-210`). The list is a subset of the
  number clicked.
- "Seller submissions" counts the last 7 days (`admin/page.tsx:71-76`) but links to `?status=submitted`
  (`admin/page.tsx:267`), which returns every submitted request regardless of age.
- The overview stale-in-progress count does not exclude demo requests (`admin/page.tsx:67-72`), while
  `/admin/abandonment` excludes them throughout (`app/(admin)/admin/abandonment/page.tsx:51,67`). The two
  surfaces can disagree.
- `components/ui/sheet.tsx` exists (Base UI dialog), but rendering nav links in both a desktop sidebar and a
  mobile sheet would duplicate every link in the accessibility tree and break
  `tests/unit/admin-layout-navigation.test.tsx`. A single transformed `aside` avoids this.

## Approach

### Phase 1: Sidebar navigation shell

- Replace the second header row with a left sidebar rendered exactly once in the DOM.
- Desktop (`lg` and above): sticky sidebar beside the content column.
- Below `lg`: the same element becomes a fixed slide-over, toggled by a header menu button, hidden with
  `max-lg:hidden` when closed so it leaves the tab order and accessibility tree without JS-measured
  viewport state (avoids a hydration mismatch).
- Keep the existing four groups and the existing labels, ordering, icons, and hrefs. Render group names as
  real `<nav>` section headings rather than inline chrome.
- Collapse the header to a single 64px row. Remove the duplicate back arrow, keeping the labelled
  "Back to App" control.
- Rename the `Overview` nav item to `Dashboard`, removing the collision with the `Overview` chart component
  rendered inside that page. The page's own `AdminPageHeader` title stays "Operations overview".

### Phase 2: Layout offset correctness

- Declare `--admin-header-height` on the admin shell root and derive the `AdminFilterBar` sticky offset from
  it, so the two values cannot drift apart again.

### Phase 3: Overview drill-downs that resolve

- Add an `activation` filter to `/admin/users` with `no-setup` and `missing-defaults`, matching the funnel
  predicates in `lib/admin/activation-funnel.ts` exactly (including the non-deleted, non-demo request
  qualification).
- Add `plan=paying` to the existing plan filter, matching the funnel's paid-accounts predicate (Pro override
  OR active workspace on Team).
- Add an `activity` filter to `/admin/requests` with `7d`, `30d`, `stale7d`, `stale30d`, computed over
  `COALESCE(metered_at, last_activity_at, created_at)` to match the overview's own predicate.
- Point every overview link at a URL that resolves to the counted set, appending `role=user` where the
  funnel restricts to `role = 'user'`.
- Exclude demo requests from the overview stale-in-progress count so it agrees with `/admin/abandonment`.
- Surface the new filters in the existing filter-bar selects and include them in reset and pagination hrefs.

### Phase 4: Validation, documentation, handoff

- Update `tests/unit/admin-layout-navigation.test.tsx` for the sidebar and add focused coverage for the new
  filter parsing and href construction.
- Update `ADMIN.md` with the supported list filters.
- Run focused Vitest, changed-file ESLint, `npm exec tsc -- --noEmit`, `npm run build`,
  `npm run security:scan`, and `git diff --check`.

## Acceptance Criteria

- Admin navigation is a left sidebar; no horizontal scrolling of navigation at any width; nav links appear
  once in the accessibility tree.
- The filter bar remains fully visible below the header while scrolling a long list.
- Exactly one back-to-app control.
- Every clickable number on `/admin` lands on a filtered view whose total equals the number clicked.
- Existing routes, authorization, reason requirements, audit logging, entitlement semantics, and
  `ADMIN_WRITES_DISABLED` behavior are unchanged.
- Focused tests pass; type-check and build pass; repository lint introduces no new errors.

## Expected Files

- `app/(admin)/layout-content.tsx`
- `components/admin/primitives.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/users/page.tsx`
- `app/(admin)/admin/requests/page.tsx`
- `lib/admin/index.ts`
- `lib/admin/list-query.ts`
- `ADMIN.md`
- `tests/unit/admin-layout-navigation.test.tsx`
- `tests/unit/admin-list-filters.test.ts` (new)
- `.ai/CURRENT.md`

## Constraints and Risks

- No schema change, migration, commit, push, or deployment. No live admin mutation.
- Do not alter the meaning of any metric; only make the destination agree with the metric already shown.
- The new SQL predicates duplicate funnel logic in a second place. Mitigate by extracting the predicates as
  named SQL fragments in `lib/admin` where practical and by asserting equivalence in tests.
- Sidebar work touches the shell used by every admin page; regressions are broad but visually obvious.

## Validation Results

- Focused Vitest: `admin-layout-navigation` (7 tests), `admin-list-filters` (9 tests, new),
  `admin-list-query` (5 tests) passed.
- Full Vitest: 128 files, 640 tests passed, up from the 127/627 baseline recorded on 2026-07-21.
- `npm exec tsc -- --noEmit` passed. `npm run build` compiled successfully.
- `npm run security:scan` passed. `git diff --check` passed with only CRLF notices.
- Changed-file ESLint is clean. Repository-wide `npm run lint` still reports exactly the pre-existing
  baseline: 1 error (`components/admin/EventLogTable.tsx:6`, unrelated `no-explicit-any`) and 20 warnings.
- No authenticated browser QA was performed, so no fresh visual evidence is claimed. See Remaining Work.

## Deviations from the Original Approach

1. **Scope grew from three drill-downs to seven.** The acceptance criterion "every clickable number lands on
   a filtered view whose total equals the number clicked" also implicated "Activated this week", "Habitual
   accounts", "Team workspaces", and "Personal/default workspaces", which were all linking to unfiltered
   lists. Added `activation=activated-7d`, `activation=habitual`, and a `billing` filter on
   `/admin/organizations` rather than leave four known-misleading links in place.
2. **"Habitual accounts" destination changed.** It previously pointed at `/admin/testimonial-candidates`,
   whose eligibility is a separate scoring model, not "3+ submitted in 30 days". It now points at the users
   list filtered to that definition.
3. **Filter guards were centralized in `lib/admin/list-query.ts`** instead of staying local to each page.
   The page-local type guards were not reachable from tests. The filter types now live there and
   `lib/admin/index.ts` re-exports them.
4. **Mobile drawer closes on link click, not via a `usePathname` effect.** The effect form trips the
   `react-hooks/set-state-in-effect` ESLint rule.
5. **Navigation group ids are explicit slugs.** `aria-labelledby` takes a whitespace-separated ID list, so
   deriving an id from "Growth & Content" silently broke the group's accessible name. Caught by review
   after the first implementation pass; a regression test now asserts every reference resolves.

## Remaining Work

Required: none.

Optional follow-up:

- Authenticated visual QA of the sidebar at desktop and narrow widths, and of the filter bar's scroll
  behavior on a long list. The offset arithmetic and the tests are verified; the rendered result is not.
- The activation predicates are now expressed twice: as aggregates in `lib/admin/activation-funnel.ts` and
  as row filters in `searchUsers`. They were written to match and are documented as a pair in `ADMIN.md`,
  but a future schema change must update both.
