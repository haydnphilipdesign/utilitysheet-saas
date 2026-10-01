# Plan: HOA question group

- Status: **Approved, in progress (2026-10-01).** The product owner confirmed
  Option A. The migration is written, mirrored in `schema.sql`, and **applied to
  production on 2026-10-01 with explicit owner authorization**. Application code
  is not started and is waiting on the field-set decisions in section 12. See
  sections 11 and 12.
- Decision record: `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md`.
- Created: 2026-09-19
- Author: Claude Opus 5. Resumed 2026-10-01 by Claude Opus 5.5.
- Branch: originally `claude/utility-sheet-custom-questions-mkzek4` (merged).
  Resumed on `main`, uncommitted.
- Source: customer feedback from Alisha Starkey (`admin@abovebeyondvs.com`,
  user `f2f7661e-19e2-4040-aa70-fa499bd45dcc`), 2026-09-19.
- Consolidated record: `docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md`.
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

## 2a. Defect found while verifying, since fixed

Raised by the product owner on 2026-09-19 and confirmed by inspection: selecting
the Property Handoff Packet does **not** skip Home Basics. `SellerWizard` runs
`WELCOME -> HOME_BASICS -> UTILITIES -> [ADVANCED_DETAILS] -> REVIEW`
unconditionally, so advanced-mode sellers answer water source, sewer type, and
fuel exactly as simple-mode sellers do. The relabel in section 2 therefore
covers both modes, and so does the provider-skip data loss it prevents.

Verifying that surfaced a separate inconsistency, fixed the same day in
`e244484` (the table shows the state before the fix; the cited guard no longer
exists):

| Surface | Simple | Advanced |
| --- | --- | --- |
| Asked of the seller | Yes | Yes |
| Rendered in the PDF | Yes | Yes (unconditional) |
| Rendered on the packet web page | Yes | **No** (`!isAdvanced ? [...] : []`) |

On an advanced packet the buyer opening the web link sees no Water Source,
Sewer Type, or Heating Type, while the same packet's PDF shows all three. The
advanced sections do not carry Home Basics either, so the data is simply
dropped from one of the two deliverable formats.

**Resolved 2026-09-19 with product-owner authorization.** Git history shows the
`!isAdvanced` guard carried no rationale: it arrived in the squashed initial
import and was never revisited, while `docs/pdf-system-reference.md` treats the
two formats as one deliverable.

Rather than delete the guard alone, both surfaces now render from one shared
`getHomeBasicsRows` in `lib/packet/seller-questions.ts`, so the two formats
cannot diverge again. The PDF was already correct and its output is unchanged,
so no pagination risk was introduced. The public packet page now shows Home
Basics on handoff packets, matching the PDF and matching what the seller was
asked.

## 3. Verified repository facts

Verified by inspection on 2026-09-19, and re-verified on 2026-10-01 against
`main` at `f1eb4ad`. Corrections from the re-verification are marked.

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
- **Corrected 2026-10-01.** `question_requests` is readable at
  `/admin/question-requests` (`6762166`) and was read on 2026-09-19: it was
  empty. The earlier wording here ("populated and never read") predated both.
- **Added 2026-10-01.** Both packet surfaces render Home Basics through the
  shared `getHomeBasicsRows` (`lib/pdf/packet-html.ts:306`,
  `app/packet/[token]/page.tsx:311`). HOA rows belong in that builder so the PDF
  and web page stay in parity.
- **Added 2026-10-01.** The seller submission write path is the raw `UPDATE
  requests` in `app/api/seller/[token]/route.ts:538-554`, not
  `lib/neon/queries/requests.ts`. The latter only holds the submitted-sheet
  editor write (`updateSubmittedRequestData`, around line 561).
- **Added 2026-10-01.** `components/seller-form/steps/ReviewStep.tsx:67,74`
  keeps its own label maps and still shows the old bare "HOA / Condo" for the
  water/sewer billing option. The 2026-09-19 relabel missed it. It is a display
  inconsistency on the seller's review screen, not the provider-skip data loss
  (that choice is made on Home Basics), but it becomes actively confusing once a
  real HOA membership answer sits beside it. Fix it when ReviewStep gains the HOA
  rows.
- **Added 2026-10-01.** `lib/neon/queries/account-data.ts:114-120` exports
  `requests` with an explicit column list, so new columns are not exported
  unless added there.

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

**Resolved 2026-09-19: the table is empty.** The product owner read it at
`/admin/question-requests` and found zero submissions.

That is not a reading of the decision rule, it is the absence of one. Neither
branch of *concentrated means build the fields, varied long tail means the
builder* fires on an empty set. Two things were checked before concluding
anything from it:

- **The instrument works.** `QuestionGapCapture` is still mounted on both
  surfaces and still outside the packet-mode conditionals, so the D2
  reachability guard holds: `app/dashboard/settings/page.tsx:1350` sits after
  the advanced block closes at 1333, and `app/dashboard/requests/new/page.tsx:973`
  sits before the advanced block opens at 978. A Free user in Simple mode can
  reach and submit it.
- **Demand is real but arriving elsewhere.** The product owner reports this ask
  has come in by email more than once. Alisha is the clearest case: she had
  exactly the feedback the capture exists to collect and sent an email instead.
  The control is a collapsed `<details>` disclosure inside a Settings section,
  which is low-affordance by design.

**Consequence for this plan.** Waiting on the table is no longer a sensible
gate. At current scale the owner's inbox is the dataset, and what it holds so
far is one named field (HOA) plus a capability request with no fields named.
That is not the long tail that would justify a builder. The evidence gate on
**HOA specifically** is therefore released: it generalizes to every market and
is closing-critical, which is the built-in test. The gate on a **general
custom-question builder** stands unchanged.

```sql
SELECT requested_text, context, packet_mode, created_at
FROM question_requests
ORDER BY created_at DESC;

SELECT count(*) AS total, count(DISTINCT account_id) AS accounts
FROM question_requests;
```

**Recommendation: Option A**, the gating `has_hoa` question in Home Basics with
the detail fields conditional on Yes. It reaches everyone, it costs a
Simple-mode seller one tap to say No, and HOA status is closing-relevant on a
plain utility sheet and not only on a full handoff packet.

**Product owner, 2026-09-19:** leans the same way, on the grounds that it should
be available on the Free plan. Recorded as a direction, not a final approval.
Free-plan availability and Option A are the same choice, because Home Basics is
asked on every form in both modes and on every plan.

**Product owner, 2026-10-01: Option A confirmed** (Home Basics, available on
the Free plan). Recorded in
`.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md`. The owner now has
Neon credentials, so the migration-access blocker below is cleared.

**Blocker until 2026-10-01: migration access, not evidence.** Option A adds
columns to `requests`, and the owner had no Neon credentials until then.

**A no-migration shortcut exists and was rejected.** `requests.advanced_packet_data`
is JSONB present on every row regardless of mode, so HOA answers could be stored
there today. That column is named for advanced packets, is filtered through the
advanced exclusions model, and is only read when `mode === 'advanced'`. Using it
for Free-tier Home Basics answers would create a second, misnamed storage path
for Home Basics and the competing abstraction `AGENTS.md` warns against. Not
worth it to save an eleven-day wait.

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
- `schema.sql` (**done 2026-10-01**)

Missing from the original list, found on 2026-10-01 by tracing every reader and
writer of `water_source` / `sewer_type` / `heating_type`:
- `app/api/seller/[token]/route.ts` (the seller submission write; required)
- `components/seller-form/steps/ReviewStep.tsx` (seller review screen; also
  carries the stale "HOA / Condo" label noted in section 3)
- `lib/submitted-sheet/editor.ts` and
  `app/api/requests/[id]/submitted-data/route.ts` (editor load, diff, and save)
- `lib/neon/queries/account-data.ts` (account data export column list)
- `lib/branding/preview-data.ts` and `scripts/demo-seed.mjs` (sample and demo
  data, so previews show the new section)
- `app/(admin)/admin/requests/[id]/page.tsx` (admin request detail, optional)
- `lib/telemetry/seller-submission.ts`: decide deliberately. HOA free text
  (name, management company, phone, portal) must not enter telemetry. At most
  the `has_hoa` enum, and only if `docs/ai-telemetry.md` permits it.

New:
- `migrations-hoa-questions.sql` (**done 2026-10-01, not run**)
- `tests/unit/hoa-questions.test.ts`

## 11. Next concrete action

**Done 2026-10-01:** Option A confirmed; `migrations-hoa-questions.sql` written;
`schema.sql` mirrors it. The migration adds six nullable columns to `requests`
in one `ALTER TABLE`: `has_hoa TEXT CHECK (has_hoa IN ('yes', 'no',
'not_sure'))` plus five plain `TEXT` detail columns. No default, no backfill, no
index, no cross-column constraint.

Validated offline only, against in-memory Postgres (PGlite), never against Neon:
the pre-change `schema.sql` plus the migration yields the same `requests`
columns and check constraints as the new `schema.sql`; a second run is a no-op;
`requests_has_hoa_check` accepts `yes`, `no`, `not_sure`, and NULL and rejects
anything else.

**Applied to production 2026-10-01**, after the owner explicitly authorized it.

- Target: the Neon database in `.env.local` (`neondb`, SSL required, host
  SHA-256 prefix `79d6a988e446`, the same target earlier migrations were
  verified against). `.env` points at a different host and was not used.
- Read-only preflight: `requests` had 30 columns (matching `schema.sql` before
  this change), no HOA columns, 964 rows, no idle-in-transaction sessions.
- Applied the single `ALTER TABLE` in one transaction with a 5 second
  `lock_timeout`.
- Verified from the catalog: 36 columns; the six new columns are `text`,
  nullable, no default; `requests_has_hoa_check` exists with the reviewed
  definition; the five pre-existing check constraints are unchanged.
- Aggregate check: 964 rows, zero with any HOA value set. No row-level data was
  read or printed, and no credentials were printed or stored.

Deploy-order constraint is now satisfied: code that reads or writes these
columns may be deployed.

Next: get the owner's decisions in section 12, then implement the field group
per sections 5, 7, and 12 against the corrected file list in section 10, and run
section 8.

## 12. Customer reply and proposed field changes (2026-10-01)

Alisha replied to the owner's question about what would help. The thread and her
two attachments were supplied by the owner on 2026-10-01 under `user-feedback/`
(untracked; it holds customer contact details and copyrighted forms, so do not
commit it). Summary in
`docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md` section 10.

What she asked for: association information up front on listing files, the
association documents themselves, portal login information when the seller has
it, and "everything on" Oregon REALTORS Form 4.4 (Association Addendum). She
also attached OREF 024 (Owner Association Addendum), which is a document
checklist with no seller data fields.

Form 4.4 section 4 against the columns that now exist:

| Form 4.4 line | Covered by | Gap |
| --- | --- | --- |
| Association name | `hoa_name` | None |
| Management company | `hoa_management_company` | None |
| Contact name | none | **Missing** |
| Contact phone | `hoa_management_phone` | None |
| Contact email | none | **Missing** |
| Current dues, per month / quarter / year | `hoa_dues_amount` (free text) | Period is unstructured |
| Parking, storage, slip, park space (owned or leased, number, lease cost) | none | Missing; condo and marina specific |
| Transfer fees, document delivery, approval timeline | none | Contract terms, not seller knowledge |

**Proposed, awaiting owner decision. Nothing below is approved or built.**

1. Add three nullable columns, appended to the same idempotent migration file:
   `hoa_management_contact` (contact name), `hoa_management_email`, and
   `hoa_dues_frequency` (`monthly` / `quarterly` / `yearly`), with
   `hoa_dues_amount` holding the amount alone. That completes Form 4.4 section 4
   lines A to C. A second database run needs its own authorization.
2. Leave parking and storage spaces out of the first release. It is a four-row
   sub-form that applies mainly to condos and marinas.
3. **Do not collect portal passwords.** Keep section 5's helper warning. This is
   a security-sensitive product decision and belongs to the owner. The garage
   code precedent (`.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md`)
   does not transfer cleanly: the buyer needs a garage code, while an HOA portal
   login is the seller's personal account credential, the buyer never needs it,
   and Home Basics prints on the buyer-facing packet and PDF with no per-field
   exclusion. Serving the coordinator's real goal would need a coordinator-only
   field that never renders in the packet, which is a new visibility concept
   plus plaintext credential storage.
4. Association document collection (file upload on the seller form) is a
   separate capability and out of scope here. Record it as demand, not as part
   of this plan.

Recommendations on the two questions left open in section 11, also awaiting the
owner:

- **Not sure on the gate:** detail fields stay behind **Yes** only. A seller who
  does not know whether there is an association cannot name its manager, and the
  "Not sure" itself is the useful signal. Print all three answers on the packet
  ("Yes" with details, "No", "Not sure"); omit the row only when `has_hoa` is
  NULL.
- **Telemetry:** add the `has_hoa` enum to the redacted `seller_submitted`
  summary next to `water_source`, `sewer_type`, and `heating_type`, and update
  `docs/ai-telemetry.md` to list it. Never include the free-text HOA values. The
  Yes rate is the evidence for whether the detail fields earn their place.

Optional and independent of the hold: raise the capture control's affordance, or
accept that email is the channel at this scale and log those asks by hand. The
current state, a working instrument nobody uses, gives the worst of both.
