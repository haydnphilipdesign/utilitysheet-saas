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

## Decision

1. The HOA group is a built-in part of **Home Basics**, so it is available on
   the Free plan and in both packet modes. It is not a handoff module and has no
   per-customer opt-out.
2. Answers are stored as nullable columns on `requests`, next to the other Home
   Basics columns: `has_hoa` (`yes` / `no` / `not_sure`), `hoa_name`,
   `hoa_management_company`, `hoa_management_phone`, `hoa_dues_amount`,
   `hoa_portal_or_payment`. Defined in `migrations-hoa-questions.sql` and
   mirrored in `schema.sql`.
3. `has_hoa` NULL means the question was never asked (every request that
   predates the migration). It is not the same as `not_sure` and must not be
   rendered as an answer.
4. The detail columns are meaningful only when `has_hoa = 'yes'`. Application
   code clears them otherwise. This is enforced in the application, not by a
   cross-column database constraint, matching how `requests` is validated today
   (Zod owns lengths and conditional rules).
5. `has_hoa` (membership) and the `hoa` value on `water_source` / `sewer_type`
   (billing) are independent. Neither is derived from the other.

## Rationale

- HOA status generalizes to every US market and is closing-relevant on a plain
  utility sheet, which is the test for a built-in question.
- The person who asked was on the Simple sheet. A Pro-only module might not have
  reached her.
- Home Basics answers already live in `requests` columns, so this follows the
  existing storage shape and both packet surfaces can render it through the
  shared `getHomeBasicsRows` path.

## Alternatives Considered

- **Sixth handoff module (Option B).** No migration and it inherits the module
  exclusions model, but it is Pro/Teams and handoff-mode only. Rejected.
- **Store in `requests.advanced_packet_data`.** No migration, but that column is
  named for advanced packets, filtered through advanced exclusions, and read only
  when `mode === 'advanced'`. Rejected as a misnamed second storage path for Home
  Basics.
- **A general custom-question builder.** Not reopened by this. The standing
  verdict in
  `docs/product-feedback/2026-09-03-michelle-wright-opus-evaluation.md` (Idea 2)
  is unchanged.

## Consequences

- Every seller on every request sees one extra gate question. The five detail
  questions must stay behind a Yes.
- The migration must be applied before any code that reads or writes these
  columns is deployed. It is additive and nullable, so it is safe under the
  previously deployed code. It was applied to production on 2026-10-01 with
  owner authorization; see the plan, section 11.
- Any surface that lists `requests` columns explicitly (for example the account
  data export in `lib/neon/queries/account-data.ts`) does not pick the new
  columns up automatically.
- `hoa_portal_or_payment` is free text on a public, token-addressed form. Its
  helper text must warn against passwords and account numbers.
