# HOA Questions Live in Home Basics, Stored as Request Columns

- Status: Accepted
- Date: 2026-10-01
- Decision owner: Product owner, recorded by Claude Code
- Related plan: `.ai/plans/2026-09-19-hoa-question-group.md`
- Background: `docs/product-feedback/2026-09-19-alisha-starkey-hoa-feedback.md`

## Context

Customers asked for "Is this property in an HOA?" as a seller question. The
product had no such question; its only `hoa` value is the water/sewer option
meaning the association bills that utility. Two placements were possible: Home
Basics (asked on every form, both packet modes, every plan) or a sixth handoff
module (Pro/Teams, handoff mode only).

The customer who prompted it then supplied the Oregon association addendum her
answers feed, and asked for the seller's portal login and the association
documents as well.

## Decision

1. The HOA group is a built-in part of **Home Basics**, so it is available on
   the Free plan and in both packet modes. It is not a handoff module.
   **Amended 2026-10-01 (same day, after release):** an account can turn the
   whole group off. See item 9. The original decision had no opt-out.
2. Answers are stored as nullable columns on `requests`, next to the other Home
   Basics columns: `has_hoa` (`yes` / `no` / `not_sure`), `hoa_name`,
   `hoa_management_company`, `hoa_management_contact`, `hoa_management_phone`,
   `hoa_management_email`, `hoa_dues_amount`, `hoa_dues_frequency`
   (`monthly` / `quarterly` / `yearly`), and `hoa_portal_or_payment`. Defined in
   `migrations-hoa-questions.sql` and mirrored in `schema.sql`. The questions,
   labels, and limits are declared once in `lib/packet/hoa.ts`.
3. `has_hoa` NULL means the question was never answered (every request that
   predates the migration, and any seller who skips it). It is not the same as
   `not_sure` and is not rendered as an answer.
4. The detail columns are meaningful only when `has_hoa = 'yes'`. The detail
   questions are shown only after a Yes, and `normalizeHoaAnswers` clears them
   on every write otherwise. This is enforced in the application, not by a
   cross-column database constraint, matching how `requests` is validated today
   (Zod owns lengths and conditional rules).
5. `has_hoa` (membership) and the `hoa` value on `water_source` / `sewer_type`
   (billing) are independent. Neither is derived from the other.
6. The packet prints all three answers. "Yes" with details, "No", and "Not Sure"
   each appear on Home Basics; the details print as their own section in both
   packet modes.
7. Only the `has_hoa` answer enters the redacted `seller_submitted` event
   summary. The free-text details never do.
8. **Portal passwords are not collected.** The seller form and the editor both
   warn against entering passwords or account numbers. Association document
   upload is not part of this group. Both are deferred, with implementation
   notes in `docs/product-feedback/2026-10-01-hoa-deferred-capabilities.md`.
9. **One on/off setting, free on every plan.** "Ask about HOA or condo
   association" under Settings, Seller Form, stored as `collect_hoa_questions`
   in `accounts.notification_preferences`, on unless explicitly false.
   - It is **not** a paid capability. The owner decided this on 2026-10-01.
   - It controls **asking only**. Off hides the question from the seller form
     and its review step, and the server writes no HOA answers. Answers already
     collected keep printing on the packet and stay editable. Turning it off
     deletes nothing.
   - It is read live from the request owner's account, like the meter-number
     switch beside it, so it also applies to links already sent, and in a Team
     workspace each member's requests follow that member's own setting.
   - There is no per-field control. The group is on or off as a whole.

## Rationale

- HOA status generalizes to every US market and is closing-relevant on a plain
  utility sheet, which is the test for a built-in question.
- The person who asked was on the Simple sheet. A Pro-only module might not have
  reached her.
- Home Basics answers already live in `requests` columns, so this follows the
  existing storage shape and both packet surfaces render it through shared
  helpers.
- Contact name, contact email, and a structured dues period complete the
  general-information lines of the association addendum a coordinator fills in
  from these answers.
- A seller who is not sure whether there is an association cannot name its
  manager, so the details sit behind Yes only.
- A portal login is the seller's personal account credential. The buyer never
  needs it, and Home Basics prints on the buyer-facing packet with no per-field
  exclusion. This differs from the garage code accepted on 2026-07-30, which the
  buyer does need.

## Alternatives Considered

- **Sixth handoff module (Option B).** No migration and it inherits the module
  exclusions model, but it is Pro/Teams and handoff-mode only. Rejected.
- **Store in `requests.advanced_packet_data`.** No migration, but that column is
  named for advanced packets, filtered through advanced exclusions, and read only
  when `mode === 'advanced'`. Rejected as a misnamed second storage path for Home
  Basics.
- **One free-text dues field** ("$240 quarterly"). Replaced by an amount plus a
  period choice, which is one tap for the seller and maps onto the addendum's
  checkbox.
- **Collect the portal login.** Deferred, not rejected outright. A safe version
  needs a coordinator-only answer that never reaches the packet, which does not
  exist yet.
- **Making "off" a Pro / Teams capability.** Rejected. The meter-number switch
  and the utility-category checkboxes in the same panel are free; paid plans add
  capabilities (the handoff packet, per-question controls, a custom URL).
  Charging to remove a question that was just added to every Free form would
  read as taking something away to sell it back. Per-field control of the detail
  questions remains a plausible Pro capability later.
- **A general custom-question builder.** Not built and not justified by this
  feedback. The owner has since asked for it to be evaluated on its own merits;
  see `.ai/plans/2026-10-01-custom-questions-evaluation.md`. Until that produces
  a decision, the verdict in
  `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` (Idea 2)
  stands.

## Consequences

Amended 2026-10-02: individual creation now saves request-specific HOA and
meter choices; those override live account preferences. Existing and reusable
requests still inherit when overrides are absent. The live-setting and
not-copied statements below describe the original implementation; see
`2026-10-02-request-question-overrides.md` for the current precedence rule.

- Unless the account turns it off, every seller on every request sees one extra
  gate question. A No or Not Sure costs one tap. The detail questions must stay
  behind a Yes.
- The setting is not copied onto the request. Anything that needs to know
  whether a request "asked" the HOA question later cannot read it from the
  request row; only a stored answer proves it was asked.
- The migration was applied to production on 2026-10-01 with owner
  authorization, before the application code shipped; see the plan, section 11.
- A seller form or editor tab loaded before the release sends no HOA keys. Both
  write paths treat that as "leave the stored answers alone".
- Earlier HOA answers are returned to the seller form to prefill a
  resubmission. Anything added to this group later is therefore echoed back to
  whoever holds the seller link. A secret must not be added to it.
- Any surface that lists `requests` columns explicitly (for example the account
  data export in `lib/neon/queries/account-data.ts`) does not pick new columns
  up automatically.
- `hoa_portal_or_payment` is free text on a public, token-addressed form that
  prints on the buyer's packet. Its warning text is a real mitigation and is
  covered by tests.
