# Decision Records

Use this directory only for durable decisions whose rationale future
contributors or agents need to understand. Examples include architecture or
module boundaries, technology or provider choices, data-model conventions,
authentication or authorization approaches, long-term API or integration
behavior, security policy, durable product behavior, and rejected alternatives
likely to be reconsidered.

Do not use decision records for ordinary progress, routine refactors, minor
implementation details, temporary debugging choices, transcripts, or every
file and function change.

When a durable decision is made:

1. Create or update the relevant record.
2. Record context, decision, rationale, alternatives, and consequences.
3. Link it from the active plan when relevant.
4. Mention it in `CURRENT.md`.
5. Amend or supersede earlier decisions explicitly rather than silently
   rewriting history.

Recommended filename:

`YYYY-MM-DD-short-decision-name.md`

Accepted statuses:

- Proposed
- Accepted
- Superseded
- Rejected

## Template

````md
# Decision: Title

## Status

Proposed

## Context

## Decision

## Rationale

## Alternatives Considered

## Consequences

## Related Files, Plans, Issues, or Pull Requests
````
