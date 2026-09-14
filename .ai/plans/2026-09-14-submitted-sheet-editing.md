# Submitted-sheet editing: completeness, usability, and polish

- Status: Completed 2026-09-14. No required work remains; see "Outcome" at the end.
- Agent: Claude Code.
- Branch: main at 7b76a93. No commit, push, deploy, migration, or production data change authorized.
- Trigger: during a demo, a trash provider answered "Not Sure" by the seller could not be replaced, cleared, or hidden in the editor, while pickup days could be changed.

## Verified current behavior

- Entry: `app/dashboard/requests/[id]/page.tsx` ("Review / Edit Submitted Sheet", Actions card) and `components/requests/RequestListActions.tsx`. Page `app/dashboard/requests/[id]/edit/page.tsx` renders `components/requests/SubmittedSheetEditor.tsx`.
- API: `app/api/requests/[id]/submitted-data/route.ts` GET/PATCH. Server enforces sign-in, owner or active-organization access, Pro/Team plan, `status = 'submitted'`, body size, Zod (`submittedSheetUpdateBodySchema`), and optimistic locking on `updated_at` (409 on conflict). Save replaces all `utility_entries` rows and logs `submitted_sheet_edited` with `changed_fields` (`lib/neon/queries/requests.ts` `updateSubmittedRequestData`).
- Editable today: property address, per-utility provider name, phone, website, electric meter number, trash recycling and pickup days, visible Advanced module fields. Read-only: water source, sewer type, heating type ("first editing release" copy).
- Seller "I'm not sure" (`components/seller-form/steps/UtilityStep.tsx` `handleSkip`) stores a row with `entry_mode = 'unknown'` and no name. Seller-skipped utilities store no row. Packet and PDF render a nameless row as "Not sure" (`lib/packet/packet-data.ts:363`, `lib/pdf/packet-html.ts:331`); absent rows are omitted.
- The editor maps a "Not sure" row, and a requested utility with no row, to the same blank provider input (`lib/submitted-sheet/editor.ts` `buildSubmittedSheetUtilities`). Nothing indicates the seller was unsure.
- Save writes every row as `free_text` and skips rows with no name, contact, meter, or trash detail (`buildSubmittedSheetUtilityInsertRows`).
- API responses are `no-store` (`next.config` headers); the PDF route is `no-store`; the web packet fetches on load. No stale-cache path found.

## Confirmed gaps

1. Reported issue. Replacing "Not sure" works only by typing into an unlabeled-looking blank field (too hard to discover). Removing a utility from the sheet has no control (missing). Clearing a name keeps "Not sure", so "clear" is indistinguishable from "Not sure".
2. Bug: saving any unrelated change silently deletes every "Not sure" row that has no supplemental details (for example Gas: Not sure disappears), while a trash "Not sure" row with pickup days can never be removed. `entry_mode = 'unknown'` is lost on save.
3. Home basics "Not sure" answers cannot be corrected or removed.
4. Download PDF during unsaved edits silently downloads the last saved version. No unsaved-change indicator, no discard confirmation on Cancel/Back, no navigation warning.
5. Invalid website or short address fails only on the server with a generic "Invalid submitted sheet payload" toast.
6. Accessibility: field labels are not associated with inputs or selects; pickup-day single-value buttons lack pressed state.
7. Visual: emerald Save, loader, and safeguards card conflict with the slate `--primary` design system; long safeguards paragraph dominates; repeated per-card descriptions; trash card has duplicated weekday and "Not set / Varies / Not sure" rows; two Save buttons; three header buttons wrap on mobile.

## Decisions (routine, reversible; no schema change)

- Correct vs clear vs hide. Each utility gets one explicit "On the info sheet" choice that maps onto existing storage, not a new visibility system:
  - Provider: name required; stored as a named row.
  - Not sure: stored as a nameless row with `entry_mode = 'unknown'`; renders "Not sure"; phone, website, meter, and trash details stay editable.
  - Not included: no row; the utility is omitted from the web packet and PDF.
  A separate "keep the row but print a blank provider" state is not added: storage cannot distinguish it from existing re-saved "Not sure" rows without a new flag, and the product's established representation for an unknown provider is "Not sure". Recorded as optional follow-up.
- Home basics become editable selects including "Not set" (omitted from Home Basics). Payload field is optional so a stale client cannot clear values.
- The per-utility `status` field is optional in the schema; when absent the server infers the legacy meaning, keeping stale browser tabs safe.
- Packet and PDF rendering are unchanged; only the data they receive changes.

## Acceptance criteria

- A "Not sure" provider is visibly labeled as such in the editor, summarized near the top, and can be replaced with a named provider, kept as "Not sure", or removed from the sheet; each persists across reload and appears correctly in the web packet and PDF.
- Saving unrelated changes never removes "Not sure" rows.
- Home basics can be corrected or cleared; output reflects it.
- Unsaved state is visible; Back/Cancel with unsaved edits asks to discard; browser navigation warns; Download PDF with unsaved edits saves first, then downloads.
- Client-side validation marks the provider name, website, and address inline and blocks save; server validation still rejects bad payloads.
- Labels are programmatically associated; toggles expose pressed/checked state; touch targets are at least 40px on mobile; no horizontal overflow at 390px.
- Editor uses the shared design tokens (`--primary`, `StatusBadge`), one primary Save location, and restrained copy.
- Authorization, plan gating, token boundaries, optimistic locking, audit event, PDF layout and selectable text unchanged.

## Validation

- Unit: schema, editor helpers (status mapping, rows, changed fields), route (Not sure replace/keep/remove, unrelated save preserves Not sure, home basics), update query, and a pipeline test from saved rows to packet data and PDF HTML.
- Component test for editor states if practical.
- `npm run lint`, `npm exec tsc -- --noEmit`, `npm test -- --run`, `npm run build`.
- Browser QA at 1440px and 390px using a temporary unauthenticated harness route that mounts the real editor with Playwright-mocked API responses (the local `DATABASE_URL` is the production Neon database, so no real saves). Web packet via `/packet/[token]` with mocked data. The harness is deleted after QA.
- PDF: render representative before/after data through the production HTML builder and Chromium `page.pdf()` settings; extract text; rasterize every page and inspect.

## Files expected

`components/requests/SubmittedSheetEditor.tsx`, `lib/submitted-sheet/editor.ts`, `app/api/requests/[id]/submitted-data/route.ts`, `lib/validation/schemas.ts`, `types/index.ts`, `lib/neon/queries/requests.ts`, tests under `tests/unit/`, minor copy in `app/dashboard/requests/[id]/page.tsx`.

## Progress

- [x] Startup, investigation, plan.
- [x] Implementation. Decision record: `.ai/decisions/2026-09-14-submitted-sheet-utility-status.md`.
- [x] Tests and checks.
- [x] Browser and PDF verification, polish pass.
- [x] Final handoff.

## Outcome

Implemented:
- Per-utility "On the info sheet" choice (Provider / Not sure / Leave off sheet) mapped to existing rows; seller "Not sure" answers are labeled and summarized at the top with jump links.
- Fixed the silent removal of "Not sure" rows on unrelated saves; `entry_mode = 'unknown'` is preserved.
- Home Basics editable with "Not set"; optional payload.
- Unsaved-change status in a sticky save bar, discard confirmation on Back/Cancel, browser navigation warning, "Save & download PDF" when edits are unsaved, conflict dialog, inline validation (provider name, website, address), save feedback in the bar (not toasts, which covered the sticky Save button on phones).
- Associated labels, native radio groups (arrow keys), pressed-state day chips, reduced-motion-aware scrolling, scroll margins so focused fields clear the save bar, design-system colors (slate primary; emerald only for the saved check).
- Entry labels renamed to "Edit Info Sheet" / "Edit info sheet".

Issues found and fixed during verification: a no-wrap meta line from the polish pass widened the 390px layout (Chrome zoomed out, hiding the save bar buttons); toasts covered the sticky Save button on mobile; outline link missing its border (class merge). A global scroll padding experiment was reverted because it fought the sticky bar.

Validation:
- `npm test -- --run`: 151 files, 796 tests passed. New: `submitted-sheet-editor-helpers`, `submitted-sheet-schema-status`, `submitted-sheet-edit-pipeline` (route save to packet data to PDF HTML), `submitted-sheet-editor-component`; extended `submitted-request-update-query`; updated `requests-workspace` label.
- `npm exec tsc -- --noEmit`: pass. `npm run build`: pass. `npm run security:scan`: pass.
- `npm run lint`: 1 pre-existing error in untouched `components/admin/EventLogTable.tsx` (`any`, last changed 2026-01-15) plus pre-existing warnings; changed files lint clean.
- Browser QA (Chrome via Playwright, 1440px and 390px; overflow also checked at 360px) on a temporary harness that mounted the real editor and packet page with in-memory data through the real schema, helpers, packet mapping, and production PDF renderer (local `DATABASE_URL` is production, so no real saves). Verified: open, trash "Not sure" replaced with a provider (schedule kept), gas left off, heating corrected, save, reopen, web packet, PDF download; unrelated save keeps "Not sure"; removing trash; keyboard arrows; website validation; failed save; conflict dialog; discard dialog; save-and-download. Harness deleted before build.
- PDF: production Chromium output extracted and rasterized; one page, selectable text, correct rows, no "Not sure" after correction.

Not verified: the authenticated dashboard route itself (`/dashboard/requests/[id]/edit`) and real database persistence in a signed-in session; the request detail page button label change was not rendered in a browser. Server authorization and plan gating were not changed and remain covered by the existing route tests.

Optional follow-ups (not required): a blank-provider display state (see decision record); client-side navigation guard for dashboard sidebar links (only Back/Cancel and browser unload are guarded); web packet hides Home Basics in Advanced mode while the PDF shows them (pre-existing inconsistency); dev-mode CSP blocks Vercel analytics scripts (pre-existing console errors).

Deviation from plan: the packet utility mapping was extracted to an exported `buildPacketUtilities()` in `lib/packet/packet-data.ts` (behavior unchanged) so the QA harness and pipeline test exercise the real mapping. The editor response builder moved from the route to `buildSubmittedSheetEditorPayload()` in `lib/submitted-sheet/editor.ts` for the same reason.
