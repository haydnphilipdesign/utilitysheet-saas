# Plan: Seller forms list and editor UX polish

## Status

Completed (2026-10-07, Claude Opus 5.5), committed. Owner asked in chat for
all of the review findings to be implemented, aimed at non-technical users.

## Objective

Make the Seller forms list and the form editor easy to scan and act on without
changing storage, APIs, links, plan gating or the seller flow.

## Verified facts

- `FormsWorkspace` renders on `/dashboard/forms` and inside Settings `?tab=link`.
- `PATCH /api/seller-forms/[id]` accepts a partial body plus `revision`
  (`sellerFormUpdateBodySchema`), including `{ isActive }` alone.
- 136 of 137 link scopes had exactly one form on 2026-10-06 (handoff aggregate).
- A paused form's public link returns a generic not-found response.
- Shared `PageHeader`, `EmptyState`, `Textarea`, `DropdownMenu` and `Dialog`
  exist. The shared `Select` is not used anywhere, native selects are; the
  shared `StatusBadge` is request-status specific.
- `QuestionCollectionSwitches`, `AdvancedModuleConfigurator` and
  `SellerQuestionsDialog` are shared with request creation and stay unchanged.

## Scope

List page (`components/seller-forms/`):

1. One form (and it is the default): no Main link card, no "also opens from"
   line. The card shows one link; "Rename link" renames the main link.
2. Two or more forms: compact Main link card (link, Copy, Rename on paid,
   which form it opens).
3. Form card: solid Copy link, Edit beside it, a "more" menu with Preview,
   Duplicate, Rename link, Make default and Pause/Resume. Paused cards also
   show a visible Resume button.
4. Pause and Resume act immediately from the card. Pause and Make default use
   the app dialog instead of the browser confirm box.
5. "Active" badge removed; Default and Paused badges stay. Usage line moves
   under the list. Shared page header, empty state, styled error and loading.

Editor (`FormEditor.tsx`):

1. Sections: Basics, What sellers are asked, Branding, Link and availability.
2. Sticky bar with status, Preview and Save; save errors and the reason Save
   is disabled show in the bar.
3. Pause/Resume is immediate (same dialog as the list), no longer part of the
   saved draft. New forms start active.
4. "Packet mode" select becomes two labeled choices under "Sheet type".
   Shared `Textarea`; consistent native select styling.
5. Discard and reload confirmations use the app dialog.

New small shared piece: `components/ui/confirm-dialog.tsx`.

## Out of scope

API, schema, link resolution, plan limits, the seller wizard, request creation,
and the shared question/module components.

## Acceptance criteria

- Single-form workspace sees one link and one Copy button, no Main link card.
- Every previous capability is still reachable (rename main link and endings,
  duplicate, preview, make default, pause, resume, upgrade explanations).
- Free plan still cannot rename links; downgrade notes remain.
- Save failures are visible without scrolling; disabled Save states its reason.
- No horizontal overflow at phone width.

## Validation

`tsc`, ESLint on changed files, `tests/saved-seller-forms.spec.ts` on all three
Playwright projects (updated for the new controls), Vitest files that touch
these components, and desktop plus phone screenshots reviewed.

## Risks

- Test selectors for moved controls change; the spec is updated alongside.
- Immediate pause in the editor bumps the form revision while a draft is open;
  the editor adopts the returned revision and keeps the draft.

## Outcome

Implemented as scoped. Deviations and details:

- The save confirmation shows in the editor's save bar instead of a toast: on a
  phone the toast covered the bar and blocked Save (caught by Mobile Safari).
  Pause/Resume in the editor are quiet for the same reason.
- "Internal form name" is now "Form name"; "Seller introduction (optional)" kept.
- `FormsWorkspace` takes `embedded` for the Settings tab (h2 instead of the
  page header). `FormCreationAction` now only renders "New form"; Duplicate is
  a card menu item using the exported `FormLimitDialog` and `newFormHref`.
- Free plan: "Rename link" shows an "Upgrade" badge and opens billing (owner follow-up; see `.ai/decisions/2026-10-07-dashboard-ui-conventions.md`).
- Native selects kept (shared `Select` is unused in the app).

Validation (Node 20.19.0, live service keys blanked in the process only):
`tsc`; ESLint on changed files; `tests/saved-seller-forms.spec.ts` 39/39 on
Desktop Chrome, Mobile Safari and Mobile Chrome, including a new single-form
test and pause/resume assertions; full Vitest 201 files / 1409 tests passed,
native PostgreSQL file skipped (binary path not set; no storage code changed);
security scan. Desktop and phone screenshots reviewed. Not checked in a
signed-in browser or on the hosted site.
