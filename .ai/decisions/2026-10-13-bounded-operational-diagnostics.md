# Bounded operational diagnostics

- Date: 2026-10-13. Status: accepted for local Slice 2 implementation.
- Plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context and decision

AI table redaction did not cover console logs. Provider exceptions/JSON parse
errors, SQL failures, attachment filenames, email redirect recipients and
provider/locality free text could duplicate sensitive business data in logs.
Intake creation events also copied full addresses and link slugs.

Affected producers use `lib/telemetry/diagnostics.ts`: fixed event codes,
reconstructed flat properties, finite enums, bounded nonnegative numbers and
internal UUID request IDs only. Error names use a finite class allowlist;
numeric HTTP statuses supply coarse response families. Never serialize exceptions,
messages, stacks, causes, request URLs or arbitrary provider/correlation strings.
Names and status families are evidence of class/response, not root-cause diagnoses.
Logger/sink failure cannot affect the primary action.

New intake event data retains fixed actor/source, normalized configuration and
canonicalization/street-number flags. Property addresses remain in business
records and resume cookies; link provenance remains on the request. Existing
event envelope IP/user-agent behavior is unchanged and separately scoped.

## Rationale, alternatives and consequences

Finite reconstruction avoids fragile regex redaction of arbitrary free text.
Raw exception capture or a new vendor would add sensitive copies and is not
needed for these verified sites. Keep delivered filenames/content and service
return contracts unchanged; remove their diagnostic copies instead. Reminder
message IDs, delivery evidence, auditing, transaction boundaries and failure
semantics remain unchanged.

Logs lose provider-specific text and identifiers; use approved synthetic
reproductions or separately authorized provider-dashboard access when needed.
The boundary is explicitly scoped: remaining raw sites are inventoried in
`../../docs/telemetry-privacy.md`. Historical rows/logs are untouched; retention,
external configuration and cleanup require separate authorization.
