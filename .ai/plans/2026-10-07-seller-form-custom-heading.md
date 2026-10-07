# Plan: Custom heading and prefilled introduction on seller forms

## Status

Completed (2026-10-07, Claude Opus 5.5). Owner approved the approach in chat and
then authorized the migration, commit and push to main. Migration applied.

## Objective

Let a workspace customize the heading sellers see first on a reusable seller
link, show the standard wording inside the editor so it is clear what is being
edited, and preview the first screen while editing.

## Verified facts

- The first screen of a reusable link is `components/intake/IntakeLinkScreen.tsx`.
  Its heading was hardcoded; `intake_links.seller_intro` (500 characters)
  replaced the whole default paragraph, including "Your progress saves
  automatically."
- `save_seller_form` (8-argument) is the only writer of form configuration and
  ignores unknown keys in `p_config`.
- Query code reads `intake_links` with `SELECT *`, so new application code runs
  safely before the column exists (the heading reads as empty and saving it is
  ignored) and the migration is safe before the new application.
- `requests.seller_intro` is a snapshot shown on the seller welcome step. A
  request made from the dashboard never passes through the link's first screen.
- The introduction is not plan-gated.

## Scope

1. New `intake_links.seller_heading` (nullable, 80 characters), written through
   `save_seller_form`, validated in `sellerFormFieldsSchema`, returned by the
   seller-forms API and the public link metadata, copied on duplicate, included
   in the account data export. Not plan-gated, matching the introduction.
2. Shared wording in `lib/seller-forms/intro-copy.ts`; shared first-screen block
   `components/intake/IntakeIntro.tsx` used by the public screen and the editor.
3. "Your progress saves automatically." becomes a fixed line that custom text no
   longer removes.
4. Editor: heading and introduction are prefilled with the standard wording for
   the form's Branding Profile. Unchanged or emptied text is stored as empty so
   it keeps following the profile name. A live preview of the first screen sits
   under the fields.
5. A seller who arrives from a reusable link does not see the introduction a
   second time on the welcome step (browser session marker only). Requests
   created from the dashboard still show it there.

Out of scope: a heading on per-request links (no request snapshot column),
plan gating, rich text.

## Files

`migrations-seller-form-heading.sql` (new), `schema.sql`,
`lib/validation/schemas.ts`, `lib/neon/queries/{intake-links,account-data}.ts`,
`lib/seller-forms/{config,intake,intro-copy}.ts`,
`components/intake/{IntakeLinkScreen,IntakeIntro}.tsx`,
`components/seller-forms/{FormEditor,types}.ts(x)`,
`components/seller-form/SellerWizard.tsx`, tests, `docs/saved-seller-forms.md`.

## Acceptance criteria

- A saved heading replaces the default heading on the link's first screen; an
  empty one keeps the default.
- Opening a form with no custom text shows the standard wording in both fields,
  and saving without edits stores nothing.
- The preview updates as the fields and the Branding Profile change.
- The progress line shows with and without custom text.
- Headings over 80 characters are rejected by the API and the database.

## Validation

Focused Vitest (routes, storage, helper), `tsc`, ESLint on changed files,
saved-forms and intake Playwright specs, security scan.

## Outcome

Implemented as scoped. Deviations and details:

- The account data export reads the heading with
  `to_jsonb(intake_links)->>'seller_heading'` so the export keeps working if the
  application is deployed before the migration.
- Each field has a "Use the standard ..." control once it is customized.
- The editor labels are now "Seller heading" and "Seller introduction" (the
  "(optional)" suffix is gone because the fields are prefilled).
- `tests/unit/seller-forms-native.test.ts` and
  `tests/unit/seller-form-base-links-storage.test.ts` apply the new migration as
  the fourth file in the chain.

Validation (Node 20.19.0, `DATABASE_URL`/`RESEND_API_KEY`/`GOOGLE_AI_API_KEY`
blanked in the process only): `tsc`; ESLint on changed files (no new warnings);
full Vitest 202 files / 1413 tests passed with the native file skipped, then the
native PostgreSQL file 12/12 with `SAVED_FORMS_TEST_PG_BIN`; saved-forms and
intake Playwright specs 48/48 across three device profiles; security scan;
`git diff --check`; desktop and phone editor screenshots reviewed (fields
only, the preview card was below the fold and is covered by the browser spec).

Not verified: signed-in browser, dark mode, hosted site.

Follow-ups the same day, approved by the owner in chat:

- Standard introduction no longer says "Your agent at"; it reads "<name> is
  helping with the sale of your home and sent you this link to collect utility
  information for the buyer."
- Seller screens no longer assume an agent (submit spinner, success, status
  notice, reopened notice, "I'm not sure" hint, contact footer, broken-link
  messages on `/s`, the link screen and `/packet`). Email fallbacks
  (`lib/email/email-service.ts`, "Your agent") were left alone: reminder
  retries must reproduce the exact rendered payload.
- Form editor links to the selected Branding Profile (new tab, so an unsaved
  draft is kept); the Branding list links each profile to the owner's seller
  forms that use it; the profile's welcome message is labelled "Welcome message
  for the buyer" with a pointer to seller forms.

Final validation: `tsc`; ESLint on changed files (warnings only, none new);
full Vitest with native PostgreSQL 203 files / 1425 tests passed; full Desktop
Chrome Playwright 48 passed, 7 skipped; saved-forms and intake specs 48/48 on
three device profiles (before the wording pass; those specs assert none of the
changed strings); production build; security scan.

Migration applied to the configured Neon database with psql 17, stop-on-error
and transaction-local 10s lock / 180s statement timeouts. Aggregates only:
137 forms before and after; fingerprint of every form row (ignoring the new
column) identical; column present; the 8-argument writer now references
`seller_heading`; no heading set yet.

## Risks

- A form whose existing custom introduction already says progress is saved will
  now show that twice (custom text plus the fixed line). Not checked against
  live data.

- The migration replaces `save_seller_form`; its body must match the current
  `schema.sql` definition apart from the new column. Applying it to a live
  database needs owner authorization.
