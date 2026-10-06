# Packet and PDF: print handoff answers the way Review shows them

- Status: completed 2026-10-06 (Claude Opus 5.5). Committed on main on top of e53bb1a, not pushed. No required work remains.
- Follows: `.ai/plans/2026-10-06-ux-form-logic-review.md` (finding 4 changed Review only), `docs/pdf-system-reference.md`.
- Not authorized: migrations, production database access, changing stored sheets, real email, commit, push, deploy.
- Concurrent work: another session is editing the reopen follow-ups (Admin, reminders, time-claim copy, product updates) in the same worktree. No file overlap with this task except `.ai/CURRENT.md`, where this task only adds its own section.

## Verified facts

- Stored handoff answers live in `requests.advanced_packet_data`. The only code that turns them into display text for the completed sheet is `formatAdvancedDisplayValue` in `lib/packet/packet-data.ts`, called from `normalizeAdvancedSections`. Its output (`advanced_sections[].fields[].value`) is printed verbatim by:
  - the web packet, `app/packet/[token]/page.tsx`, which fetches `GET /api/packet/[token]`;
  - the PDF, `buildAdvancedSectionsMarkup` in `lib/pdf/packet-html.ts`, for the public PDF route, the browser download and the email attachment (`lib/pdf/packet-attachment.ts`).
- The Review step uses `getAdvancedAnswerRows` in `lib/packet/modules.ts`.
- The branding preview and test PDF (`lib/branding/preview-data.ts`) build sections from metadata `example` strings. The coded fields have no example, so the preview never shows them and formats nothing.
- The completion email body shows no handoff values (it attaches the PDF). The account data export returns the stored JSON as data.
- The two input forms keep their own option label lists (`AdvancedDetailsStep.tsx`, `SubmittedSheetEditor.tsx`). They are inputs, not the sheet, and are out of scope; noted as optional follow-up.
- Old formatter differences from Review: prints codes raw (`mon, wed`, `apr`, `not_sure`); turns any whole value `yes`/`no` in any field, in any letter case, into `Yes`/`No` (so a mailbox number typed `no` printed `No`); trims scalars.
- Text answers are trimmed when stored (`optionalNullableText`), the choice and weekdays are enums, the two month fields are free text up to 32 characters that the forms fill from a select.
- The seller form has hidden the irrigation detail fields while the answer is No since commit 1bbe5d5 but kept sending them until 69b485c, so an older sheet with No plus details usually holds details the seller could not see when submitting. The coordinator editor showed all fields before 69b485c.

## Approach

1. `lib/packet/modules.ts`: `getAdvancedAnswerRows` stays the single definition. Harden the code lookup to own keys only.
2. `lib/packet/packet-data.ts`: `normalizeAdvancedSections` builds its fields from `getAdvancedAnswerRows`; delete `formatAdvancedDisplayValue`. Renderers are untouched, so pagination rules, selectable text, gating and asset handling do not change.
3. Irrigation No plus stored details: the owner chose to hide them at print time (2026-10-06). This is what `getAdvancedAnswerRows` already does, so no flag was added. No stored data is rewritten. Decision: `.ai/decisions/2026-10-06-handoff-answers-one-display-definition.md`.
4. `docs/pdf-system-reference.md`: correct the "Scalar display values" paragraph.

## Acceptance

- Web packet and PDF print `Mon, Wed`, `April`, `Not sure`, `Yes`, `No` for the four coded fields, from the same function Review uses.
- Free text, phone numbers and access codes are unchanged byte for byte, including a note containing `mon` and a mailbox number `no`.
- Field order, labels, exclusions and empty-section removal unchanged.

## Validation

- Unit: `packet-data.test.ts`, `packet-html.test.ts`, `advanced-conditional-answers.test.ts`, the other packet and PDF unit files.
- `npm exec tsc -- --noEmit`; ESLint on changed files.
- `tests/packet-responsive.spec.ts` with mocked data.
- Local PDFs from synthetic data, before and after, full irrigation section; page count and wrapping compared.

## Outcome

- Changed: `lib/packet/modules.ts` (own-key code lookup, comment), `lib/packet/packet-data.ts` (uses `getAdvancedAnswerRows`; `formatAdvancedDisplayValue` deleted), `docs/pdf-system-reference.md`, tests `tests/unit/packet-data.test.ts`, `tests/unit/packet-html.test.ts`, `tests/packet-responsive.spec.ts`. `lib/pdf/packet-html.ts` and `app/packet/[token]/page.tsx` were not edited.
- Behavior differences from the old formatter, all intended: codes print as labels; typed `yes`/`no` in a text field is no longer capitalized; values are no longer trimmed at print (text is trimmed when stored, and HTML collapses edge spaces); empty array items are dropped; an irrigation No hides stored details.
- PDF check through the production Chromium path with the Advanced preview fixture plus a full irrigation section (all seven days, February to September, a two-line note): 2 pages before and after, identical row heights (46.9, 46.9, 46.9, 64 CSS px), the same page break (after the season months row, notes on page 2 under the repeated heading), text extraction differs only in the translated values. Both pages inspected.
- Validation: full Vitest 199 files passed, 1 skipped; 1354 tests passed, 8 skipped. `tsc --noEmit` clean. ESLint on changed files clean. `tests/packet-responsive.spec.ts` on Desktop Chrome, Mobile Safari (WebKit) and Mobile Chrome: 9 passed. `security:scan` passed. `git diff --check` clean.
- Not verified: real stored sheets (no database access, so the number of older sheets with No plus details is unknown), the hosted PDF runtime (`@sparticuz/chromium`; local Chrome was used), the email attachment end to end, `next build`.
- Optional follow-up: derive the option lists in `AdvancedDetailsStep.tsx` and `SubmittedSheetEditor.tsx` from the labels in `modules.ts`.
