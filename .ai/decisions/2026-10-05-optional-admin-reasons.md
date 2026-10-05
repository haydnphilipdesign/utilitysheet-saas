# Admin Reasons Are Optional for Writes That Touch No Customer Record

Date: 2026-10-05. Status: Accepted (owner decision; implemented and pushed to `origin/main` on 2026-10-05).

## Context

Every Admin write required a typed reason of at least 3 characters. The product is run by one person, who is both the operator and the only reviewer. For routine work on their own content (publishing a Product Update, marking feedback reviewed, acknowledging an Operations item) the reason was friction with nobody to read it. `ADMIN.md` previously stated there was "no reason-policy exception for Product Update writes"; this record supersedes that sentence.

## Decision

1. **The reason is optional** for Product Update draft creation, publication and deletion, Operations triage, and feedback status changes. Schema: `adminOptionalReasonSchema` in `lib/validation/admin-schemas.ts`.
2. **The reason stays required** for writes that change a customer's account, access, request or seller contact, or that send email: role and ban changes, entitlement overrides, request status and seller contact corrections, seller reminders, signup reconciliation and testimonial outreach.
3. **Audit logging is unchanged.** Every one of these writes still commits with its audit entry (who, what, when, before and after). When a reason is given it is stored; when it is not, the `reason` key is absent.
4. **Confirmation is unchanged.** Publishing or deleting a Product Update still needs the reviewed-preview checkbox, because publication is customer-visible and deletion is permanent.

## Rationale

The reason field exists so a later reader can tell why a customer-affecting change was made. That still matters for item 2, including for a solo operator answering a customer or a billing dispute months later. It has no comparable value for the operator's own content and queue.

## Consequences

- Audit log rows for these actions may show no reason. The Audit Logs view already treats the reason as nullable.
- `WriteContext.reason` in `lib/neon/queries/admin-writes.ts` is `string | null`. The customer-affecting writes still receive a validated non-empty string from their schemas.
- If a second operator is added, revisit this: reasons become useful again once someone else reads the log.
- Extending the optional rule to the customer-affecting writes is a separate decision and has not been made.
