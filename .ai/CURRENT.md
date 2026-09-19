# Current task: HOA/Condo relabel shipped; HOA question group proposed

- Date: 2026-09-19. Agent: Claude Opus 5. Branch:
  `claude/utility-sheet-custom-questions-mkzek4`. Status: relabel **complete and
  validated**, committed. HOA question group **proposed and blocked on evidence**.
- Plans: `.ai/plans/2026-09-19-hoa-question-group.md` (Proposed, not approved).
- Trigger: customer feedback from Alisha Starkey
  (`admin@abovebeyondvs.com`, user `f2f7661e-19e2-4040-aa70-fa499bd45dcc`),
  2026-09-19, asking whether questions can be edited and reporting that sellers
  will misread the HOA/Condo option.

## Completed and validated

The feedback held two requests. The first was a defect in shipped copy, not a
customization request, and is fixed:

- The `hoa` option on water source and sewer type means the association bills
  the utility. It rendered as a bare "HOA / Condo" with no hint, while its
  neighbours carried hints. Sellers read it as "are you in an HOA?".
- Answering it that way is not merely confusing. `SellerWizard.tsx:301-304`
  gates the provider step on `water_source === 'city'` / `sewer_type ===
  'public'`, so a misread **silently drops the provider from the packet** and
  the customer cannot tell it is missing.
- Both packet surfaces rendered the stored enum directly: the PDF printed
  "Water Source: hoa", and the public packet page printed "Hoa" via a
  `capitalize` class over the raw value.

Changes:

- `lib/packet/seller-questions.ts`: `hoa` relabelled to "Included in HOA /
  Condo Fee" with the hint "The association pays this bill" on both water and
  sewer. Added `HEATING_TYPE_OPTIONS` (the stored `heating_type` set, which adds
  `not_sure` to the fuels) and the display-label helpers `getWaterSourceLabel`,
  `getSewerTypeLabel`, `getHeatingTypeLabel`, plus a shared `findChoiceLabel`
  that `getFuelSourceLabel` now also uses. An unrecognized value falls back to
  the humanized string, preserving the previous underscore handling.
- `lib/pdf/packet-html.ts` and `app/packet/[token]/page.tsx`: Home Basics values
  resolve through those helpers. Removed the now-wrong `capitalize` class on the
  web view, which would have rendered the new label as "Included In HOA".
- `components/requests/SubmittedSheetEditor.tsx`: same relabel in that file's
  own sentence-case convention. **It still declares its own water/sewer/heating
  option lists rather than importing the shared ones.** Left as-is deliberately:
  converting it would change the casing of every option in that dropdown, which
  is an unrelated visual change. The new test guards the values that matter.
- `tests/unit/home-basics-labels.test.ts` (new, 4 tests): label resolution,
  unknown-value fallback, the HOA label stating billing rather than membership,
  and the PDF never emitting a raw Home Basics enum.

Validation, all run on this branch:

- Full Vitest: **877 passed across 163 files**.
- `npm exec tsc -- --noEmit`: clean.
- ESLint on changed files: 0 errors (4 pre-existing `no-img-element` warnings in
  `app/packet/[token]/page.tsx`, untouched by this work).
- Full lint: 1 error, `components/admin/EventLogTable.tsx:6`
  `no-explicit-any`. Pre-existing and unrelated; already recorded in the
  2026-09-03 plan's validation notes. Not touched.
- `npm run security:scan`: passed.
- Not run: Playwright. No seller-flow behavior changed, only labels.

Environment note: `npm ci` was needed; this container starts as a bare clone.

## Blocked, and why

The second request, "is this property in an HOA?", is planned but **must not be
implemented yet**. `.ai/plans/2026-09-19-hoa-question-group.md` §6 holds the open
decision: Home Basics (reaches everyone, needs a migration) versus a 6th handoff
module (Pro-only, no migration). Alisha's feedback concerns water/sewer, so she
was on the Simple sheet; a Pro-only module may not reach her at all.

Two inputs settle it, neither obtainable from this container:

1. **`question_requests` has never been read.** The gap-capture slice
   (`.ai/plans/2026-09-03-question-gap-capture.md`, shipped `6024d80`) was built
   precisely to decide fields-versus-builder, and D4 deliberately shipped no
   admin UI, so reading it needs psql against production. The decision rule was
   fixed in advance: concentrated demand means build the fields; a varied long
   tail means the builder. The query is in §6 of the new plan.
2. **Alisha's plan tier** (Free or Pro), which changes both the recommendation
   and the reply to her.

This session had no database access: no `DATABASE_URL`, no `.env*` files. The
product owner is travelling without desktop access until roughly 2026-09-30, so
neither input is available in the near term.

## Risks and cautions

- Do not treat this feedback as evidence for a custom-question builder. The
  standing verdict against it
  (`docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` §Idea 2)
  is unchanged, and the HOA half of the message argues for a built-in.
- No live database action, migration, deployment, or production mutation was
  performed. None is authorized.

## Concurrent editing

None known. No other agent work in progress. Working tree is clean apart from
this committed work.

## Next concrete action

Owner decision, in this order:

1. Review and deploy the relabel. It is independent of everything else and fixes
   a live data-loss path for every user.
2. On return to desktop, run the `question_requests` query in §6 of the new plan
   and check Alisha's plan tier.
3. Then approve Option A, switch to Option B, or record that the evidence points
   at the builder after all.

Optional follow-up, not required work: build the admin triage view for
`question_requests` that the 2026-09-03 plan named as a follow-up. It would make
step 2 readable from a phone instead of requiring a psql session.
