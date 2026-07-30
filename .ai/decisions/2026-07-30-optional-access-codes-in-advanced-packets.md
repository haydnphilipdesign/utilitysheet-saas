# Decision: Allow Optional Garage Access Codes in Advanced Packets

## Status

Accepted

## Context

Customer feedback requested a Garage Door Code question in the Advanced Utility
Packet. Completed packets are shared through capability links and PDFs. Access
codes are sensitive, but the product owner considers these documents privately
shared closing handoffs and explicitly accepted including the field.

## Decision

UtilitySheet will offer an optional `garage_door_code` question in the
`mailbox_access` Advanced module. It is included by default when that module is
enabled and can be removed independently through the existing per-question
controls.

The field is optional and uses the existing bounded-text validation, packet
storage, web display, PDF display, and submitted-sheet editing paths. The
product will not introduce a blocking warning or separate secret-storage
mechanism in this change.

## Rationale

- Garage access is a practical closing-handoff detail requested by a paying
  workflow user.
- The existing packet already carries property-specific access and security
  information.
- Per-question controls let customers omit the field when it is inappropriate.
- A separate encrypted or expiring-secret workflow would add substantial scope
  beyond the requested packet behavior.

## Alternatives

- Exclude access codes and collect only keys/remotes location: rejected by the
  product owner for this workflow.
- Add a separate encrypted secret exchange: deferred because it is not required
  for the current product use case.
- Use a general notes field: rejected because a dedicated question is easier
  for sellers to notice and for recipients to scan.

## Consequences

- Anyone with the private packet link or PDF may see a supplied garage code.
- Customers can remove the question from their defaults or an individual
  request.
- Future changes to packet-link access controls should account for the
  possibility of optional access-code content.

## Related Files, Plans, Issues, or Pull Requests

- `.ai/plans/2026-07-30-advanced-packet-requested-fields.md`
- `lib/packet/modules.ts`
- `components/seller-form/steps/AdvancedDetailsStep.tsx`
