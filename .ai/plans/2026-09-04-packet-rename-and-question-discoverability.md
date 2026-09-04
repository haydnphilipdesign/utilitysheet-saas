# Plan: Property Handoff Packet rename and seller-question discoverability

- Status: **Completed** (2026-09-04)
- Created: 2026-09-04
- Owner: Claude Opus 5
- Branch: `main`
- Source recommendation: `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`
  section 5 item 5 ("Discoverability slice: question inventory plus seller preview,
  and rename the mode") and idea B / idea D in section 4.
- Related plan: `.ai/plans/2026-09-03-question-gap-capture.md` (Completed, shipped in
  commit `6024d80`). This slice sits beside that capture control on the same two
  surfaces.

---

## 1. Approved scope

Three things, in one slice.

1. **Rename the customer-facing packet mode.** "Advanced Utility Packet" becomes
   "Property Handoff Packet". "Simple Utility Sheet" keeps its name. Naming structure:
   - Simple Utility Sheet — core utility information
   - Property Handoff Packet — utilities plus home access, systems, service providers,
     and other property details

   Supporting description, used where a longer line fits:
   > Collect utilities, home systems, access details, and service-provider information
   > in one seller handoff.

2. **A searchable inventory of every built-in seller question.**

3. **An accurate preview of what the seller will be asked** for the configuration
   currently on screen.

### Explicitly out of scope

Short-term-rental preset, new access fields, reusable form profiles, custom questions,
Safety Primitives (`sensitive` flag, revocable links). None of these are touched.

### Non-negotiable constraints

- The database enum values `simple` and `advanced` do not change. No migration, no
  schema change, no API contract change.
- Plan gating is unchanged: the handoff mode stays Pro/Teams, enforced server-side.
- Seller-flow behavior, packet generation, branding, and PDF rendering are unchanged.
  Copy moved out of seller components must be moved byte-for-byte.

---

## 2. Verified repository facts

Verified by inspection on 2026-09-04 against a clean `main` at `6024d80`.

- `lib/packet/modules.ts` is the single declaration point for 5 handoff modules and
  33 built-in handoff questions (`ADVANCED_MODULE_FIELD_METADATA`), each with a
  `label`, `sellerPrompt`, and usually an `example`.
- The **core** seller questions are not declared anywhere shared. They live inline:
  - `components/seller-form/steps/HomeBasicsStep.tsx` — water source, sewer type,
    fuel sources, primary heat source, optional utilities.
  - `components/seller-form/steps/UtilityStep.tsx` — `PROVIDER_PROMPTS` and
    `PROVIDER_HELPERS` (lines 281-302), the optional electric meter number, and the
    trash pickup / recycling questions.
- `components/seller-form/SellerWizard.tsx:296-329` decides which utility steps a
  seller actually sees. This is **not** simply "the configured categories":
  - `electric` is always shown, whether or not it is configured.
  - `water` only when configured **and** the seller answers Public Water.
  - `sewer` only when configured **and** the seller answers Public Sewer.
  - `gas` / `propane` / `oil` only when configured **and** the seller selects that fuel.
  - `trash` / `internet` / `cable` only when configured **and** the seller opts in on
    Home Basics.
  An "accurate preview" must state these conditions rather than implying every
  configured category is always asked.
- Handoff steps are ordered by `getEffectiveAdvancedModules(...)`, which drops any
  enabled module whose questions have all been excluded.
- The electric meter number is driven by the account preference
  `notification_preferences.collect_electric_meter_number`, defaulting to true
  (`!== false`). Settings already holds it in state. `app/dashboard/requests/new/page.tsx`
  already fetches `/api/account` but currently discards this field.
- `AdvancedModuleConfigurator` is mounted on exactly two surfaces, both inside a
  `packet_mode === 'advanced'` conditional: `app/dashboard/settings/page.tsx` and
  `app/dashboard/requests/new/page.tsx`. `QuestionGapCapture` sits just outside those
  conditionals on both.
- `components/ui/` already provides `dialog`, `tabs`, `input`, `badge`, `button`,
  `switch`, `checkbox`. No new dependency is needed.

### Every customer-facing surface carrying the old name

| Surface | File | Note |
| --- | --- | --- |
| Seller Form settings, mode cards | `app/dashboard/settings/page.tsx:1207,1213` | plus validation copy at 527 and 1321 |
| Request creation, packet-mode cards | `app/dashboard/requests/new/page.tsx:915,946` | |
| Request detail badge and mode switch | `app/dashboard/requests/[id]/page.tsx:148,149,272,412,421` | |
| Requests list badge | `app/dashboard/requests/page.tsx:490` | "Advanced packet" / "Simple sheet" |
| Submitted-sheet editor badge and section heading | `components/requests/SubmittedSheetEditor.tsx:468,679` | 679 reads "Advanced Packet Details" |
| Branding PDF preview mode toggle | `components/branding/UtilitySheetPdfPreview.tsx:146` | "Simple" / "Advanced" |
| Plan-gate API messages | `app/api/intake-link/route.ts:199`, `app/api/requests/route.ts:145`, `app/api/requests/[id]/configuration/route.ts:58` | user-visible toast text |
| Pricing tiers | `lib/marketing-content.ts:83,98`, `components/landing/PricingSection.tsx:20,38` | |
| FAQ | `lib/marketing-content.ts:27,29` | |
| Feature highlights | `lib/marketing-content.ts:153`, `components/landing/FeatureSection.tsx:32` | |
| Trust strip | `components/landing/TrustStrip.tsx:20` | |
| Marketing pages | `app/(marketing)/about/page.tsx:27,206`, `how-it-works/page.tsx:79`, `pricing/page.tsx:14,43,77`, `faq/page.tsx:14` | includes SEO descriptions |
| Demo page | `app/demo/page.tsx:151` | |
| OpenGraph image | `app/opengraph-image.tsx:133` | |
| Maintained docs | `docs/pdf-system-reference.md:5,111` | |

Surfaces deliberately **not** renamed:

- The public web packet heading "Additional Home Details"
  (`app/packet/[token]/page.tsx:624`) and the PDF section titles, which come from
  module labels. Neither carries the old term, and both are rendered output covered by
  `docs/pdf-system-reference.md`. Leaving them avoids touching PDF layout.
- Historical records: `.ai/plans/*`, `.ai/decisions/*`, `docs/superpowers/*`,
  `docs/product-feedback/*`, `tasks.md`. Rewriting a record of what was decided at the
  time would be dishonest.
- Every internal identifier: `packet_mode`, `'advanced'`, `AdvancedModuleKey`,
  `advanced_modules`, `advanced_packet_data`, `AdvancedModuleConfigurator`, and the
  `advanced_*` columns.

---

## 3. Design decisions

**D1. One naming constant, in `lib/packet/modules.ts`.**
Add `PACKET_MODE_LABELS`, `PACKET_MODE_SHORT_LABELS`, `PACKET_MODE_DESCRIPTIONS`, and
`PACKET_MODE_SUPPORTING_COPY` next to the existing packet metadata. Every dashboard
surface reads the label from there instead of repeating a literal, so the next rename
is one edit. Marketing copy and API messages stay as literal prose, because they are
sentences rather than labels and forcing them through a constant would hurt
readability without helping consistency.

**D2. A new shared question inventory: `lib/packet/seller-questions.ts`.**
It composes the whole seller question set from one place:
- Core Home Basics and utility questions, declared there and **imported by the seller
  components** so the flow and the inventory cannot drift.
- The 33 handoff questions, read from the existing `ADVANCED_MODULE_FIELD_METADATA`.

The alternative, retyping the core prompts into an inventory file, was rejected: two
copies of seller-facing copy will diverge, and a preview that has silently drifted is
worse than no preview.

**D3. Move, do not rewrite.** The strings extracted from `HomeBasicsStep` and
`UtilityStep` are moved verbatim. No seller sees a different word after this slice.

**D4. Preview honesty over preview tidiness.** The preview shows a condition line on
every question the seller might not reach, and states plainly that Electric is always
asked and that the seller chooses which optional utilities apply. An over-confident
preview would be a new source of support tickets.

**D5. One dialog, two tabs, mounted on both configuration surfaces.**
`components/seller-questions/SellerQuestionsDialog.tsx` with:
- **This form** — the preview, grouped into the steps the seller walks.
- **All questions** — the searchable inventory of every built-in question, each marked
  Included or Not included for the current configuration.

Mounted outside the packet-mode conditional on both surfaces, so a Free workspace on
Simple mode can still browse the full list and see what the handoff mode adds. That
directly answers "can it collect X?" without toggling a mode.

A standalone `/dashboard/questions` page was considered and rejected for this slice.
The question arises while configuring the form, so the answer belongs there.

**D6. No new API route.** Everything the preview needs is already in client state on
both surfaces. The only addition is reading the already-fetched
`collect_electric_meter_number` on the request-creation page instead of discarding it.

---

## 4. Files expected to change

New:
- `lib/packet/seller-questions.ts`
- `components/seller-questions/SellerQuestionsDialog.tsx`
- `tests/unit/seller-questions-inventory.test.ts`
- `tests/unit/seller-questions-dialog.test.tsx`

Modified (rename plus wiring):
- `lib/packet/modules.ts`
- `components/seller-form/steps/HomeBasicsStep.tsx`
- `components/seller-form/steps/UtilityStep.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/requests/new/page.tsx`
- `app/dashboard/requests/[id]/page.tsx`
- `app/dashboard/requests/page.tsx`
- `components/requests/SubmittedSheetEditor.tsx`
- `components/branding/UtilitySheetPdfPreview.tsx`
- `app/api/intake-link/route.ts`
- `app/api/requests/route.ts`
- `app/api/requests/[id]/configuration/route.ts`
- `lib/marketing-content.ts`
- `components/landing/PricingSection.tsx`
- `components/landing/FeatureSection.tsx`
- `components/landing/TrustStrip.tsx`
- `app/(marketing)/about/page.tsx`
- `app/(marketing)/how-it-works/page.tsx`
- `app/(marketing)/pricing/page.tsx`
- `app/(marketing)/faq/page.tsx`
- `app/demo/page.tsx`
- `app/opengraph-image.tsx`
- `docs/pdf-system-reference.md`
- `tests/unit/settings-reusable-link-mode.test.tsx`
- `tests/unit/requests-route-advanced-gating.test.ts`

---

## 5. Acceptance criteria

1. No customer-facing surface says "Advanced Utility Packet" or "Advanced packet".
   `grep -rn "Advanced Utility Packet"` returns hits only in historical records under
   `.ai/`, `docs/superpowers/`, `docs/product-feedback/`, and `tasks.md`.
2. `simple` and `advanced` remain the stored and transmitted values. No migration is
   added and `schema.sql` is untouched.
3. From Settings > Seller Form and from request creation, a user on any plan and in
   either mode can open a dialog, search all built-in seller questions by label,
   prompt, or section, and see which are included for the current configuration.
4. The preview reflects the live configuration: utility categories, packet mode,
   enabled modules, per-question exclusions, and the electric meter preference. It
   states the conditions under which a seller reaches each conditional section.
5. Every core seller prompt shown in the preview is the same string the seller sees,
   because both read the same constant.
6. Plan gating, the seller flow, packet generation, branding, and PDF output behave
   exactly as before.

## 6. Validation

- `npm test -- tests/unit/seller-questions-inventory.test.ts tests/unit/seller-questions-dialog.test.tsx`
- Focused regression: settings mode test, advanced gating test, seller wizard advanced
  flow, advanced details step, advanced module exclusions, branding preview data,
  PDF preview.
- `npm test -- --run` (full Vitest), because seller-form components changed.
- `npm exec tsc -- --noEmit`
- ESLint on every changed and new file.
- `npm run build`, because marketing pages, the OpenGraph route, and dashboard pages
  all changed.
- `npm run security:scan`.

## 7. Risks

- **Copy-move regression.** Extracting prompts out of `UtilityStep` / `HomeBasicsStep`
  is the only change that can alter what a seller sees. Mitigated by moving strings
  verbatim and by the existing seller wizard tests.
- **Preview drift over time.** The preview mirrors `SellerWizard`'s visibility rules by
  reimplementing them in `getSellerQuestionPreview`. If those rules change, both must
  change. A unit test pins the current rules, and a comment in each place points at the
  other.
- **SEO copy churn.** Marketing meta descriptions change. This is intended by the
  recommendation (the term "Utility" was actively concealing the mode's contents) but
  it does reset any ranking those exact phrases held.

---

## 8. Outcome

Implemented and validated on 2026-09-04. All six acceptance criteria met. The
verified final state and full validation results are in `.ai/CURRENT.md`.

Deviations and corrections worth recording:

- **Section 2's surface list was incomplete.** A second sweep after the first pass
  found four more surfaces carrying the old term: `app/(marketing)/about/page.tsx:39`
  ("simple and advanced packet options"),
  `components/requests/SubmittedSheetEditor.tsx:699` ("this advanced packet
  section"), `docs/ai-telemetry.md:89`, and
  `docs/branding-profile-pdf-redesign-handoff.md:19,112`. All four were fixed. The
  lesson is that the lower-case prose form of the term does not show up in a search
  for the title-case label.
- **Risk D4 nearly shipped broken.** `getUtilityCondition` was written but never
  wired into `buildUtilitySection`, so the first working version produced a preview
  with no visibility conditions on utility sections, which is exactly the
  over-confident preview the design decision existed to prevent. Caught by an ESLint
  unused-variable warning, not by a test. A `condition` field was added to
  `SellerQuestionSection`, wired in, rendered, and pinned by tests in both the unit
  and component suites.
- **Two extra test files** beyond those listed in section 4 asserted the old toggle
  labels and were updated: `tests/unit/utilitysheet-pdf-preview.test.tsx` and
  `tests/unit/brand-profile-form.test.tsx`. Both assert on the Simple/Advanced PDF
  preview toggle, whose button labels changed to "Utility Sheet" / "Handoff Packet".
- `app/(marketing)/faq/page.tsx` needed only its metadata description updated.
- The final inventory is **15 sections and 51 questions**: 5 Home Basics, 13 utility
  (9 provider questions plus the electric meter number and three trash questions),
  and the 33 handoff questions. The evaluation's "33 built-in questions" counted only
  the handoff modules.
