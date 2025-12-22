# UtilitySheet.com PRD

## 1) Product summary

UtilitySheet is an address-first SaaS that standardizes and accelerates the collection and handoff of **utility provider information** during a home sale. Agents/TCs generate a request link for a property; sellers complete a **tap-to-confirm** form in minutes; UtilitySheet generates a **branded Utility Info Sheet** (PDF + share link) and provides a dashboard for tracking completion and exceptions.

**Hard constraint:** Sellers are never asked to upload bills or research provider contact details. At most, they confirm suggested providers or type/select a provider name.

---

## 2) Goals and success metrics

### Goals

1. **Minimize seller effort** to near-zero.
2. **Maximize completion rate** and reduce agent/TC follow-ups.
3. Produce a **standardized, professional utility info sheet** that becomes the default artifact used across parties.
4. Improve provider suggestions over time without user-maintained databases.

### Success metrics (MVP targets)

* Seller median completion time: **≤ 2 minutes**
* Form completion rate (within 48 hours of send): **≥ 70%**
* Suggested-provider confirm rate: **≥ 60%** (rising over time)
* Info sheets generated per month per paid account: growth indicator
* Reduction in “chasing seller” follow-ups (self-reported / event proxy)

---

## 3) Non-goals (explicit)

* No seller bill uploads or document OCR.
* No requirement for sellers to provide phone numbers/links (system attempts to resolve).
* No “user-curated provider databases” or “regional template admin setup” as part of onboarding.
* No direct utility transfer initiation integrations in MVP.

---

## 4) Personas

1. **Transaction Coordinator (Primary Buyer)**

   * Needs a consistent packet, tracking, reminders, and exception handling.
2. **Real Estate Agent (Primary Buyer)**

   * Wants branded deliverables and a smooth seller experience.
3. **Seller (Primary End User)**

   * Wants the quickest possible flow with minimal typing.
4. **Buyer (Secondary Recipient)**

   * Receives an info sheet with clear next steps and contacts.

---

## 5) Core user journeys

### Journey A: Create and send request (Agent/TC)

1. Log in → Dashboard
2. Click **New UtilitySheet Request**
3. Enter property address (+ optional closing date)
4. Choose branding profile
5. Select utility categories (defaults on)
6. Generate share link + optionally send via built-in SMS/email template
7. Track status on dashboard

**Acceptance criteria**

* Request creation in **≤ 60 seconds**
* Link is copyable and works without seller login
* Branding is applied to both web info sheet + PDF

---

### Journey B: Seller completes form (Seller)

1. Open link on mobile
2. See property address + quick intro
3. For each utility category:

   * Suggested provider(s) shown → seller taps **Confirm**
   * If wrong: tap **Not this** → type provider name → pick from autocomplete → done
   * If unsure: tap **Not sure** → skip
4. Optional toggles: Well / Septic / Propane / Oil (removes categories)
5. Submit

**Acceptance criteria**

* No account required
* Flow is usable one-handed on mobile
* Seller can complete with **0 typing** if suggestions are right
* Submission never blocked by unknown fields

---

### Journey C: Info sheet generation + tracking (Agent/TC)

1. Seller submits → dashboard shows **Submitted**
2. Agent views generated info sheet web page
3. Agent downloads PDF
4. Optional: send packet link to buyer/title

**Acceptance criteria**

* Info sheet is generated automatically on submission
* PDF generation completes in **< 10 seconds** typical
* Dashboard shows “Needs attention” only for system-resolution failures (not seller tasks)

---

## 6) Product scope

### MVP (must-have)

* Account system for agents/TCs (single tenant + team-ready)
* Branding profiles
* Request creation + unique seller link
* Seller smart form with:

  * Suggested providers per category
  * Confirm / Not this / Not sure
  * Provider name autocomplete
  * Applicability toggles (Well/Septic/Propane/Oil)
* Provider Resolution Engine (suggest + normalize + contact lookup)
* Info sheet web page + PDF export
* Dashboard with statuses + basic filters
* Reminder automation (simple: nudge seller if not completed)

### V1+ (nice-to-have)

* Multi-brand per team/brokerage, RBAC
* Multiple trash providers / notes per category
* Closing-date-based reminders and escalation rules
* Buyer-facing “next steps” checklist customization
* API/webhooks for external systems

---

## 7) Screens and UI requirements

### 7.1 Agent/TC Dashboard

**Views**

* Requests list (table)

  * Address
  * Seller name (optional field)
  * Closing date (optional)
  * Status: Draft / Sent / In progress / Submitted
  * Flags: Needs attention (e.g., contact lookup failed)
  * Created by
  * Last activity timestamp

**Actions**

* Create new request
* Copy seller link
* View seller form (preview)
* View info sheet
* Download PDF
* Resend reminder

**Filters**

* Status
* Closing date range
* Created date range
* Search by address / client name

---

### 7.2 Request Creation Wizard

**Fields**

* Property Address (required) with autocomplete
* Seller name (optional)
* Seller email/phone (optional, for built-in send/reminders)
* Closing date (optional)
* Branding profile (required default)
* Utility categories (checkboxes default on):

  * Electric, Gas, Water, Sewer, Trash
  * Optional: Internet (off by default)

**Output**

* Seller link (unique token)
* Suggested message templates for copy/paste (SMS + email)

---

### 7.3 Branding Profile Manager

**Fields**

* Brand name (e.g., “Haydn Team”)
* Logo upload
* Primary/secondary colors
* Agent/team contact block:

  * Name, phone, email, website (optional)
* Optional footer disclaimer text

**Acceptance**

* Preview shows how info sheet header looks
* Multiple profiles allowed (plans may gate)

---

### 7.4 Seller Form (mobile-first)

**Header**

* “Utility Information for [Address]”
* “This takes about 1–2 minutes.”

**Applicability toggles (top)**

* Water source: City / Well / Not sure
* Sewer: Public / Septic / Not sure
* Heating: Natural gas / Propane / Oil / Electric / Not sure
  (These toggles dynamically hide/disable irrelevant categories, but never block submission.)

**Per-category card**

* Category title (Electric)
* Suggested provider (one primary suggestion + optional “Other likely” dropdown)
* Buttons:

  * Confirm
  * Not this
  * Not sure

If **Not this**:

* Provider name input with autocomplete dropdown
* “I can’t find it” → free-text provider name allowed

**Submit**

* Primary: Submit
* Secondary: Save and finish later (same link)

---

### 7.5 Info Sheet Web Page

**Sections**

* Property address + date generated
* Utility table: category → provider name → contact (phone/link if available)
* Optional: short standardized “Buyer next steps” (static in MVP)
* Branding header/footer

**Controls**

* Download PDF
* Copy share link

---

## 8) Functional requirements

### 8.1 Request lifecycle

* Status transitions:

  * Draft (created, not sent)
  * Sent (seller link shared OR seller contact entered and “send” pressed)
  * In progress (seller opened link)
  * Submitted (seller completed form)
* Audit events:

  * request_created, link_copied, seller_opened, seller_saved, seller_submitted, pdf_generated, pdf_downloaded, reminder_sent

### 8.2 Seller data capture (minimal)

Per category, store:

* provider_entry_mode: suggested_confirmed | search_selected | free_text | unknown | not_applicable
* provider_display_name (as seller sees it)
* provider_canonical_id (if resolved)
* confidence_score at time of suggestion (0–1)
* optional seller notes (MVP: off by default)

### 8.3 Provider Resolution Engine (core)

The engine must support three jobs:

#### A) Suggest providers by address + category

**Input:** address (structured), category
**Output:** ordered list of suggestions:

* display_name
* canonical_hint (optional)
* confidence
* rationale_short (not shown to seller in MVP; useful for debugging)

#### B) Normalize provider names

**Input:** raw provider name text
**Output:** canonical provider record match (or none), with confidence

#### C) Contact resolution (phone/link)

**Input:** canonical provider (or raw name)
**Output:** best-known contacts:

* customer service phone (optional)
* start/stop service URL (optional)
* main website (optional)
* hours (optional)

**Seller never sees errors**—missing contact info becomes a dashboard flag.

### 8.4 “No user-managed database” requirement

* There is no UI for customers to build “regions/providers.”
* System may maintain internal provider records and improve over time using:

  * aggregated confirmations
  * normalization mappings
  * cached contact lookups

This internal intelligence is invisible to end users.

---

## 9) Data model (conceptual)

### Entities

**Account**

* id, email, plan, created_at

**Team** (optional in MVP, but model-ready)

* id, name

**BrandProfile**

* id, account_id/team_id
* name, logo_url
* primary_color, secondary_color
* contact_name, contact_phone, contact_email, contact_website
* disclaimer_text

**Request**

* id, account_id/team_id, brand_profile_id
* property_address_full (string)
* property_address_structured (json)
* seller_name (optional)
* seller_email/phone (optional)
* closing_date (optional)
* status
* created_at, updated_at, last_activity_at
* public_token (unique, unguessable)

**UtilityEntry**

* id, request_id
* category
* provider_entry_mode
* provider_display_name
* provider_raw_text
* provider_canonical_id (nullable)
* suggestion_confidence (nullable)
* contact_phone/url fields (nullable; system-resolved)
* created_at, updated_at

**ProviderCanonical** (system-owned)

* id
* normalized_name
* aliases[]
* contact_phone, contact_urls[]
* metadata (service type flags)
* last_verified_at (system)

**EventLog**

* id, request_id, actor_type (agent/seller/system)
* event_name, payload_json, timestamp

---

## 10) AI / external lookup integration (MVP architecture)

### Requirements

* Must be fast enough that seller flow feels instant.
* Must degrade gracefully:

  * If suggestion service fails → show empty state and allow provider-name input.
* Must cache aggressively to reduce latency and cost.

### Suggested design (implementation-agnostic)

**ProviderSuggestionService**

* `getSuggestions(address_structured, category) -> [suggestions]`
* Cache key: `address_hash + category`
* TTL: e.g., 30 days (tunable)

**ProviderContactService**

* `resolveContact(provider_name_or_id) -> contact`
* Cache key: canonical_id or normalized_name
* TTL: e.g., 90 days

**Critical UX rule:** Suggestions should be available **by the time the seller reaches each card**. Prefetch suggestions for all categories immediately after address loads.

---

## 11) Edge cases and handling

1. **Well/Septic**

* If seller selects Well, hide Water provider card; record `not_applicable`.
* If Not sure, leave Water card visible.

2. **Trash is municipal / multiple choices**

* MVP: allow one provider name, plus optional free-text notes toggle (default hidden).
* V1: multi-select providers.

3. **Ambiguous provider names**

* Autocomplete shows multiple; seller chooses.
* If free text, accept and store raw text; mark contact unresolved.

4. **Seller doesn’t know anything**

* They can mark Not sure across all and submit.
* Dashboard clearly shows unknown categories.

---

## 12) Performance and reliability targets

* Seller page initial load: **< 2 seconds** on 4G typical
* Suggestions prefetch: **< 1.5 seconds** typical (cached), **< 3 seconds** uncached
* PDF generation: **< 10 seconds** typical
* 99.5% uptime (MVP target)

---

## 13) Security, privacy, and compliance

* Public seller link must be unguessable (high-entropy token).
* Optional: allow agent to “lock” link after submission.
* Store minimal PII: address + optional seller contact only if agent enters it.
* No sensitive identifiers (no account numbers).
* Audit logging for access and exports.
* If using third-party AI/search: ensure requests exclude unnecessary PII (send structured locality, not seller identity).

---

## 14) Analytics (MVP)

Track:

* request_created → link_shared → seller_opened → seller_submitted
* time_to_complete
* confirm_rate per category
* “not this” rate
* contact_resolution_success_rate
* top free-text provider names (for system alias improvement)

---

## 15) Acceptance criteria checklist (MVP ship gate)

* Agent can create request, send link, and see status updates.
* Seller can complete in ≤ 2 minutes with no typing when suggestions are correct.
* Seller can submit with unknowns; no bill uploads anywhere.
* Info sheet is generated as web + PDF with branding.
* Contact info auto-fills when resolvable; otherwise flagged for agent/TC.
* System does not require customer-managed provider/region data setup.

---

## 16) MVP milestones (suggested)

1. **Request + seller form (no AI yet)**: manual provider-name entry + info sheet
2. Add **provider-name autocomplete** (system-owned canonical list + aliasing)
3. Add **address-based suggestions** (cached)
4. Add **contact resolution** + dashboard flags
5. Add **reminders + analytics**
