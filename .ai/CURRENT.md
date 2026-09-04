# Current Work

## Session Metadata

- Task: Discoverability slice from the Michelle Wright evaluation. Rename the
  customer-facing packet mode to "Property Handoff Packet", add a searchable
  inventory of all built-in seller questions, and add an accurate preview of what
  the seller will be asked for the current configuration.
- Intended outcome: A user on any plan can answer "can UtilitySheet collect X?"
  without toggling modes, and the mode's name stops hiding what it contains.
- Status: **Completed.** Implemented and validated. No required work remains.
  Nothing was committed or pushed.
- Current or last agent: Claude Opus 5
- Branch: `main`
- Last updated: 2026-09-04
- Relevant plan:
  `.ai/plans/2026-09-04-packet-rename-and-question-discoverability.md` (Completed)
- Issue/PR: none

## Outcome

Three things shipped together.

1. **Rename.** "Advanced Utility Packet" is now "Property Handoff Packet"
   everywhere a customer can see it. "Simple Utility Sheet" is unchanged. The
   stored enum values `simple` and `advanced` are untouched: no migration, no
   schema change, no API contract change, and `schema.sql` shows no diff.
2. **Question inventory.** A searchable list of all 51 built-in seller questions
   across 15 sections, each marked Included or Not included for the current
   configuration.
3. **Seller preview.** An accurate preview of what this form asks, derived from
   the live configuration and honest about which sections a seller may never
   reach.

### Naming as shipped

- Simple Utility Sheet, core utility information.
- Property Handoff Packet, utilities plus home access, systems, service providers,
  and other property details.
- Supporting copy: "Collect utilities, home systems, access details, and
  service-provider information in one seller handoff."

These live in `PACKET_MODE_LABELS`, `PACKET_MODE_SHORT_LABELS`,
`PACKET_MODE_DESCRIPTIONS`, and `PROPERTY_HANDOFF_PACKET_SUPPORTING_COPY` in
`lib/packet/modules.ts`. Dashboard surfaces and API messages read the labels from
there; marketing prose stays literal.

### Where the new UI lives

`SellerQuestionsDialog` is mounted on both configuration surfaces, **outside** the
packet-mode conditional, so it is reachable on Free and in Simple mode:

- `app/dashboard/settings/page.tsx`, in the "What sellers are asked" section.
- `app/dashboard/requests/new/page.tsx`, in the packet-mode step.

It has two tabs. **This form** previews the live configuration. **All questions**
is the searchable inventory, and it lists every handoff question even in Simple
mode, marked "Not included", so a Free user can see what the paid mode adds
without switching anything.

### Inventory contents

15 sections, 51 questions: 5 Home Basics, 13 utility (9 provider questions plus
the electric meter number and three trash questions), and the 33 handoff
questions. The evaluation's "33 built-in questions" counted only the handoff
modules; the seller is asked more than that.

### Preview accuracy, and why it needed care

`components/seller-form/SellerWizard.tsx:296-329` decides which utility steps a
seller reaches, and it is not simply "the configured categories". Electric is
always shown. Water and sewer depend on the seller's own Home Basics answers. Gas,
propane, and oil depend on selected fuels. Trash, internet, and cable are seller
opt-in. `getSellerQuestionPreview` mirrors those rules and states each one in the
UI, so the preview never implies every configured section will be asked.

The electric meter question follows the account preference
`notification_preferences.collect_electric_meter_number`, defaulting to true.
Settings already held it. The request-creation page now reads it from the
`/api/account` response it was already fetching, so no new request was added.

### Drift prevention

Core seller prompts previously lived only inside the seller components. They were
moved verbatim into `lib/packet/seller-questions.ts` and are now imported by
`HomeBasicsStep` and `UtilityStep`, so the seller form and the inventory read the
same strings. The seller-flow diff is a pure move: every rendered string is
byte-identical, verified by reading the diff.

### One thing that nearly shipped wrong

`getUtilityCondition` was written but never wired into the section builder, so the
first working version rendered a preview with no visibility conditions on utility
sections. That is precisely the over-confident preview design decision D4 existed
to prevent. It was caught by an ESLint unused-variable warning, not by a test. A
`condition` field was added to `SellerQuestionSection`, wired in, rendered, and is
now pinned by assertions in both the unit and component suites.

## Files

New:
- `lib/packet/seller-questions.ts`
- `components/seller-questions/SellerQuestionsDialog.tsx`
- `tests/unit/seller-questions-inventory.test.ts`
- `tests/unit/seller-questions-dialog.test.tsx`
- `.ai/plans/2026-09-04-packet-rename-and-question-discoverability.md`

Modified: `lib/packet/modules.ts`, `lib/marketing-content.ts`,
`components/seller-form/steps/HomeBasicsStep.tsx`,
`components/seller-form/steps/UtilityStep.tsx`,
`components/requests/SubmittedSheetEditor.tsx`,
`components/branding/UtilitySheetPdfPreview.tsx`,
`components/landing/{FeatureSection,PricingSection,TrustStrip}.tsx`,
`app/dashboard/settings/page.tsx`, `app/dashboard/requests/new/page.tsx`,
`app/dashboard/requests/[id]/page.tsx`, `app/dashboard/requests/page.tsx`,
`app/api/intake-link/route.ts`, `app/api/requests/route.ts`,
`app/api/requests/[id]/configuration/route.ts`,
`app/(marketing)/{about,faq,how-it-works,pricing}/page.tsx`,
`app/demo/page.tsx`, `app/opengraph-image.tsx`,
`docs/pdf-system-reference.md`, `docs/ai-telemetry.md`,
`docs/branding-profile-pdf-redesign-handoff.md`, and four existing test files
(`settings-reusable-link-mode`, `requests-route-advanced-gating`,
`utilitysheet-pdf-preview`, `brand-profile-form`).

Deliberately not renamed: the packet heading "Additional Home Details" and the PDF
section titles (neither carried the old term, and both are rendered output);
historical records under `.ai/`, `docs/superpowers/`, `docs/product-feedback/`,
and `tasks.md`; and every internal identifier.

## Validation Performed

- New focused tests: `seller-questions-inventory.test.ts` (23) and
  `seller-questions-dialog.test.tsx` (10) pass.
- Full Vitest: **147 files / 775 tests passed.**
- `npm exec tsc -- --noEmit`: clean.
- ESLint on every changed and new file: clean, no errors and no warnings.
- `npm run lint` (full repo): the only error is the pre-existing
  `components/admin/EventLogTable.tsx:6` `@typescript-eslint/no-explicit-any`, on
  a file this slice never touched, plus 19 pre-existing unrelated warnings.
- `npm run build`: succeeds, no errors or warnings.
- `npm run security:scan`: passed.
- `git diff --check`: clean apart from Git line-ending normalization notices.
- Manual diff review of `components/seller-form/` confirmed the extraction changed
  no rendered string.
- Confirmed `schema.sql` and `migrations-*.sql` show no diff.
- Grep sweep confirms no customer-facing surface still says "Advanced Utility
  Packet" or "advanced packet"; remaining hits are historical records and test
  descriptions naming the internal enum value.

## Scope Held

Not touched, as required: short-term-rental preset, new access fields, reusable
form profiles, custom questions, and the Safety Primitives (`sensitive` flag,
revocable packet links). Plan gating, seller-flow behavior, packet generation,
branding, and PDF rendering are unchanged.

## Remaining Required Work

None for this task.

## Owner Actions, Not Agent Work

1. **Commit and deploy.** Both this slice and the previously completed question
   gap capture (commit `6024d80`) are undeployed. The gap-capture migration is
   already applied in production, so nothing is recorded until the code ships.
2. **Send the reply to Michelle**, draft at
   `docs/product-feedback/2026-09-03-michelle-wright-reply-draft.md`. Verify her
   plan is Pro or Teams first. The draft predates this rename and still says
   "Advanced Utility Packet"; update it before sending.
3. **Decide on SEO.** Marketing meta descriptions and the OpenGraph image changed.
   That is intended, the old term concealed the mode's contents, but it does reset
   whatever ranking those exact phrases held.

## Optional Follow-Up, Not Required Work

- Measure whether the discoverability slice lifts handoff-mode adoption among paid
  workspaces. The evaluation notes adoption was already 5 of 9 Pro workspaces, so a
  flat result is evidence the problem was capability rather than discovery.
- A public "everything UtilitySheet collects" marketing page reusing
  `getSellerQuestionInventory()`, which idea B in the evaluation suggested as an
  SEO asset.
- Admin triage view for `question_requests`, carried over from the previous slice.

## Known Risks and Uncertainties

- **Preview drift.** `getSellerQuestionPreview` reimplements the utility
  visibility rules that `SellerWizard` applies. If those rules change, both must
  change. Tests pin the current rules and each file carries a comment pointing at
  the other, but nothing enforces the link mechanically.
- **Copy extraction.** Seller-visible strings now live in `lib/packet/`. An editor
  changing them changes the live seller form. That is the intent, and it is worth
  knowing.
- The rename does not add a single field. Per Finding 1 of the evaluation, front
  door codes, cameras, and Wi-Fi still have no field, so this slice will not by
  itself satisfy Michelle's request.

## Concurrent Editing Warnings

- None outstanding. This slice's files are no longer being edited.
- Preserve `.ai/plans/2026-08-05-codex-security-standard-scan.md` and its scan
  artifacts. That paused scan is unrelated.

## Recommended Next Action

Owner review of the uncommitted diff, then commit and deploy both this slice and
the question gap capture together.
