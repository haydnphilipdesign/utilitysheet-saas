# Plan: Evaluate Whether Custom Questions Are Worth Building

- Status: **Proposed. Not started.** This is an evaluation plan. It does not
  authorize building any custom-question feature.
- Created: 2026-10-01
- Author: Claude Opus 5.5 (Claude Code)
- Requested by: product owner, 2026-10-01: "begin to look into the possibility
  of implementing some sort of custom questions in the near future to decide if
  it is worth doing."
- Related:
  - `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md`
    (section 3, Idea 2: the standing verdict, "premature")
  - `.ai/plans/2026-09-03-question-gap-capture.md` (Completed: the demand
    instrument)
  - `.ai/plans/2026-09-19-hoa-question-group.md` (Completed: the most recent
    built-in question group, and the best cost reference available)
  - `docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md`

---

## 1. The decision this plan produces

One written answer, with reasons, to: **should UtilitySheet let customers add
their own seller questions, and if so, in what smallest form?** The outcome is a
decision record under `.ai/decisions/` saying build, do not build, or build a
named smaller thing. A build, if chosen, gets its own plan.

The standing verdict is unchanged until that record exists. This plan reopens
the question deliberately; it does not presume the answer.

## 2. "Custom questions" is five different products

Cost and risk rise steeply down this list. Most of the debate so far has been
about level 4 while the evidence, at most, points at level 2.

| Level | What the customer can do | Rough cost | Main risk |
| --- | --- | --- | --- |
| 0 | Turn built-in questions on and off (today) | None | None |
| 1 | Reword the prompt of a built-in question | Small | Packet labels drift from what was asked |
| 2 | Add a few short-answer questions of their own (label, optional helper text), shown in one "Additional questions" step and one packet section | Medium, one time | Copy quality, sensitive answers, seller fatigue |
| 3 | Typed questions: choices, yes/no, phone, conditional follow-ups | Large | Validation and rendering per type; branching in the seller flow |
| 4 | A builder: ordering, sections, several forms per account | Very large | A second product inside the product |

The evaluation should aim at **level 2**. It is the smallest thing a customer
would call "custom questions", and it is the only level cheap enough that
today's evidence could plausibly justify it.

## 3. Evidence on hand

Verified from the repository and the feedback records on 2026-10-01.

- **Two written asks, both of which resolved into named built-in fields.**
  Michelle Wright (2026-09-03) wanted door codes and cameras. Alisha Starkey
  (2026-09-19) asked "Can I edit the questions?" and then named HOA. Neither
  described a need that only an authoring tool could meet.
- **The owner reports the ask arriving by email more than once.** Not recorded
  anywhere structured. This is the main gap in the evidence.
- **The capture instrument is empty.** `question_requests` had zero rows when
  read at `/admin/question-requests` on 2026-09-19, though the control is
  reachable on Free and paid plans. It is a collapsed `<details>` in Settings and
  on the new-request page. Low affordance, so the zero is weak evidence either
  way.
- **Sellers answer descriptive questions and skip secret ones.** The 2026-09-03
  analysis: 80 to 90 percent fill for "where is it" and "who services it",
  8.3 percent for the garage code. Any custom-question design should expect
  customers to write questions of both kinds.
- **That analysis was effectively two workspaces.** 95 percent of handoff-mode
  requests came from two Pro accounts. Base rates from it are not market rates.

## 4. What the HOA build measured

The HOA group is the freshest measure of what one built-in question group costs,
and it shows where a generic mechanism would have to plug in. One gate plus
eight answers touched, once each:

1. Declarations and limits (`lib/packet/hoa.ts`, `lib/packet/seller-questions.ts`)
2. Types (`types/index.ts`)
3. Request validation (`lib/validation/schemas.ts`)
4. Seller form step and review (`HomeBasicsStep.tsx`, `ReviewStep.tsx`,
   `SellerWizard.tsx`, `app/s/[token]/page.tsx`)
5. Seller read and write (`app/api/seller/[token]/route.ts`)
6. Submitted-sheet editor, its route, and its query
7. Packet data, the public packet page, and the PDF
8. Question inventory and preview (automatic, from the declarations)
9. Telemetry exclusion, account data export
10. One migration and `schema.sql`

Two things follow.

- **The marginal built-in is not expensive, but it is not free**: roughly twenty
  files and a migration. If asks keep arriving one field group at a time, a
  level 2 mechanism pays for itself after a small number of them.
- **The PDF risk is smaller than the 2026-09-03 memo assumed.** The handoff
  sections and the new association table already render arbitrary label and
  value pairs in a paginating table, and the 2026-10-01 renders showed
  maximum-length, unbroken values wrapping without clipping. Bounded labels and
  answers fit the existing renderer. This weakens one of the four arguments
  against the builder. The other three (copy quality, evidence, a cheap
  substitute in the notes fields) stand.

## 5. Questions the evaluation must answer

**Demand**
1. How many distinct accounts have asked, in any channel, in the last 90 days?
2. Do the asks concentrate on a short list (build those fields) or scatter
   (a mechanism)? This is the decision rule fixed in the gap-capture plan.
3. Who is asking: Free or paid? Would it move an upgrade?

**Shape**
4. Is level 2 enough, or do the asks need choices and conditions (level 3)?
5. Do customers want different questions for different transaction types? If
   so, the real constraint is one form per account (`intake_links` has
   `UNIQUE(account_id)`), which the 2026-09-03 memo ranked above a builder.

**Cost and risk**
6. Storage: definitions on the account or intake link, answers in a new JSONB
   column on `requests`. Not `advanced_packet_data`, which is named for and
   filtered by handoff mode (rejected for HOA for that reason).
7. Snapshot: are question definitions copied onto the request at creation, so
   editing a question later cannot relabel an old packet? Handoff module
   selections are already copied per request; follow that.
8. Limits that protect the seller and the PDF: how many questions, label length,
   answer length.
9. Sensitive content: a customer can write "What is your portal password?". The
   product cannot review customer-authored questions. What is the policy, and is
   a coordinator-only answer (see
   `docs/product-feedback/2026-10-01-hoa-deferred-capabilities.md`) a
   prerequisite?
10. Seller completion: every added question is paid for by every seller. What is
    the guardrail metric and who watches it?
11. Plan gating: a paid feature, by default.

## 6. Steps, cheapest first

Stop at any step whose result settles the decision.

1. **Fix the evidence gap (no engineering).** Log every question ask received by
   email so far, and from now on, as rows in `question_requests` or a short
   table in the decision record: date, account, plan, the exact words. Without
   this the decision stays an argument.
2. **Ask.** A short reply to the customers who raised it, and to the five most
   active accounts: "What is one thing you collect from sellers outside
   UtilitySheet today?" Exact wording, not categories.
3. **Make the capture control visible, or retire it.** It is a working
   instrument nobody uses. Either raise its affordance (an open input next to
   "See what sellers are asked") or accept email as the channel and remove it.
   Small change; needs its own approval.
4. **Read what already exists.** Re-run
   `docs/product-feedback/2026-09-03-advanced-field-usage-analysis.sql`
   read-only for fresh fill rates and notes-field usage, and read the `has_hoa`
   rate from `seller_submitted` events once the HOA group has a few weeks of
   submissions. Aggregates only.
5. **Design spike for level 2, timeboxed, no production code.** A one-page data
   model (question 6 to 8), and one PDF rendered through the existing pipeline
   with five customer-style questions at their limits. Output is a cost estimate
   in files and days, not a branch.
6. **Decide and record.** Write the decision record. If the answer is build,
   write the implementation plan; if not, record what evidence would change it.

Steps 1, 2, and 4 need no code and can run this week. Step 3 is a small UI
change. Step 5 is roughly a day.

## 7. What would make it worth doing

Proposed thresholds, for the owner to adjust before the evaluation starts so the
result is not argued after the fact:

- **Build level 2** if at least five distinct accounts have asked within 90
  days, the asks do not reduce to five or fewer built-in fields, and at least
  one asker is paid or says it would upgrade.
- **Keep adding built-ins** if the asks concentrate on a short list.
- **Build profiles instead** (several forms per account) if the asks are about
  different transaction types rather than different questions.
- **Do nothing** if fewer than five accounts have asked and the notes fields
  remain unused.

## 8. Out of scope

- Building any level of custom questions.
- Levels 3 and 4, unless step 2 shows level 2 would not satisfy the askers.
- Portal logins and document upload, recorded separately in
  `docs/product-feedback/2026-10-01-hoa-deferred-capabilities.md`.

## 9. Risks

- **Deciding from two voices.** The loudest evidence is two customers and the
  owner's memory of emails. Step 1 exists to fix that before anything else.
- **Scope creep from level 2 to level 4.** Name the level in the decision
  record and hold it.
- **Customer-authored copy lowering packet quality.** The curated prompts and
  examples are part of why untrained sellers answer correctly on a phone.
- **Customer-authored requests for secrets.** See question 9.

## 10. Next concrete action

Owner: confirm or adjust the thresholds in section 7, then start step 1 by
listing the email asks received so far. Nothing in this plan is in progress.
