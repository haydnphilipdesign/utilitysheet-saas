# Current task: HOA relabel and requested-questions admin view, deployed

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

- Full Vitest: **884 passed across 164 files**.
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

## Open defect found, deliberately not fixed

Raised by the product owner and confirmed: advanced mode does **not** skip Home
Basics, so the relabel covers both modes. Verifying that surfaced a separate
inconsistency, recorded in §2a of the plan:

- Advanced packet PDF renders Home Basics (`packet-html.ts:638`, unconditional).
- Advanced packet **web page does not** (`app/packet/[token]/page.tsx:313`,
  `!isAdvanced ? [...] : []`), and the advanced sections do not carry it either.

So an advanced packet's two formats disagree about what the buyer sees. Probably
a bug; one line to change. Held back because it alters every live advanced
packet and the owner is travelling and cannot review it. **Requires an owner
decision before it ships.**

## Still blocked

The HOA question group (§6 of the plan): Home Basics placement versus a 6th
handoff module. Needs the `question_requests` data, now readable at
`/admin/question-requests` once deployed, plus Alisha's plan tier. Do not begin
implementation before that.

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

1. After deployment, open `/admin/question-requests` and read the list against
   the concentrated-versus-long-tail rule. Check Alisha's plan tier.
2. Decide the §2a advanced-packet Home Basics inconsistency.
3. Then approve Option A, switch to Option B, or record that the evidence points
   at the builder.
