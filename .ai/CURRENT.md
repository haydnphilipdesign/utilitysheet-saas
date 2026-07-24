# Current Work

> This file is the latest cross-agent handoff.
> Keep it concise, factual, and current.
> Replace stale task information instead of accumulating a permanent chronological log.

## Session Metadata

- Task: Admin navigation sidebar, layout offset repair, and operations-overview drill-down correctness.
- Status: Complete, validated, and published to GitHub `main` as `454e951`.
- Current or last agent: Claude Code
- Branch: `main`
- Last updated: 2026-07-24
- Relevant plan: `.ai/plans/2026-07-24-admin-sidebar-and-drilldowns.md`
- Durable decision: none created; no architectural boundary changed.

## Verified Repository State and Constraints

- `HEAD`, local `main`, and `origin/main` were aligned at `252258d` with a clean worktree when this task
  began. The previous Settings/Branding task was complete and published.
- The user explicitly authorized committing and pushing this work to GitHub `main` on 2026-07-24. It was
  committed as `454e951`, pushed fast-forward, and verified with `HEAD == origin/main` after a fresh fetch.
- No migration, schema change, deployment, or live admin mutation was authorized or performed.
- All changes are in the Admin surface plus two shared admin libraries. No customer-facing route, seller
  flow, packet, PDF, billing, or auth behavior was touched.

## Work Completed

Motivated by the user reporting sustained difficulty adapting to the Admin v2 redesign. Review confirmed
three defects beyond ordinary adjustment cost.

- Replaced the two-row grouped header nav with a left sidebar rendered once in the DOM. It is sticky at
  `lg` and above and becomes a slide-over below `lg`, toggled from the header, hidden with `max-lg:hidden`
  when closed so it leaves the tab order without JS-measured viewport state. Routes, labels, ordering, and
  the four groups are unchanged except `Overview` → `Dashboard`, which removed a name collision with the
  `Overview` chart component rendered inside that page.
- Removed the duplicate back-to-app control; the header had two separate links to `/dashboard`.
- Fixed the sticky filter bar, which was hidden behind the header on every list page. `AdminFilterBar` was
  pinned at `4.5rem`, a value correct for the pre-v2 64px header but not the ~108px v2 header. The offset is
  now derived from a `--admin-header-height` custom property declared on the admin shell.
- Repaired seven overview metrics that linked to lists which could not show the counted rows. Added
  `activation` (`no-setup`, `missing-defaults`, `activated-7d`, `habitual`) and `plan=paying` to
  `/admin/users`, `activity` (`7d`, `30d`, `stale7d`, `stale30d`) to `/admin/requests`, and `billing`
  (`team`, `non-team`) to `/admin/organizations`. Each predicate mirrors its counterpart in
  `lib/admin/activation-funnel.ts`; overview links carry `role=user` because the funnel counts only that role.
- Excluded demo requests from the overview stale-in-progress count so it agrees with `/admin/abandonment`,
  which excludes them throughout.
- Centralized the list-filter types and parsers in `lib/admin/list-query.ts` and consolidated the duplicated
  where-clause builder on the requests page. Added missing `aria-label`s to filter selects.
- Authorization, reason requirements, audit logging, entitlement semantics, policy checks, and
  `ADMIN_WRITES_DISABLED` behavior are unchanged. All admin routes remain stable.

## Files Changed

- `app/(admin)/layout-content.tsx`, `app/(admin)/admin/page.tsx`, `app/(admin)/admin/users/page.tsx`,
  `app/(admin)/admin/requests/page.tsx`, `app/(admin)/admin/organizations/page.tsx`
- `components/admin/primitives.tsx`, `lib/admin/index.ts`, `lib/admin/list-query.ts`
- `ADMIN.md`, `.ai/plans/2026-07-24-admin-sidebar-and-drilldowns.md`, `.ai/CURRENT.md`
- `tests/unit/admin-layout-navigation.test.tsx` (rewritten), `tests/unit/admin-list-filters.test.ts` (new)

## Validation

- Full Vitest: 128 files, 640 tests passed, up from the 127/627 baseline.
- `npm exec tsc -- --noEmit`, `npm run build`, and `npm run security:scan` passed.
- `git diff --check` passed with only CRLF notices.
- Changed-file ESLint clean. Repository-wide `npm run lint` still reports exactly the pre-existing baseline:
  1 error (`components/admin/EventLogTable.tsx:6`, unrelated) and 20 warnings.
- No authenticated browser QA was run; no fresh visual evidence is claimed.

## Remaining Work and Risks

- Required work: none.
- Optional: authenticated visual QA of the sidebar at desktop and narrow widths, and of filter-bar scroll
  behavior on a long list. The offset arithmetic and tests are verified; the rendered result is not.
- Risk: activation predicates now exist twice, as aggregates in `lib/admin/activation-funnel.ts` and as row
  filters in `searchUsers`. They were written to match and are documented as a pair in `ADMIN.md`, but a
  future schema change must update both or a metric will stop agreeing with its drill-down.
- The new `searchUsers` activation filters use correlated subqueries over `requests`, `brand_profiles`, and
  `intake_links`. They are unmeasured against production data volume.

## Concurrent Editing Warnings

- None. No other active task is recorded, and this work is committed and pushed, so no uncommitted Admin
  state is at risk.

## Recommended Next Action

No required action remains. Optional: authenticated visual QA of the sidebar and filter-bar scroll behavior.
Deployment, migrations, and other production mutations remain separate authorization-gated follow-ups.
