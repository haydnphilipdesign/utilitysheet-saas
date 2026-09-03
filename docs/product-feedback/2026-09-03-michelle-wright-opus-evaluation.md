# Product Evaluation: Michelle Wright Feedback (Short-Term Rental Access Details)

Date: 2026-09-03
Author: Claude Opus 5, acting as senior product strategist
Source: `docs/product-feedback/2026-09-03-michelle-wright-opus-handoff.md`
Status: Recommendation for product owner review. No engineering work authorized by this document.

---

## 1. Executive Assessment

The handoff frames this as discoverability versus missing capability. That framing is
useful but incomplete, and one of its premises does not survive contact with the code.

Three findings drive everything below.

**Finding 1: The "she just needs to find it" story is roughly half true, and the weaker
half is the half she actually asked about.** Michelle named three things: door codes,
cameras, and "etc." Verified against `lib/packet/modules.ts`:

| What she named | Current coverage | Verdict |
| --- | --- | --- |
| Garage door code | `garage_door_code` (dedicated field) | Covered |
| Front door, keypad, smart lock, gate, lockbox codes | No field exists | **Not covered** |
| Cameras | No field exists. Nearest is `smart_doorbell_brand`, which is not a camera field | **Not covered** |
| Alarm / security system | `security_system_brand` plus `smart_home_notes` | Partially covered |
| Wi-Fi handoff | No field exists | **Not covered** |

A repository-wide search for `camera`, `wifi`, `lockbox`, `gate_code`, `front_door`, and
`smart_lock` in `lib/` returns zero matches. The initial customer response was accurate
about garage codes and smart devices, but it implied broader coverage than exists.
Sending Michelle to Settings will not close her request. It will improve her setup and
then leave her still missing front door codes and cameras.

**Finding 2: Her message is one question about form configurability, not two questions.**
"Can info collected be edited?" most likely means "can I change what the seller form asks
for?" rather than "can I edit answers after submission." The "For example" that follows
points entirely at collection scope, and her verb is *collect*, not correct or fix. Under
that reading the initial support response was well targeted: it answered her actual
question.

The honest full answer is narrower than it first appears. She can toggle five modules and
33 built-in questions on and off, as workspace defaults and per request. She cannot add,
reword, or retype a single question. So her question lands closer to the custom-question
boundary than the handoff's discoverability framing suggests, while her concrete need is
still a short list of named fields rather than an authoring tool.

Residual ambiguity: the submitted-data reading is still possible, perhaps one chance in
four. It costs one sentence to cover both when replying to her, so cover both rather than
picking.

**Finding 3: The real structural gap is transaction-type fit, not field flexibility.**
`schema.sql` defines `intake_links` with `UNIQUE(account_id)`. Every workspace gets
exactly one reusable seller link with exactly one default configuration. A coordinator
who runs both standard sales and short-term-rental files cannot have a form for each.
Per-request customization does exist (the configurator is already rendered on
`app/dashboard/requests/new/page.tsx`), but the reusable link, which is the thing most
users actually share, is single-configuration by schema. That is a much smaller, safer
and more defensible gap to close than a general custom-question builder.

**Finding 4, added 2026-09-03 after running the analysis in section 8: sellers do not
answer code questions.** Of the 108 submitted advanced requests where the seller filled in
at least one Mailbox & Home Access field, only 9 included the garage door code. That is a
**8.3 percent fill rate on the one existing field closest to what Michelle is asking for**,
measured against sellers who demonstrably engaged with that exact section.

The contrast inside the same module, same form, same sellers, is stark:

| Field | Fill rate |
| --- | --- |
| `breaker_box_location` | 88.9% |
| `main_water_shutoff_location` | 84.3% |
| `mailbox_location` | 29.6% |
| `keys_and_garage_remotes_location` | 13.0% |
| `garage_door_code` | **8.3%** |
| `smart_home_notes` | 2.1% |

Across all 33 fields the pattern holds without exception. Sellers reliably answer *where is
it* and *who services it* questions: `has_irrigation_system` 100 percent,
`pest_control_provider_name` 90 percent, `security_system_brand` 87 percent,
`lawn_care_provider_name` 86 percent. They do not answer *what is the secret* questions.
Separately, 100 of 221 submitted advanced requests, 45 percent, contain no advanced answers
at all.

Meanwhile customers keep asking. Nobody excludes `garage_door_code` from their defaults.
So **demand for the question is real and supply of the answer is not.** Michelle's request
is genuine, and building more code fields would most likely produce more blank fields.

This is the strongest available evidence for idea G in section 4: ask how access will be
transferred rather than what the code is.

**Bottom line.** Do the discoverability work, but do not expect it to satisfy her. Add a
small number of named access fields behind two cheap safety primitives. Treat the
custom-question builder and the conditional-branching engine as unfunded until evidence
justifies them. And resolve one ambiguity before anything else: it is not yet known
whether Michelle is coordinating the *sale* of short-term-rental properties (on strategy)
or the *operational onboarding* of properties that stay in service (a different product).

**Rough attribution of her problem:** about 45 percent discoverability, about 25 percent
configuration model (one form per workspace), about 30 percent genuinely missing fields.
These are judgment weights, not measurements. On current evidence, 0 percent requires a
custom-question builder.

---

## 2. Customer Insight and Job to Be Done

**Functional job.** "When I take on a short-term-rental file, I need to collect everything
the new owner or operator needs to physically take control of the property, in one pass,
without chasing the seller across three channels, so I can hand over a single complete
document and be done."

**Emotional and social job.** Transaction coordinators are judged on completeness and on
not being the reason a closing stalls. A missing door code discovered at handoff is a
visible, personal failure. The packet is her professional output, and it carries her
brand. She wants it to look finished.

**What the message actually reveals, ranked by confidence:**

- **Verified:** She has recurring short-term-rental work, enough that she thinks of it as
  a client category rather than a one-off.
- **Verified:** She believes UtilitySheet does not currently collect door and camera
  information. For most door types and for cameras, she is correct.
- **Verified:** She does not know how far the seller form's question set can be changed.
- **Interpretation, about 75 to 80 percent confidence:** "Can info collected be edited?"
  asks about configuring what the form collects, not about correcting submitted answers.
- **Strong inference:** She is currently collecting this information somewhere else, most
  likely email, text, or a spreadsheet, and would prefer it in one place.
- **Hypothesis, unverified:** She sees UtilitySheet as a property handoff packet rather
  than a utility sheet. Her message is consistent with this but does not establish it.
- **Hypothesis, unverified:** Other customers share this need. One request from one
  paying customer is a signal to investigate, not a mandate to build.

**The unmet need in one sentence:** the product's question set is shaped for a standard
residential sale, and she runs a second transaction type that the product does not model.

---

## 3. Critique of Each Preliminary Idea

### Idea 1: Improve discoverability. Verdict: Do it, but re-scope it.

Strong instinct, partly misaimed.

- **"Add a shortcut from request creation" is largely already built.** The
  `AdvancedModuleConfigurator` already renders on the new-request page under "Advanced
  Modules & Questions." Verify the flow before funding work here.
- **Renaming the "What sellers are asked" heading is the weakest item on the list.** The
  heading is fine. Users are not failing at the heading. They are failing one level up,
  at a mode toggle whose name hides its contents.
- **The naming problem worth fixing is "Advanced Utility Packet."** That label describes
  internal scope, not customer value, and the word "Utility" actively conceals that the
  mode contains access, security, and service-provider questions. Someone looking for
  door codes has no reason to open something called an advanced *utility* packet. Renaming
  the mode is worth more than renaming the section.
- **The genuinely strong version of this idea is inventory visibility.** There are five
  modules and 33 built-in questions. Nothing in the product lets a user see the full list,
  search it, or preview what a seller will actually be asked. "Can it collect X?" is
  currently unanswerable without toggling a mode and expanding five accordions.

Re-scoped: show the question inventory and a seller preview, rename the mode, and skip
the heading rename.

### Idea 2: Add custom questions. Verdict: Premature. Most expensive item on the list.

This is the idea most likely to feel obvious and be wrong at this stage.

- **Evidence does not support it.** One customer, who has not yet named a single field,
  and whose three named needs are all satisfiable by four to six built-in fields.
- **The cost is systemic, not local.** An arbitrary user-defined field has to pass through
  Zod validation in `lib/validation/schemas.ts`, seller wizard rendering, the exclusions
  model, packet HTML, the submitted-sheet editor, and the PDF builder.
  `docs/pdf-system-reference.md` is authoritative and pagination plus selectable text are
  stated constraints. Arbitrary labels and arbitrary lengths are exactly what breaks a
  fixed-layout PDF.
- **It erodes the product's actual quality advantage.** Every built-in field carries a
  curated `sellerPrompt` and `example` ("What garage door code should be handed off?",
  "2468"). That copy is why sellers with no account and no training answer correctly on a
  phone. A customer-authored label like "codes" will lower completion quality, and the
  resulting packet is still the customer's deliverable. You would be selling them a way to
  make their own output worse.
- **A cheap substitute already ships.** `other_maintenance_providers`,
  `smart_home_notes`, `service_provider_notes`, `lawn_exterior_notes`, and
  `irrigation_notes` already absorb unstructured needs.

Keep it on the roadmap as a Later item, gated on measured demand.

### Idea 3: Short-term rental preset. Verdict: Best idea on the list, but currently two ideas wearing one coat.

The proposed preset mixes fields that exist (garage code, alarm, smart devices, service
providers, parking, trash) with fields that do not (door and gate and lockbox codes,
camera brands and locations, Wi-Fi handoff). Those two halves have completely different
cost and risk.

- **The preset over existing fields is nearly free.** It is a named bundle of module and
  exclusion selections. No schema change, no new validation, no PDF risk.
- **The new fields are where all the risk lives**, both engineering and security.

Split it. Ship the preset over existing fields early as a discoverability and packaging
device. Add the missing fields as a separate, small, deliberate change behind the
guardrails in section 6.

One caution: a preset is only as useful as the ability to *keep* it. If a user can apply
an STR preset but their single reusable link then permanently carries STR questions into
standard sale files, the preset creates a new annoyance. The preset and the profiles work
(Idea 6) are more coupled than the handoff suggests.

### Idea 4: Conditional questions. Verdict: Reject for now. Wrong mechanism for this problem.

- It adds branching complexity to the seller flow, which is the one surface that must stay
  frictionless. Sellers are unpaid, untrained, often on a phone, and every added decision
  costs completion rate.
- It solves at runtime what should be solved at configuration time. If the coordinator can
  pick the right form when creating the request, the seller never sees a branch and never
  has to self-classify a property.
- It asks the wrong person. The coordinator knows the property type. The seller should not
  have to declare it.
- It is a strictly larger version of Idea 6, with worse ergonomics.

Do not build. If profiles ship and users still ask for branching, revisit.

### Idea 5: Safer handling for sensitive answers. Verdict: Correct concern, presented as one idea when it is eight, spanning two orders of magnitude in cost.

Split by cost and value:

**Cheap and high value, do these:**
- A `sensitive: true` flag on field metadata. `ADVANCED_MODULE_FIELD_METADATA` already
  exists as the single declaration point, so this is a small change with one render rule.
- Exclusion of sensitive values from PDFs and from emailed PDF attachments by default. An
  emailed PDF is the least controllable artifact the product produces.
- Copy guidance encouraging temporary handoff codes rather than permanent credentials.
  Pure copy, zero schema, real risk reduction.

**Moderate cost, high value, do this next:**
- Revocable or regenerable packet links. This is the single largest actual gap. Verified:
  `requests.public_token` is a permanent bearer token with no `expires_at`, no revocation
  column, and no view audit. If a link is forwarded to the wrong person there is currently
  no remedy at all. If the product is going to hold access credentials, "revoke this link"
  is table stakes, and it is a modest schema plus route change.

**Expensive and premature, defer:**
- Recipient verification, secondary access codes, view history and audit events, and link
  expiry. These constitute a security product. They need schema work, new UX, new failure
  modes, and support burden, and no customer has asked for them.

**One important note.** `.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md`
already accepted access codes in packets, deliberately, with the consequence recorded that
anyone holding the link or PDF can see them. Do not re-litigate that decision for the
closing case. But do recognize that the short-term-rental case is materially different and
was not contemplated by it. That record explicitly anticipated this: "future changes to
packet-link access controls should account for the possibility of optional access-code
content." Section 6 explains why the risk profile genuinely changes.

### Idea 6: Reusable form profiles. Verdict: Underrated here. Rank it above Ideas 2 and 4.

The handoff lists this sixth. It is the structural fix for the constraint verified in
`schema.sql`, and it is the only idea that addresses *why* Michelle's second transaction
type does not fit.

- It solves the real problem with a model users already understand from every other tool.
- It makes presets durable rather than destructive.
- It is the correct place for property-type variation, at configuration time rather than
  in the seller flow.

But be honest about cost. `intake_links` has `UNIQUE(account_id)` and one slug per account.
Profiles means a one-to-many rewrite, slug allocation per profile, defaults resolution,
request creation changes, and team and organization semantics for who owns which profile.
That is a real slice with a migration, not a settings tweak. It belongs in Next, sequenced
after the preset experiment tells you whether anyone wants a second configuration at all.

### Idea 7: Explore broader positioning. Verdict: Right question, false binary.

The choice is not "stay narrow" versus "become a property handoff packet." There are three
distinct directions, and only two of them are safe:

1. **Deeper coverage within a residential sale.** Already the current trajectory. Advanced
   mode is exactly this. Safe and on strategy.
2. **More transaction types, same shape.** Sale, short-term-rental sale, long-term rental
   turnover, vacant property. Still address-first, still one-shot capture, still no seller
   account, still a single deliverable. This is a natural, defensible expansion and is what
   profiles plus presets buys you.
3. **Ongoing short-term-rental operations.** Recurring cleaner and guest and manager
   handoffs, living credentials, rotating access. This is a different product with a
   different buyer, a different data model (ongoing state rather than a captured snapshot),
   and a different competitive set (Operto, Breezeway, Turno, guidebook tools). The
   address-first, no-account, one-shot capture model is well suited to directions 1 and 2
   and poorly suited to direction 3.

Recommendation: pursue direction 2 deliberately, name it, and decline direction 3. The
danger is drifting into direction 3 one field at a time without ever deciding to.

Note the dilution risk on the other side too. Every question added to advanced mode is a
question some seller has to skip. Field count is not free, and seller completion rate is
the metric that should govern it.

---

## 4. Additional Ideas Generated Independently

**A. Give her the honest, complete answer about configurability.** Yes, the question set is
editable within limits: five modules, 33 built-in questions, each one individually
removable, configurable both as workspace defaults and per request. No, questions cannot be
added or reworded. Say both halves plainly. The second half is what tells you whether she
needs a few named fields or an authoring tool, and it is the difference between a one-week
answer and a one-quarter answer. Mention post-submission editing as an aside, since it is
an adjacent Pro capability she may not know she has, but do not treat it as the answer.

**B. Question inventory and live seller preview.** A single view listing all 33 built-in
questions, searchable, with a preview of what a seller sees. This makes "can it collect X?"
self-service, and it doubles as a marketing and SEO asset ("everything UtilitySheet
collects"). This is the strongest version of Idea 1.

**C. Instrumented gap capture. My highest-leverage recommendation.** Add a small "Don't see
a question you need?" input inside the Advanced questions configurator that records the
requested field text, workspace, and date. This converts every future Michelle into
structured demand data automatically, at roughly a day of work. It directly de-risks the
two most expensive decisions on the list (custom questions, and which new fields to add)
by replacing a debate with a ranked list. It is the instrumented, scalable version of "ask
Michelle which fields she needs." Privacy note in section 6.

**D. Rename the mode, not just the heading.** "Advanced Utility Packet" to something that
names the value, for example "Complete Handoff Packet" or "Full Property Handoff." This is
positioning and discoverability in a single change. Touches marketing copy, the pricing
page, and settings copy. The database enum values `simple` and `advanced` are internal and
can stay.

**E. Sensitive fields as one first-class concept, declared once.** Rather than handling
each credential field ad hoc, declare `sensitive: true` in the existing field metadata and
implement exactly one rule set: masked behind an explicit reveal in the web packet,
excluded from PDF and email attachments by default, never logged. Cheap precisely because
`ADVANCED_MODULE_FIELD_METADATA` is already the single source of truth.

**F. Revocable and regenerable packet links.** Covered under Idea 5. Calling it out
separately because it is the one security item worth doing on its own merits, independent
of anything short-term-rental related.

**G. Collect the handoff plan, not the secret. My favorite idea in this document.** Instead
of asking "What is the front door code?", ask "How will door access be transferred?" with
choices such as: code changed at closing, code provided separately, physical keys or
lockbox, smart lock account transfer. Add an optional free-text detail. This captures most
of the operational value, eliminates most of the credential risk, is genuinely more useful
to the recipient (a code with no context is often useless anyway, and a code captured two
weeks before closing is frequently stale by handoff), and is differentiated rather than
merely permissive. It is a product-design answer to the security problem instead of a
security-feature answer. Test this framing with Michelle directly (question 5 in section 7).

**H. Treat "TCs serving investor and STR clients" as a possible segment, and test it with
content before code.** If this segment is real, a landing page and a piece of content will
produce signal faster and cheaper than any feature. If it produces nothing, you have saved
a roadmap slot.

**I. Mine the data you already have.** Detailed in section 8. You can answer "are the
built-in fields sufficient?" today, with zero engineering.

---

## 5. Now / Next / Later Recommendation

### Now (this week, mostly not engineering)

1. **Reply to Michelle properly.** Tell her both halves of the configurability answer: the
   33 built-in questions she can turn on and off, and the fact that she cannot add or
   reword any. Be honest that garage codes, alarms and smart devices are covered while
   front door codes and cameras are not. Cover the submitted-data reading in one sentence
   too, in case that is what she meant. Then ask the five questions in section 7. Honesty
   here is worth more than a partial workaround, and it sets up everything else.
2. **Run the data analysis in section 8.** Zero engineering, and it converts a one-customer
   anecdote into a base rate before you spend anything.
3. **Verify the discoverability claim before funding fixes.** Walk the real flow. The
   configurator already exists on the new-request page.
4. **Ship instrumented gap capture (Idea C).** Roughly a day. Everything expensive
   downstream depends on evidence this produces.

Rationale: nothing here commits the roadmap, and all of it makes the next decision better
informed. Total cost is roughly one engineering day plus one analysis session.

### Next (weeks, two small slices, contingent on Now)

5. **Discoverability slice:** question inventory plus seller preview, and rename the mode.
6. **Safety primitives slice:** `sensitive` field flag with PDF and email-attachment
   exclusion, plus revocable and regenerable packet links, plus temporary-code copy
   guidance.
7. **Short-term rental preset over existing fields only.** Ship it as a named starting
   point. Measure selection rate. This is the cheapest possible test of whether the segment
   is real.
8. **Then add two to four named access fields, phrased as idea G, not as codes.**
   Revised 2026-09-03 in light of the 8.3 percent garage-code fill rate. Ask "how will
   door access be transferred?", "how will camera or alarm accounts be handed over?", and
   "how will Wi-Fi be handed over?" rather than asking for the secrets themselves. A
   camera presence and location field is worth adding outright, since it is descriptive
   rather than secret and sellers answer descriptive questions reliably. Keep an optional
   sensitive detail field on each, but do not expect it to be filled, and do not measure
   success by whether it is.

Rationale: the safety primitives ship *before* the new credential fields, not after. This
is the one sequencing change I would insist on. It turns the preliminary recommendation's
fifth point from a permanent blocker into a two-item prerequisite that actually gets built.

### Later (only with evidence from Now and Next)

9. **Multiple form profiles.** Real schema work on `intake_links`. Fund it when preset
   selection rate or gap-capture data shows users genuinely run more than one transaction
   type. This is the highest-value Later item.
10. **Custom question builder.** Fund only if gap capture shows a long tail of distinct,
    unservable requests rather than a short list you could simply build. Watch the PDF
    layout constraint carefully.
11. **Conditional or branching questions.** Likely never needed if profiles ship.
12. **Security tier** (expiry, recipient verification, audit trails). Only if customers ask
    or a segment requires it.

### How this differs from the preliminary recommendation

The preliminary recommendation is directionally sound. Five changes:

- **Corrects** the assumption that the capability mostly already exists. Front door codes
  and cameras have no field. Discoverability alone will not close her request.
- **Sharpens** what "she did not know where to find it" means. She can select from 33
  questions and cannot author any. Both halves belong in the answer, and the second half is
  the one that sets the roadmap.
- **Adds** instrumented gap capture so you learn from every customer rather than only from
  the one who happened to write in.
- **Reorders** so that the sensitive-field flag and revocable links ship *before* new
  credential fields, which makes the fifth preliminary point actionable rather than
  blocking.
- **Reranks** profiles above the custom-question builder and drops conditional questions.

---

## 6. Security and Privacy Guardrails

**Why the risk profile genuinely changes, even though the decision record already accepted
access codes.** The 2026-07-30 decision reasoned about a *closing handoff*: a one-time
event, privately shared, after which codes are typically changed. Short-term-rental access
credentials are a different thing wearing the same field name. They are live operational
secrets for an occupied, revenue-generating property. They are routinely shared onward to
cleaners and maintenance staff. They are frequently not rotated. And the handoff is not a
single terminal event. Same field, materially higher blast radius. That difference, not the
existence of code fields as such, is what justifies new guardrails.

**Verified current state:**
- `requests.public_token` is a permanent, unguessable bearer token. No expiry column, no
  revocation flag, no view audit.
- Packet, seller, and intake routes are `noindex` and disallowed in `app/robots.ts`, so
  search engine exposure is handled.
- The `is_locked` mechanism is plan enforcement, not a security control. Do not confuse the
  two.
- Anyone holding the link or the PDF sees everything in it. This is documented and accepted.

**Guardrails to adopt before expanding credential collection:**

1. **Never make a credential field required.** Optional always, and never a completion
   blocker for the seller.
2. **Mark credential fields `sensitive` and exclude them from PDFs and email attachments by
   default.** A PDF attached to an email is the least controllable artifact the product
   produces, it lands in inboxes the customer does not control, and it cannot be revoked
   after the fact. Web packet display can mask behind an explicit reveal.
3. **Ship revocation before you ship more credentials.** If the product holds door codes,
   the customer needs a way to kill a forwarded link. This is the highest-value security
   item and it is independently useful.
4. **Prefer Idea G's framing wherever it works.** Asking how access transfers rather than
   what the code is removes the risk instead of managing it.
5. **Guide toward temporary codes in seller-facing copy**, at the point of entry, not
   buried in help documentation.
6. **Never log, never send to AI providers, never include in telemetry.** Per
   `docs/ai-telemetry.md`. If any AI suggestion path can see advanced module data, verify
   that sensitive fields are excluded before adding any of them.
7. **Gap capture free text is user-entered and may contain credentials or personal
   information.** Store it as a workspace-scoped feature request record, not as an
   analytics event property, and apply the existing redaction rules. A well-meaning user
   will type a real code into a "what field do you need?" box eventually.
8. **State the exposure model plainly in the UI**, near the credential fields. Something to
   the effect that anyone with the packet link can see these values. Informed consent is
   cheap and it is the honest thing to do.
9. **Update the decision record** at
   `.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md` if scope
   expands, per the repository's own requirements. Do not let an expansion of credential
   collection happen without an updated durable record.

**One thing to avoid:** do not build the full security tier (verification, audit, expiry)
as a prerequisite. That is how a reasonable safety concern becomes a permanent blocker and
the customer need never gets served. Two primitives are enough to proceed responsibly.

---

## 7. Five Follow-Up Questions for Michelle

Ordered by decision value. Question 1 is the one that most changes the roadmap.

1. **"When you say short-term rental clients, are you coordinating the sale or purchase of
   these properties, or are you handling handoffs for properties that stay in operation?"**
   This determines whether the opportunity is a preset inside the current product or an
   entirely different product. Nothing else should be funded until this is answered.

2. **"What are the five to ten specific things you collect for these files today? Their
   exact labels, as you would write them. And are there questions we already ask that you
   would want worded differently?"** The first half converts the request into a buildable
   list. The second half is the real test of selecting versus authoring, and it is the
   evidence that decides whether a custom-question builder is ever needed.

3. **"Who receives the finished packet, and how does it get to them?"** Determines the real
   exposure model and whether the current single-link approach fits.

4. **"What do you use today for the parts UtilitySheet does not cover, and what actually
   goes wrong when something is missed?"** Reveals the true competitor (probably a
   spreadsheet or email) and sizes the pain.

5. **"For codes and passwords specifically, do you need the actual code in the packet, or
   would it be enough to record how access will be transferred, for example changed at
   closing or provided separately?"** Directly tests Idea G. A yes here removes most of the
   security problem and would meaningfully simplify the roadmap.

Ask these as a short conversation, not a survey. She wrote two sentences and is more likely
to answer a reply than a form.

---

## 8. Smallest Validating Experiments, and Success Metrics

### Results, run 2026-09-03

The queries in `docs/product-feedback/2026-09-03-advanced-field-usage-analysis.sql` were
executed read-only against production. Key results:

- **Advanced mode adoption:** 5 of 9 Pro workspaces default to advanced (55.6 percent),
  versus 1 of 108 Free workspaces. Adoption among paying users is healthy, so the
  discoverability problem is narrower than assumed. Michelle is unusual in not having found
  it, which slightly lowers the value of the discoverability slice and raises the value of
  the missing-field question.
- **Volume:** 286 advanced requests, 221 submitted. Simple mode submits at 82.1 percent
  versus advanced at 77.3 percent, so advanced mode costs roughly 5 points of completion.
  Real but modest.
- **Concentration, and the main caveat:** 271 of 286 advanced requests, 95 percent, come
  from just 2 Pro accounts. Both are genuine customers, with 178 and 69 distinct property
  addresses spread across 103 and 50 separate days. This is real usage, not seeded data,
  but it is effectively **n = 2 workspaces** and must not be read as a market base rate.
- **Fill rates:** see Finding 4 in section 1. This is the decisive result.
- **Exclusions:** at the workspace-defaults level only 1 to 2 workspaces exclude any given
  field, so nobody is stripping the access module. The much larger per-request exclusion
  counts in query 5a are the same 2 power users propagating their defaults across hundreds
  of requests, and should not be read as broad sentiment.
- **Notes pressure:** almost none. Only 6 non-empty notes answers in total, longest 89
  characters. There is **no** hidden demand showing up as free text, which meaningfully
  weakens the "customers are working around missing fields" hypothesis.

**What this changed.** The credential expansion is now the weakest item on the roadmap
rather than a promising one. Idea G is promoted from an interesting reframe to the primary
recommendation for any access work. The gap capture slice is unaffected and remains the
right immediate build.

**What it did not change.** Michelle's request is still legitimate, the coverage gap in
Finding 1 is still real, and the sale-versus-operations question is still unanswered.

### Zero-engineering analysis, as originally specified

You already hold the data to partially answer "are the built-in fields sufficient?"

- **Advanced mode adoption:** the share of paid workspaces with
  `intake_links.default_packet_mode = 'advanced'`, and the share of requests with
  `packet_mode = 'advanced'`. Low adoption means this is primarily a discoverability
  problem and validates the Now slice.
- **Which questions survive:** aggregate `advanced_module_exclusions` across workspaces.
  Fields customers actively turn off are fields you should not have built, and modules
  nobody enables are dead weight. This directly informs whether more fields is the right
  direction at all.
- **Which questions get answered:** fill rates per field in `advanced_packet_data`. A field
  that is enabled but never filled is failing, whether from bad copy or seller reluctance.
  Pay particular attention to `garage_door_code`, because it is the closest existing
  analogue to what Michelle wants. **If sellers routinely leave the existing garage code
  blank, that is strong evidence they will also leave a front door code blank, and the
  entire credential expansion is worth much less than it appears.** This is the single most
  informative number available today.
- **Notes field usage:** frequency and content patterns in `smart_home_notes` and
  `other_maintenance_providers`. If people are already typing access details into notes,
  that is unprompted demand for structured fields, and it is the best evidence you will get
  without asking anyone.

Aggregate counts only. No values, no per-customer content review beyond what is needed, and
nothing sensitive reproduced in reports.

### Cheap experiments, in order

1. **Michelle conversation.** One customer, one day, highest information density.
2. **Four to six similar customers.** Ask what transaction types they run and what they
   collect outside the product. Establishes whether short-term rental is a segment or a
   single account.
3. **Gap capture in product.** Passive, continuous, ranks demand automatically. Roughly one
   day of work.
4. **Short-term rental preset over existing fields.** Selection rate is a direct measure of
   segment reality and costs almost nothing to ship.
5. **Content test for the segment (Idea H).** A page targeting coordinators who serve
   investor and rental clients. Signups attributed to it are the cheapest possible demand
   signal for direction 2 positioning.

### Success metrics and thresholds

**Leading, from the Now slice:**
- Advanced mode adoption among paid workspaces, before and after the discoverability slice.
  Target a meaningful lift, and treat a flat result as evidence that the problem was
  capability rather than discovery.
- Gap capture submissions per week, and the concentration of the top five requested fields.
  **Concentrated means build those fields. Long tail and highly varied means the builder is
  the right answer after all.** This is the decision rule for Idea 2.

**Confirming, from the Next slice:**
- Short-term rental preset selection rate among paid workspaces. Meaningful uptake supports
  funding profiles. Near-zero uptake means stop, and you will have spent very little.
- Fill rate on any new access fields. Low fill means the fields were not the problem.

**Guardrail metrics, watch these throughout:**
- **Seller completion rate and time to complete, advanced versus simple.** This is the
  metric that should have veto power. Every added question taxes it, and the no-account
  seller flow is the product's core asset.
- Support volume relating to access codes or link sharing, as an early warning on the
  security model.
- Packet view and PDF download rates, to confirm the added content is actually consumed.

**Counter-evidence to take seriously.** If advanced mode adoption is already high and
exclusions show customers *removing* the access module, then Michelle is an outlier and
most customers want less, not more. That result should stop the expansion, and the analysis
above will surface it before anything is built.

---

## 9. One Recommended Immediate Product Action

**Ship instrumented gap capture: a "Don't see a question you need?" input inside the
Advanced questions configurator that records the requested field text.**

Why this one:

- It is roughly a day of engineering, with no schema risk to existing flows and no seller
  flow impact.
- It de-risks the two most expensive decisions on the entire list (which fields to add, and
  whether to build a custom-question builder) by replacing opinion with a ranked list.
- It scales the insight. Michelle wrote in. Most customers will not. This captures the ones
  who would have silently churned or silently worked around the gap.
- It is useful regardless of which strategic direction wins.
- It starts accumulating evidence immediately, so the Next slice can be funded on data
  rather than on this document.

Alongside it, the same-day non-engineering action: **reply to Michelle**, answer her
editing question directly, be honest about what is and is not covered today, and ask the
five questions in section 7. She wrote in, which means she is engaged. That is a
perishable asset.

---

## 10. Confidence and Evidence Limits

Stated plainly, because the handoff correctly asked for it.

**Verified against the repository:** current field inventory and the absence of camera,
Wi-Fi, front door, gate, lockbox, and smart lock fields; the `UNIQUE(account_id)`
constraint on `intake_links`; the permanent non-revocable nature of `public_token`; the
absence of expiry, revocation, and view audit columns; noindex and robots coverage; the
existing accepted decision on access codes; and that the module configurator already
appears on the new-request page.

**Verified from the handoff:** Michelle's message, her paying status, and the content of
the initial response.

**Interpretive judgment, not verified:** that "Can info collected be edited?" asks about
configuring the form's question set rather than correcting submitted answers. An earlier
draft of this memo took the opposite reading and treated the reply as having missed her
question. The product owner's reading is better supported by her own example, which is
entirely about collection scope, and it is adopted here at roughly 75 to 80 percent
confidence. One sentence in the reply covers both readings, so nothing downstream depends
on resolving it first.

**Hypotheses, not established:** that short-term rental work represents a real segment
rather than one account; that customers view UtilitySheet as a property handoff packet;
that additional fields rather than better discovery is the binding constraint; and that
sellers will actually supply access credentials when asked.

**Evidence still needed before the Next slice:** Michelle's answers, the aggregate field
usage analysis in section 8, and a small number of similar customer conversations.

**Single largest unknown:** whether Michelle means the *sale* of short-term-rental
properties or their *ongoing operation*. That one answer separates a cheap preset from a
different product, and it is currently a coin flip.
