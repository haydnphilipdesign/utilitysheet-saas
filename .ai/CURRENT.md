# Current task: HOA question group shipped; custom-questions evaluation proposed

- Date: 2026-10-01. Agent: Claude Opus 5.5 (Claude Code). Branch: `main`.
- Status: **HOA question group complete. No required work remains on it.**
  Migration applied to production; application code committed and pushed to
  `main` with explicit product-owner authorization (see git log). The push
  triggers a deployment.
- Plan: `.ai/plans/2026-09-19-hoa-question-group.md` (Completed). Section 13 is
  the implementation record and full validation results.
- Decision: `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md` (Accepted).
- Customer record: `docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md`.
- Next proposed work, **not started**:
  `.ai/plans/2026-10-01-custom-questions-evaluation.md` (Proposed).

## What shipped

Every seller form, on every plan and in both packet modes, now asks "Is this
home part of an HOA or condo association?" on Home Basics. A Yes reveals optional
details: association name, management company, contact name, phone, email, dues
amount, dues period, and where dues are paid or documents are found. No and Not
Sure cost one tap.

The answers flow through the review step, the seller submission, the
submitted-sheet editor, the public packet page, and the PDF. All of it reads one
declaration in `lib/packet/hoa.ts`.

Also fixed in passing, because the new work touched them:

- `components/seller-form/steps/ReviewStep.tsx` showed the old bare "HOA / Condo"
  for the water/sewer billing option. It now uses the shared labels.
- The PDF capitalized Home Basics values with CSS, printing "Included In HOA /
  Condo Fee". Removed.

## Database

`migrations-hoa-questions.sql` applied to production twice on 2026-10-01, both
with explicit owner authorization: six columns, then three more
(`hoa_management_contact`, `hoa_management_email`, `hoa_dues_frequency`). Target
`.env.local` Neon database `neondb`, host SHA-256 prefix `79d6a988e446`.
`requests` is now 39 columns, with `requests_has_hoa_check` and
`requests_hoa_dues_frequency_check`. All 964 existing rows untouched. `schema.sql`
mirrors the final shape. Catalog and aggregate checks only; no credentials or
row data were printed.

## Owner decisions recorded this session

1. Option A (Home Basics, Free plan).
2. Add contact name, contact email, and dues period.
3. Do not collect HOA portal logins for now.
4. Detail questions behind Yes only; all three answers print.
5. Only `has_hoa` enters seller telemetry.
6. Look into custom questions, to decide whether they are worth building.

## Validation

- Vitest: **926 passed across 167 files.**
- `npm exec tsc -- --noEmit`: clean.
- `npm run build`: succeeded.
- `npm run security:scan`: passed.
- Lint: 2 errors, both pre-existing and unrelated
  (`components/admin/EventLogTable.tsx:6`; a local ignored file under
  `.qa-artifacts/`). None in changed files.
- Playwright: seller, packet, intake, and test-drive specs pass on desktop and
  both mobile browsers (36 runs, mocked APIs), including a new HOA journey.
- PDFs rendered through the production pipeline and inspected page by page;
  results in `docs/pdf-system-reference.md`.
- The exact seller and editor `UPDATE` statements were executed against
  in-memory Postgres built from `schema.sql`.

## Known issues, not caused by this work

- **`tests/marketing-mobile.spec.ts` fails 6 of its mobile runs**, including
  when run alone. It asserts landing-page copy that no longer matches the page
  ("utility handoff." against the current headline). This makes
  `npm run test:e2e:mobile` exit non-zero. Unrelated to HOA; needs its
  assertions updated to the redesigned marketing page.
- The two pre-existing lint errors above.

## Not verified

A real seller submission against the deployed site. Everything short of that
was exercised. The first production submission with an HOA answer is the first
run through real services.

## Optional follow-up (none required)

1. Reply to Alisha's second message. A truthful summary is at the end of the
   customer record.
2. Check one live submission once a seller answers the HOA question: the packet
   page, the PDF, and the editor.
3. Add `user-feedback/` to `.gitignore` (see cautions).
4. Show HOA answers in the branding preview sample, the demo seed, and the admin
   request detail page. Left out deliberately; the preview stays one page.
5. Carried over: eyeball a live handoff packet's Home Basics card (from
   `e244484`); decide the fate of the unused question-gap capture control (now
   step 3 of the evaluation plan).

## Deferred, documented for later

`docs/product-feedback/2026-10-01-hoa-deferred-capabilities.md` covers the two
things the customer asked for that were not built: the seller's HOA portal login
and association document upload. Each has the reason it was deferred, what a
safe version needs, a cheaper thing to test first, and what would justify
revisiting.

## Cautions

- `user-feedback/` is untracked and **must not be committed**: it holds a
  customer's contact details and two copyrighted forms. It is not in
  `.gitignore`, so a blanket `git add` would pick it up. Stage files by name.
- Do not add a secret to the HOA question group. Its answers print on the
  buyer's packet and are returned to the seller form to prefill a resubmission.
- The custom-questions evaluation is an evaluation. It does not authorize
  building. The verdict in
  `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` (Idea 2)
  stands until that evaluation produces a decision record.

## Concurrent editing

None known. The worktree holds only the untracked `user-feedback/` folder.

## Next concrete action

Owner: confirm or adjust the thresholds in section 7 of
`.ai/plans/2026-10-01-custom-questions-evaluation.md`, then begin its step 1 by
listing the question requests received by email so far. No engineering is
needed for steps 1, 2, and 4.
