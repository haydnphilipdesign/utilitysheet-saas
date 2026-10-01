# Deferred: HOA Portal Login and Association Document Upload

- Date: 2026-10-01
- Status: **Deferred by the product owner. Not approved, not planned, not built.**
  This document exists so the reasoning and the implementation shape are ready
  if either is picked up later.
- Source: Alisha Starkey's reply of 2026-09-19, summarized in
  `2026-09-19-alisha-starkey-hoa-feedback.md` section 10.
- Related: `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md`,
  `.ai/plans/2026-09-19-hoa-question-group.md`,
  `.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md`,
  `2026-09-03-michelle-wright-opus-evaluation.md`.

Both asks came from one listing-side transaction coordinator in Oregon. Her
stated goal: get the association documents delivered to the buyer as early as
possible, because other contract timelines start at delivery. The portal login
and the documents are two routes to that one goal.

What shipped instead on 2026-10-01: the HOA question group on Home Basics, which
collects the association name, management company, a contact (name, phone,
email), dues and billing period, and a free-text "where are dues paid or
documents found" answer. That gives a coordinator everything needed to request
the documents from the management company.

---

## 1. HOA portal login

### What was asked

"Login info if they have it": the seller's username and password for the
association's resident portal, so the coordinator can download the documents
herself.

### Decision, 2026-10-01

Do not collect it for now. The seller form's portal field carries helper text
asking sellers not to enter passwords or account numbers, and the editor carries
the same warning.

### Why it was deferred

1. **It would print on the buyer's packet.** Home Basics answers render on the
   public packet page and in the PDF, which is also emailed. There is no
   per-field exclusion for Home Basics. A credential stored beside the other HOA
   answers would reach the buyer and anyone the link or PDF is forwarded to.
2. **It is a different kind of secret from a garage code.** The 2026-07-30
   decision accepted garage codes because the buyer needs them and they are
   normally changed at closing. A portal login is the seller's personal account
   credential. The buyer never needs it (they register their own account), it is
   often a reused password, and the portal may show payment methods and other
   owners' information.
3. **It would be stored in plaintext**, reachable through a link-addressed form
   with no seller account, and returned to that form to prefill a resubmission.
4. **Sellers mostly do not answer secret questions.** The 2026-09-03 analysis
   found an 8.3 percent fill rate on `garage_door_code` among sellers who filled
   in that same section, against 80 to 90 percent for "where is it" and "who
   services it" questions. A login field would likely be asked often and
   answered rarely.
5. **Sharing a login may break the portal's terms of use.** Unverified, and worth
   a sentence of caution in any future copy.

### If it is picked up: what a safe version needs

The requirement is a **coordinator-only answer**: collected from the seller,
visible to the requesting account, and never part of the packet. Nothing in the
product has that visibility today, so it is a new concept, not a new field.

- **Storage.** Not a column on `requests`. Request rows are read with
  `SELECT *` and returned with `RETURNING *` in `lib/neon/queries/requests.ts`,
  and `lib/packet/packet-data.ts` builds the public payload from that row. A
  separate table keyed by request id, never joined by the packet path, removes
  the chance of a leak by default. Consider application-level encryption with a
  key held outside the database.
- **Never in the packet.** Excluded from `PacketRequestData`, the packet API,
  `lib/pdf/packet-html.ts`, and every emailed attachment. Add a test that fails
  if the value appears in packet HTML, mirroring
  `tests/unit/home-basics-labels.test.ts`.
- **Never echoed back to the seller form.** `GET /api/seller/[token]` now
  returns earlier HOA answers to prefill a resubmission. A credential must be
  write-only from that side.
- **Never in telemetry or logs.** `docs/ai-telemetry.md` already excludes
  free-text answers; a credential needs an explicit test.
- **Retention.** Delete automatically a fixed time after submission or closing
  date, and let the coordinator delete it sooner. A stale credential is pure
  liability.
- **Display.** Authenticated dashboard only (request detail and the
  submitted-sheet editor), masked behind an explicit reveal, with an event log
  entry when revealed.
- **Lifecycle.** Covered by account data export
  (`lib/neon/queries/account-data.ts`) and by account closure.
- **Seller copy.** State plainly who will see it and that it is not shared with
  the buyer. Suggest a temporary password where the portal allows one.
- **Plan gating.** Decide deliberately. Home Basics is on every plan; a
  credential feature does not have to be.

### A cheaper alternative to test first

Ask how access will be handed over instead of asking for the secret, the same
reframing recommended for door codes in the 2026-09-03 evaluation (idea G). For
example: "Can you download the association documents from the portal?" with
choices such as Yes, I can send them / I need help / There is no portal. That
captures most of the coordinator's value with no credential stored.

### What would justify revisiting

- More than one customer asking for the login specifically, after having the
  management contact fields.
- Evidence that coordinators cannot get documents from management companies
  with the contact details alone.
- A decision to build coordinator-only answers for another reason, which would
  make this a small addition rather than a new subsystem.

---

## 2. Association document upload

### What was asked

"All of the association documents" up front. Her two attachments list them:
Oregon REALTORS Form 4.4 section 7 and OREF 024 section 1 name roughly sixteen
document types (CC&Rs, bylaws, articles, rules, board resolutions and minutes,
budget, financial statements, reserve study, insurance certificates and
policies, inspection and assessment reports, an accountant's review).

### Decision, 2026-10-01

Not part of the HOA question group. Recorded as the first request for it.

### Why it was deferred

It is a new capability, not a question. UtilitySheet today collects short
answers and produces a web page and a PDF. Collecting files changes what the
product stores, what it costs to run, and what can go wrong.

### If it is picked up: what it needs

- **Storage.** The product already uses Vercel Blob for brand logos
  (`app/api/branding/upload/route.ts`): authenticated upload, 2 MB limit, an
  image type allowlist, and content sniffing. Documents differ on every point:
  the uploader is an unauthenticated seller, files are large PDFs, and they must
  be private rather than publicly addressable.
- **A public upload endpoint is an abuse surface.** It needs a seller-token
  check, a strict type allowlist (PDF, common images), size and count limits per
  request, rate limiting, content sniffing, and a decision on malware scanning.
- **Access.** Private storage with short-lived signed URLs. Decide whether
  documents are coordinator-only or can be included in the buyer's packet, per
  document. The contract timelines she describes start at delivery to the buyer,
  so delivery tracking may matter more than storage.
- **Lifecycle.** Deletion when a request is deleted, when an account closes, and
  after a retention period. Inclusion in account data export.
- **Cost and plan.** Storage and bandwidth scale with usage. This is a natural
  paid feature, unlike the HOA questions.
- **Seller reality.** The seller flow is phone-first with no account. Association
  documents usually live in an email inbox or a portal, not on a phone. Expect
  low completion from sellers, and consider letting the coordinator upload too.
- **PDF.** The packet PDF is a fixed layout of text. Uploaded documents would be
  linked from it or delivered beside it, not merged into it.

### Cheaper steps that test the demand first

1. **A document checklist with no files.** "Which of these can you provide?"
   over the common document types. It tells the coordinator what to chase and
   costs one more question group.
2. **Count the Yes answers.** `has_hoa` is now in the redacted `seller_submitted`
   event summary. The share of sellers answering Yes sizes the audience before
   anything is built.
3. **Ask the next customers who raise HOA** whether they want the documents in
   UtilitySheet or only want to know where to get them.

### What would justify revisiting

- Several customers asking for document collection, not only one.
- A meaningful share of submissions answering Yes to the HOA question.
- A decision to position UtilitySheet as a wider transaction-document tool,
  which is a strategy decision and not a feature decision.

---

## 3. What these two are not

Neither is evidence for or against a custom-question builder. A login is a
visibility and security problem. Document upload is a storage problem. A builder
would solve neither. The builder question is being evaluated separately in
`.ai/plans/2026-10-01-custom-questions-evaluation.md`.
