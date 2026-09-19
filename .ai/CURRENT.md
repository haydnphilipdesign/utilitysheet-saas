# Current task: HOA relabel and admin view shipped; HOA question group on hold

- Date: 2026-09-19. Agent: Claude Opus 5. Branch:
  `claude/utility-sheet-custom-questions-mkzek4`, merged to `main` and pushed
  with explicit product-owner authorization. Status: **both shipped items
  complete and validated.** The HOA question group remains proposed and blocked.
- Plan: `.ai/plans/2026-09-19-hoa-question-group.md` (Proposed, not approved).
- Trigger: customer feedback from Alisha Starkey
  (`admin@abovebeyondvs.com`, user `f2f7661e-19e2-4040-aa70-fa499bd45dcc`),
  2026-09-19.

## Shipped 1: HOA/Condo relabel and Home Basics display labels (`2d77177`)

The `hoa` option on water source and sewer type means the association bills the
utility. It rendered as a bare "HOA / Condo" with no hint, so sellers read it as
"are you in an HOA?". That is not merely confusing:
`SellerWizard.tsx:301-304` gates the provider step on `water_source === 'city'`
/ `sewer_type === 'public'`, so a misread **silently drops the provider from the
packet**. Both packet surfaces also printed the raw enum, so buyers saw
"Water Source: hoa" (PDF) and "Hoa" (web).

- `lib/packet/seller-questions.ts`: relabelled to "Included in HOA / Condo Fee"
  with the hint "The association pays this bill". Added `HEATING_TYPE_OPTIONS`
  and `getWaterSourceLabel` / `getSewerTypeLabel` / `getHeatingTypeLabel` over a
  shared `findChoiceLabel`, which `getFuelSourceLabel` now also uses. Unknown
  values fall back to the humanized string, preserving prior behavior.
- `lib/pdf/packet-html.ts`, `app/packet/[token]/page.tsx`: resolve through those
  helpers. Dropped the `capitalize` class on the web view, which would have
  rendered the new label as "Included In HOA".
- `components/requests/SubmittedSheetEditor.tsx`: same relabel in that file's own
  sentence-case convention. It still declares its own option lists rather than
  importing the shared ones. **Left deliberately**: importing would retitle every
  option in that dropdown, an unrelated visual change. Optional cleanup only.
- `tests/unit/home-basics-labels.test.ts` (new, 4 tests).

## Shipped 2: `/admin/question-requests` read-only triage view (`6762166`)

The gap-capture slice shipped no admin UI by design (D4), so `question_requests`
had never been read. This makes it readable without a psql session, including
from a phone.

- `lib/admin/question-requests.ts`: query plus pure shaping, following the
  `lib/admin/` convention used by `operations-overview.ts`. Its paid predicate
  deliberately mirrors `paid_accounts` in `lib/admin/operations-overview.ts`;
  changing one side requires changing the other.
- `app/(admin)/admin/question-requests/page.tsx`: presentation only. Totals,
  distinct accounts, last 30 days, Free/paid split, breakdowns by capture
  surface and packet mode, then the submissions as a wrapping list rather than a
  wide table so it reads on a phone. Carries the fields-versus-builder decision
  rule and a sensitivity warning about the free text.
- **Read-only by design.** No status mutation, so no reason string and no audit
  entry are required. Adding a write path would change that.
- Protected by the existing `requireAdmin()` guard in `app/(admin)/layout.tsx`.
  No new auth surface.
- Nav entry added under Growth & Content; `ADMIN.md` route list and nav
  paragraph updated.
- `tests/unit/admin-question-requests.test.ts` (new, 7 tests).
- The table exists in production: `migrations-question-requests.sql` was applied
  2026-09-03 with authorization and verified. **No migration was needed or run.**

## Validation

Run on the merged tree:

- Full Vitest: **887 passed across 164 files**.
- `npm exec tsc -- --noEmit`: clean.
- Full lint: 1 error, `components/admin/EventLogTable.tsx:6` `no-explicit-any`.
  Pre-existing, unrelated, untouched; already recorded in the 2026-09-03 notes.
- `npm run security:scan`: passed.
- `npm run build`: **compiles successfully and passes TypeScript**, then fails at
  "Collecting page data" on a missing `NEXT_PUBLIC_STACK_PROJECT_ID`. Verified
  **pre-existing** by building clean `main`, which fails identically. This
  container has no environment variables; it is not a regression. A full
  production build was therefore not exercised here, and deployment is the first
  place it runs with real configuration.
- Not run: Playwright. No flow behavior changed.

## Shipped 3: advanced-packet Home Basics parity (see git log)

Raised by the product owner and confirmed: advanced mode does **not** skip Home
Basics, so the relabel covers both modes. Verifying that surfaced a real
inconsistency, since fixed with authorization:

- The advanced packet PDF rendered Home Basics; the web page did not
  (`app/packet/[token]/page.tsx`, `!isAdvanced ? [...] : []`), so the two
  formats of one packet disagreed about what the buyer saw.
- Git history shows the guard carried no rationale: it arrived in the squashed
  initial import and was never revisited.
- Fixed structurally rather than by deleting the guard. Both surfaces now render
  from a shared `getHomeBasicsRows` in `lib/packet/seller-questions.ts`, so they
  cannot diverge again.
- **The PDF output is unchanged**, since it was already correct. No pagination
  risk was introduced. Only the web view gained the section.
- `tests/unit/home-basics-labels.test.ts` extended to 7 tests, including a
  parity assertion across both packet modes.

## On hold: HOA question group

**Product owner decision, 2026-09-19: hold implementation.** Not blocked on
evidence any more, blocked on migration access.

- The owner read `/admin/question-requests` and found **zero submissions**.
- Verified before drawing any conclusion from that: `QuestionGapCapture` is
  still mounted on both surfaces and still outside the packet-mode conditionals
  (`app/dashboard/settings/page.tsx:1350` after the advanced block closes at
  1333; `app/dashboard/requests/new/page.tsx:973` before it opens at 978). The
  D2 reachability guard holds, so the instrument works and the zero is real.
- The demand is real but arrives by email, not through the capture. The owner
  reports repeat asks; Alisha had exactly the feedback the control exists to
  collect and emailed instead. The control is a collapsed `<details>` in a
  Settings section, which is low-affordance by design.
- **Consequence:** an empty set fires neither branch of the concentrated-versus-
  long-tail rule, so waiting on the table is no longer a sensible gate. What the
  inbox holds is one named field plus a capability request with no fields named,
  which is not builder evidence. The evidence gate on **HOA specifically** is
  released. The gate on a **general custom-question builder** stands.
- **Owner leans Option A** (Home Basics), on the grounds that it should be
  available on the Free plan. These are the same choice: Home Basics is asked on
  every form, in both modes, on every plan. Recorded as a direction, not a final
  approval.
- **Blocker:** Option A adds columns to `requests`, and the owner has no Neon
  credentials until roughly 2026-09-30.
- A no-migration shortcut exists via `requests.advanced_packet_data` (JSONB, on
  every row regardless of mode) and was **rejected**: that column is named for
  advanced packets, filtered through the advanced exclusions model, and read
  only when `mode === 'advanced'`. Using it for Free-tier Home Basics answers
  would create a misnamed second storage path. Not worth an eleven-day saving.
- The owner has replied to Alisha. No customer follow-up is outstanding.

No decision record was created under `.ai/decisions/`: the Option A direction is
a lean, not a settled decision, and recording it as durable would overstate it.
Create one when Option A is confirmed.

## Risks and cautions

- Do not treat this feedback as evidence for a custom-question builder. The
  standing verdict
  (`docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` §Idea 2)
  is unchanged.
- No migration, schema change, or production data mutation was performed. The
  merge to `main` was explicitly authorized by the product owner and triggers a
  deployment.

## Concurrent editing

None known. Working tree clean.

## Next concrete action

Nothing is required until the owner has Neon credentials, expected around
2026-09-30. Then: confirm Option A, write `migrations-hoa-questions.sql`, and
**confirm before running it**.

Two optional items, neither blocking:

1. Eyeball a live handoff packet's public page. It now carries a Home Basics
   card it did not have before, above the Additional Home Details section. The
   ordering matches the PDF, but no one has seen it rendered against real data.
2. Decide what to do about the capture control. A working instrument nobody uses
   is the worst of both outcomes: either raise its affordance, or accept email
   as the channel at this scale and log those asks by hand.
