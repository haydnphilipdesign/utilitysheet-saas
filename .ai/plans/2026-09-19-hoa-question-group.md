# Plan: HOA question group

- Status: **Proposed, blocked on evidence.** Not approved for implementation.
- Created: 2026-09-19
- Author: Claude Opus 5
- Branch: `claude/utility-sheet-custom-questions-mkzek4`
- Source: customer feedback from Alisha Starkey (`admin@abovebeyondvs.com`,
  user `f2f7661e-19e2-4040-aa70-fa499bd45dcc`), 2026-09-19.
- Related: `.ai/plans/2026-09-03-question-gap-capture.md` (Completed) is the
  instrument that decides section 6 below.
  `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` §Idea 2
  holds the standing verdict against a general custom-question builder.

---

## 1. What the feedback actually contained

> "Can I edit the questions? If so how? In my area, if we are going to do
> water/sewer source and hoa/condo is asked about, they are going to assume its
> askig if they are in an hoa. Which is a question i'd like asked."

Two separate requests, of very different cost:

1. **The HOA/Condo option is misread by sellers.** This was a defect in shipped
   copy, not a customization request. **Fixed separately on this branch**; see
   section 2. It is not part of this plan's remaining scope.
2. **"Is this property in an HOA?" should be a question.** That is this plan.

Naming the two apart matters, because the first looked like evidence for a
custom-question builder and was not.

## 2. Already shipped on this branch (context, not scope)

The HOA/Condo relabel landed first because it is a live correctness bug
independent of anything below. Recorded here so this plan is not read as
including it:

- `hoa` on water source and sewer type now reads **"Included in HOA / Condo
  Fee"** with the hint "The association pays this bill".
- The packet PDF and the public packet page resolved `water_source`,
  `sewer_type`, and `heating_type` straight from the database, so a stored
  `hoa` reached the buyer as "hoa" (PDF) and "Hoa" (web). Both now resolve
  through shared label helpers in `lib/packet/seller-questions.ts`.
- `tests/unit/home-basics-labels.test.ts` guards both.

## 2a. Open defect found while verifying, deliberately not fixed

Raised by the product owner on 2026-09-19 and confirmed by inspection: selecting
the Property Handoff Packet does **not** skip Home Basics. `SellerWizard` runs
`WELCOME -> HOME_BASICS -> UTILITIES -> [ADVANCED_DETAILS] -> REVIEW`
unconditionally, so advanced-mode sellers answer water source, sewer type, and
fuel exactly as simple-mode sellers do. The relabel in section 2 therefore
covers both modes, and so does the provider-skip data loss it prevents.

Verifying that surfaced a separate inconsistency **which remains unfixed**:

| Surface | Simple | Advanced |
| --- | --- | --- |
| Asked of the seller | Yes | Yes |
| Rendered in the PDF | Yes | Yes (`packet-html.ts:638`, unconditional) |
| Rendered on the packet web page | Yes | **No** (`app/packet/[token]/page.tsx:313`, `!isAdvanced ? [...] : []`) |

On an advanced packet the buyer opening the web link sees no Water Source,
Sewer Type, or Heating Type, while the same packet's PDF shows all three. The
advanced sections do not carry Home Basics either, so the data is simply
dropped from one of the two deliverable formats.

The `!isAdvanced` guard looks deliberate, but the PDF contradicts whatever
rationale it had, and `docs/pdf-system-reference.md` treats the two formats as
one deliverable. Most likely a bug. It is one line to change, and it was held
back because it alters what buyers see on every live advanced packet and
deserves a look before it ships. Decide it separately from this plan.

## 3. Verified repository facts

Verified by inspection on 2026-09-19 against this branch.

- There is **no HOA question anywhere in the product.** The only occurrences of
  `hoa` are the water/sewer billing enum values (`types/index.ts:81-82`,
  `lib/validation/schemas.ts:59-60,296-297`, `schema.sql:134-135`).
- `lib/packet/modules.ts` declares 5 handoff modules and 33 built-in fields.
  Adding a module means touching `ADVANCED_MODULE_KEYS`,
  `ADVANCED_MODULE_LABELS`, `ADVANCED_MODULE_FIELD_KEYS`,
  `ADVANCED_MODULE_FIELD_METADATA`, `ADVANCED_MODULE_METADATA`, and the
  `AdvancedModuleKey` union in `types/index.ts`.
- Handoff modules are **Pro/Teams only** and are enforced server-side. A Free
  user in Simple mode never reaches `AdvancedModuleConfigurator`.
- Home Basics questions are declared in `lib/packet/seller-questions.ts` and
  rendered by `components/seller-form/steps/HomeBasicsStep.tsx`. They are asked
  on **every** seller form, in both packet modes, on every plan.
- `components/seller-form/SellerWizard.tsx:301-304` gates the water and sewer
  provider steps on `water_source === 'city'` and `sewer_type === 'public'`.
- Home Basics answers are columns on the requests table. Handoff module answers
  live in the advanced packet JSON. These are different storage shapes with
  different migration cost.
- `question_requests` (from the gap-capture slice) is populated in production
  and **has never been read**. D4 of that plan deliberately shipped no admin UI,
  so reading it currently requires a psql session against production.

## 4. Why this is a built-in and not a custom question

The standing verdict in the evaluation memo (§Idea 2) is that a custom-question
builder is premature: an arbitrary user-defined field must survive Zod
validation, seller wizard rendering, the exclusions model, packet HTML, the
submitted-sheet editor, and a fixed-layout PDF whose pagination and selectable
text are stated constraints in `docs/pdf-system-reference.md`.

Nothing in this feedback changes that verdict, and HOA specifically argues
against it:

- **It generalizes.** HOA and condo associations exist in every US market. This
  is not one coordinator's local convention, which is the test that separates a
  built-in from a custom field.
- **It is closing-critical for the actual buyer.** Estoppel letters, dues
  proration, and association document delivery are transaction-coordinator work
  items. A packet that omits the management company's phone number sends the TC
  hunting for it.
- **Curated copy is the product's advantage.** Sellers answer on a phone with no
  account and no training. A built-in field carries a written `sellerPrompt` and
  `example`; a customer-authored label reading "hoa info" would not, and the
  degraded packet is still the customer's deliverable.

## 5. Proposed fields

Gating question first, so a non-HOA seller answers once and moves on.

| Key | Prompt | Example |
| --- | --- | --- |
| `has_hoa` | Is this home part of an HOA or condo association? | Yes / No / Not sure |
| `hoa_name` | What is the association called? | Lakeview Commons HOA |
| `hoa_management_company` | Who manages the association? | Crest Property Management |
| `hoa_management_phone` | What is the management company's phone number? | (555) 204-8890 |
| `hoa_dues_amount` | What are the dues, and how often? | $240 quarterly |
| `hoa_portal_or_payment` | Where are dues paid or documents found? | ourlakeview.com resident portal |

Every field after `has_hoa` is conditional on a Yes.

**Privacy constraint.** `hoa_portal_or_payment` is free text on a public,
token-addressed seller form. Its helper text must tell the seller not to enter a
password or account number, matching the D3 rule from the gap-capture plan. This
is a real mitigation: somebody will otherwise type a portal login into it.

## 6. The open decision, and what settles it

**Where does this group live?**

| | Option A: Home Basics | Option B: 6th handoff module |
| --- | --- | --- |
| Reaches | Every user, both modes, all plans | Pro/Teams in handoff mode only |
| Reaches Alisha | Yes | Only if she is Pro |
| Storage | New request columns, migration | Existing advanced packet JSON, no migration |
| Per-customer opt-out | None; everyone gets it | Existing module and field exclusions |
| Seller cost | One extra question on every form | None for Simple users |
| Cost | Higher | Lower |

This is the crux and it is **not safely decidable from one message**. Alisha's
feedback is about water/sewer, which means she was looking at the Simple sheet.
If HOA ships as Option B and she is on Free, the feature does not reach the
person who asked for it and the reply to her becomes an upgrade pitch.

Two things settle it, neither available from this container:

1. **Alisha's plan.** Free or Pro. Changes the reply and the recommendation.
2. **The `question_requests` table.** The decision rule was fixed in advance by
   the gap-capture plan: *concentrated demand means build the fields; a varied
   long tail means the builder.* It has never been read.

```sql
SELECT requested_text, context, packet_mode, created_at
FROM question_requests
ORDER BY created_at DESC;

SELECT count(*) AS total, count(DISTINCT account_id) AS accounts
FROM question_requests;
```

**Current recommendation, stated as a recommendation and not a decision:**
Option A, the gating `has_hoa` question in Home Basics with the detail fields
conditional on Yes. It reaches everyone, it costs a Simple-mode seller exactly
one tap to say No, and HOA status is closing-relevant on a plain utility sheet
and not only on a full handoff packet. Adopt it only if the table supports HOA
as concentrated demand.

## 7. Acceptance criteria

Written for Option A. Option B would replace criteria 1, 2, and 5.

1. A seller answering **No** to `has_hoa` sees no further HOA questions and adds
   at most one tap to the flow.
2. A seller answering **Yes** reaches the detail fields, and the answers persist
   through submission, the submitted-sheet editor, the public packet page, and
   the PDF.
3. No stored HOA enum value reaches a buyer-facing surface unresolved. The guard
   is the same one added in `tests/unit/home-basics-labels.test.ts`.
4. The PDF still paginates correctly with all HOA fields populated at maximum
   length, with selectable text preserved, per `docs/pdf-system-reference.md`.
5. The migration is written and `schema.sql` mirrors its final shape. **Writing
   the migration does not authorize running it.**
6. `hoa_portal_or_payment` helper text warns against passwords and account
   numbers.
7. The question inventory and seller preview (`SellerQuestionsDialog`) include
   the new questions automatically, because they derive from the same
   declarations. Verify rather than assume.
8. Lint, `tsc --noEmit`, and the full Vitest suite pass. The pre-existing
   `components/admin/EventLogTable.tsx:6` lint error is unrelated and expected.

## 8. Required validation

```powershell
npm test -- --run tests/unit/home-basics-labels.test.ts
npm test -- --run
npm run lint
npm exec tsc -- --noEmit
npm run security:scan
npm run test:e2e:mobile   # seller flow is phone-first; run it for a new step
```

## 9. Risks

- **Seller fatigue is the real cost of Option A.** Every question added to Home
  Basics is paid by every seller on every request. `has_hoa` earns its place;
  the five detail fields must stay behind the Yes.
- **PDF pagination.** Six new fields on a fixed layout. The reference document
  is authoritative and the fields must be laid out within its constraints.
- **Free-text privacy**, per section 5.
- **Do not let this become the builder.** If implementation starts reaching for
  a generic field mechanism, stop and record the conflict rather than
  substituting one.

## 10. Expected files

Modified (Option A):
- `lib/packet/seller-questions.ts`, `components/seller-form/steps/HomeBasicsStep.tsx`
- `components/seller-form/SellerWizard.tsx` (conditional visibility)
- `lib/validation/schemas.ts`, `types/index.ts`
- `lib/neon/queries/requests.ts`, `lib/packet/packet-data.ts`
- `lib/pdf/packet-html.ts`, `app/packet/[token]/page.tsx`
- `components/requests/SubmittedSheetEditor.tsx`
- `schema.sql`

New:
- `migrations-hoa-questions.sql`
- `tests/unit/hoa-questions.test.ts`

## 11. Next concrete action

Read `question_requests` at `/admin/question-requests` (shipped 2026-09-19; it
replaces the psql session the query in section 6 used to require) and check
Alisha's plan tier. Then either approve Option A, switch to Option B, or record
that the evidence points at the builder after all. Do not begin implementation
before that.

Separately and independently: decide the advanced-mode Home Basics
inconsistency in section 2a.
