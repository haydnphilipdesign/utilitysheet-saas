# Product Record: Alisha Starkey Feedback (HOA/Condo Wording and Custom Questions)

- Date of feedback: 2026-09-19
- Customer: Alisha Starkey, `admin@abovebeyondvs.com`, user `f2f7661e-19e2-4040-aa70-fa499bd45dcc`
- Worked by: Claude Opus 5, with the product owner
- Branch: `claude/utility-sheet-custom-questions-mkzek4`, merged to `main`
- Commits: `2d77177`, `6762166`, `8bdd4a9`, `e244484`, `120e9d8`
- Active plan: `.ai/plans/2026-09-19-hoa-question-group.md` (On hold when this
  record was written. **Update 2026-10-01:** Option A confirmed, see
  `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md`; migration applied
  to production. Sections 6, 8.5, and 9 below describe the 2026-09-19 state;
  section 10 covers the customer's reply.)
- Current handoff: `.ai/CURRENT.md`
- Related prior work: `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`,
  `.ai/plans/2026-09-03-question-gap-capture.md`

This document is the consolidated record of the feedback, what was found, what
shipped, what was decided, and what is still open. The plan holds the
implementation detail; `.ai/CURRENT.md` holds the resumable handoff. This file
exists so the reasoning survives without either of them having to carry it.

---

## 1. Executive assessment

The feedback contained two requests of very different cost, and separating them
was the whole value of the analysis.

1. **A defect in shipped copy.** The HOA/Condo option on water and sewer was
   being misread by sellers. This was not a customization request. It was a live
   bug that was silently losing data on every plan. **Fixed and deployed.**
2. **A genuine missing question.** "Is this property in an HOA?" should be
   asked. This is a built-in field, not a case for a custom-question builder.
   **Planned, on hold pending database access.**

The message arrived looking like evidence for a custom-question builder. It was
not. The confusion half was the product's own copy bug, and the HOA half argues
for a built-in. The standing verdict against a general builder
(`2026-09-03-michelle-wright-opus-evaluation.md` section Idea 2) is unchanged.

## 2. The feedback, verbatim

> Can I edit the questions? If so how? In my area, if we are going to do
> water/sewer source and hoa/condo is asked about, they are going to assume its
> askig if they are in an hoa. Which is a question i'd like asked.

## 3. What was actually wrong

### 3.1 The option meant something other than what it said

`lib/packet/seller-questions.ts` declared the water and sewer choices with
`{ id: 'hoa', label: 'HOA / Condo' }` and no hint, while its neighbours
("Public Water", "Public Sewer") both carried hints. The stored value means
*the association bills this utility, so there is no separate provider account*.
Nothing on screen said so.

### 3.2 The misreading lost data, it did not merely confuse

This is the part the customer did not report and could not have seen.
`components/seller-form/SellerWizard.tsx` gates the provider step on
`water_source === 'city'` and `sewer_type === 'public'`. A seller who read the
option as "are you in an HOA?" and tapped it was therefore **never asked who the
provider was**. The packet reached the customer with the water or sewer provider
missing, and nothing flagged the omission.

### 3.3 Both packet surfaces printed the raw database value

`lib/pdf/packet-html.ts` and `app/packet/[token]/page.tsx` rendered
`water_source`, `sewer_type`, and `heating_type` straight from the column. So
buyers saw `Water Source: hoa` in the PDF, and `Hoa` on the web page (a
`capitalize` CSS class over the raw enum). `heating_type` had it too:
`natural_gas` reached buyers as "natural gas".

### 3.4 The two packet formats disagreed with each other

Found while verifying a correction raised by the product owner, who was right
that selecting the Property Handoff Packet does not skip Home Basics.
`SellerWizard` runs `WELCOME -> HOME_BASICS -> UTILITIES -> [ADVANCED_DETAILS]
-> REVIEW` unconditionally, so advanced-mode sellers answer water, sewer, and
fuel exactly as simple-mode sellers do.

That verification surfaced a separate inconsistency:

| Surface | Simple | Advanced |
| --- | --- | --- |
| Asked of the seller | Yes | Yes |
| Rendered in the PDF | Yes | Yes |
| Rendered on the packet web page | Yes | **No** |

On a handoff packet the buyer opening the public link saw no Water Source, Sewer
Type, or Heating Type, while the same packet's PDF showed all three. The
advanced sections did not carry those fields either, so the data was dropped
from one of the two formats entirely. `git log -S"isAdvanced"` showed the guard
arrived in the squashed initial import with no rationale and was never revisited.

## 4. What shipped

All merged to `main` and deployed.

### 4.1 HOA/Condo relabel and display labels (`2d77177`)

- Water and sewer `hoa` relabelled to **"Included in HOA / Condo Fee"** with the
  hint "The association pays this bill", stating the billing meaning outright.
- Added `HEATING_TYPE_OPTIONS` (the stored `heating_type` set, which adds
  `not_sure` to the fuels) plus `getWaterSourceLabel`, `getSewerTypeLabel`, and
  `getHeatingTypeLabel` over a shared `findChoiceLabel` that `getFuelSourceLabel`
  now also uses. An unrecognized value falls back to the humanized string,
  preserving prior behavior for legacy data.
- The PDF and the public packet page resolve through those helpers. Removed the
  `capitalize` class on the web view, which would have rendered the new label as
  "Included In HOA".
- `components/requests/SubmittedSheetEditor.tsx` relabelled in that file's own
  sentence-case convention.
- `tests/unit/home-basics-labels.test.ts` added.

### 4.2 Admin triage view for requested questions (`6762166`)

The gap-capture slice deliberately shipped no admin UI (its decision D4), so the
`question_requests` table it fills had only ever been readable through psql
against production, and had never been read.

- New `/admin/question-requests`, behind the existing `requireAdmin()` guard in
  `app/(admin)/layout.tsx`. No new auth surface.
- **Read-only by design.** No status mutation, so no reason string and no audit
  entry are required. Adding a write path would change that.
- Reports totals, distinct accounts, last 30 days, and a Free/paid split, plus
  breakdowns by capture surface and packet mode. Whether Free customers are
  represented is the point of the dataset, not a decoration.
- The paid predicate deliberately mirrors `paid_accounts` in
  `lib/admin/operations-overview.ts`. **Changing one side requires changing the
  other.**
- Submissions render as a wrapping list rather than a wide table, so the page is
  usable on a phone.
- Query and shaping live in `lib/admin/question-requests.ts`, matching the
  existing `lib/admin/` convention and keeping the page presentational.
- No migration was needed. `migrations-question-requests.sql` was already
  applied to production on 2026-09-03 with authorization and verified.

### 4.3 Packet format parity (`e244484`)

Fixed structurally rather than by deleting the `!isAdvanced` guard. Both
surfaces now render from one shared `getHomeBasicsRows()` in
`lib/packet/seller-questions.ts`, so they cannot diverge again. Net effect was
removing duplicated logic from both call sites.

**The PDF output is unchanged**, because it was already correct. No pagination
risk was introduced, which is the constraint `docs/pdf-system-reference.md`
cares about most. Only the web view gained the section.

### 4.4 Validation performed

On the merged tree: full Vitest **887 passed across 164 files**;
`npm exec tsc -- --noEmit` clean; ESLint clean on all changed files;
`npm run security:scan` passed.

`npm run build` **compiles successfully and passes TypeScript**, then fails at
"Collecting page data" on a missing `NEXT_PUBLIC_STACK_PROJECT_ID`. Confirmed
**pre-existing** by building clean `main`, which fails identically. The cloud
session had no environment variables, so a full production build was never
exercised there; the deployment was the first place it ran with real
configuration. Playwright was not run, as no flow behavior changed.

## 5. The capture dataset came back empty, and what that means

The product owner read `/admin/question-requests` on 2026-09-19 and found **zero
submissions**.

Checked before concluding anything from that:

- **The instrument works.** `QuestionGapCapture` is still mounted on both
  surfaces and still outside the packet-mode conditionals, so the reachability
  guard from the gap-capture plan's decision D2 holds: a Free user in Simple
  mode can reach and submit it. Verified by reading both call sites.
- **Demand is real but arriving elsewhere.** The owner reports this ask has come
  in by email more than once. Alisha is the clearest case: she had exactly the
  feedback the control exists to collect, and sent an email instead. The control
  is a collapsed `<details>` disclosure inside a Settings section, which is
  low-affordance by design.

**Consequence.** An empty set fires neither branch of the rule the gap-capture
plan fixed in advance (*concentrated demand means build the fields, a varied
long tail means the builder*). Waiting on the table is therefore no longer a
sensible gate. At current scale the owner's inbox is the dataset, and what it
holds is one named field (HOA) plus a capability request with no fields named.
That is not the long tail that would justify a builder.

So the evidence gate on **HOA specifically** is released: it generalizes to
every market and is closing-critical for a transaction coordinator, which is the
test that separates a built-in from a custom field. The gate on a **general
custom-question builder** stands unchanged.

A working instrument nobody uses is the worst of both outcomes. Either raise its
affordance, or accept email as the channel at this scale and log those asks by
hand. This is open and not blocking.

## 6. The HOA question group, on hold

Full detail in `.ai/plans/2026-09-19-hoa-question-group.md`. Summary:

**Proposed fields**, with a gate so a non-HOA seller answers once and moves on:
`has_hoa` (Yes / No / Not sure), then association name, management company,
management phone, dues amount and frequency, and payment portal. Everything
after the gate is conditional on a Yes. The portal field needs helper text
warning against passwords and account numbers, since it is free text on a
public, token-addressed form.

**The placement decision:**

| | Option A: Home Basics | Option B: 6th handoff module |
| --- | --- | --- |
| Reaches | Every user, both modes, all plans | Pro/Teams in handoff mode only |
| Storage | New `requests` columns, **needs a migration** | Existing advanced packet JSON, no migration |
| Per-customer opt-out | None, everyone gets it | Existing module and field exclusions |
| Cost | Higher | Lower |

**Recommendation and owner direction: Option A.** The owner leans the same way,
on the grounds that it should be available on the Free plan. Those are the same
choice, because Home Basics is asked on every form, in both modes, on every
plan. Recorded as a direction, not a final approval.

Alisha's feedback concerned water and sewer, so she was looking at the Simple
sheet. A Pro-only module might not reach the person who asked for it.

**Blocker: migration access, not evidence.** Option A adds columns to
`requests`, and the owner had no Neon credentials while travelling. Held at the
owner's request on 2026-09-19.

**A no-migration shortcut exists and was rejected.**
`requests.advanced_packet_data` is JSONB present on every row regardless of
mode, so HOA answers could be stored there with no schema change. That column is
named for advanced packets, is filtered through the advanced exclusions model,
and is read only when `mode === 'advanced'`. Using it for Free-tier Home Basics
answers would create a misnamed second storage path for Home Basics and the
competing abstraction `AGENTS.md` warns against. Not worth it to avoid a short
wait.

## 7. Customer response

The owner replied to Alisha on 2026-09-19. The reply confirmed the wording fix
was live, explained that the old option was costing her provider data, stated
honestly that questions can currently be selected but not reworded or authored,
kept custom questions deliberately soft with no timeline, and asked her what she
would want captured for HOA. No customer follow-up is outstanding.

Keeping custom questions soft was deliberate. Promising the outcome she wants
(the HOA question) is safe because it is being built. Promising the mechanism is
not, given the standing verdict against the builder.

## 8. Decisions worth not relitigating

1. **The HOA confusion was a copy bug, not a customization request.** Treating it
   as evidence for a builder would have been the expensive mistake.
2. **Parity between the PDF and the web packet is structural now**, via one
   shared row builder. Do not reintroduce a mode-specific guard on Home Basics in
   either surface; a test asserts across both modes.
3. **`SubmittedSheetEditor` keeps its own option lists.** Importing the shared
   ones would retitle every option in that dropdown, since that file uses
   sentence case throughout. Optional cleanup, not a bug.
4. **The admin triage view stays read-only** unless there is a reason to change
   it. A write path would pull in the reason-string and audit-logging
   requirements in `ADMIN.md`.
5. **No `.ai/decisions/` record was created.** The Option A direction is a lean,
   not a settled decision. Create one when Option A is confirmed.

## 9. Next actions

1. **Confirm Option A** for the HOA question group, or switch to Option B.
2. **Write `migrations-hoa-questions.sql`** and mirror the final shape in
   `schema.sql`. Writing the migration does not authorize running it; confirm
   before any live database action.
3. **Implement the field group** per plan sections 5 and 7, then run the
   validation in plan section 8, including `npm run test:e2e:mobile`, since the
   seller flow is phone-first and this adds a step.

Optional, neither blocking:

- Eyeball a live handoff packet's public page. It now carries a Home Basics card
  it did not have before, above Additional Home Details. The ordering matches the
  PDF, but it has not been seen rendered against real data.
- Decide what to do about the capture control, per section 5.

## 10. Customer reply (received 2026-09-19, reviewed 2026-10-01)

Alisha answered the owner's question about what would help. The source thread
and her two attachments are kept locally under `user-feedback/`, which is
untracked on purpose: it contains customer contact details and copyrighted
forms.

What she said, in substance:

- She confirmed the misreading. Some associations do cover water and sewer, but
  as a buyer or seller she would have read the old option as "are you in an HOA?".
- She works in Oregon as a listing-side transaction coordinator. Two contract
  sets are used statewide. She wants all association information up front,
  including the association documents, because other contract timelines start
  when those documents are delivered.
- Her stated need: "mainly i need hoa information, login info if they have it
  and everything on this doc."

The two attachments:

- **Oregon REALTORS Form 4.4, Association Addendum.** Section 4 is the data she
  means: association name, management company, a contact (name, phone, email),
  current dues per month, quarter, or year, and owned or leased parking, storage,
  slip, and park spaces. The rest is contract terms and a list of association
  documents the seller must deliver.
- **OREF 024, Owner Association Addendum.** A checklist of association documents
  and review periods. It has no seller data fields.

What this changes:

- It confirms the planned fields and names two that were missing, contact name
  and contact email, plus a structured dues period. Proposed in plan section 12,
  awaiting the owner's decision.
- **Login information is a new, security-sensitive ask.** The recommendation is
  not to collect portal passwords: the answer would be a seller's personal
  account credential, stored in plaintext, on a form reachable by a link, and
  Home Basics prints on the buyer-facing packet. The owner decides. See plan
  section 12.
- **Association documents are a new capability**, not a question. Collecting
  files from the seller is a separate product decision. This is the first
  recorded request for it.
- None of it is evidence for a custom-question builder. Every item maps to a
  named built-in field or to document collection.

Status on 2026-10-01: Option A confirmed; the six-column migration was applied
to production with owner authorization. The owner has not yet replied to
Alisha's second message.
