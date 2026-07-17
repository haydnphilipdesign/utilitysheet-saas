# Decision Records

Use this directory only for durable architecture or product decisions when future contributors or agents will benefit from understanding why the choice was made.

Examples include architectural boundaries, technology or provider selections, data-model conventions, authentication or authorization approaches, long-term API behavior, durable product behavior, and rejected alternatives likely to be reconsidered.

Do not use it for ordinary session notes, debugging logs, temporary implementation details, routine refactors, chat transcripts, every file/function change, or ordinary task progress.

When a durable decision is made, the responsible agent must:

1. Create a new record or update the existing record for that decision.
2. Record the context, decision, rationale, alternatives when relevant, and consequences.
3. Link or reference the record from the active plan when relevant.
4. Mention the decision record in `.ai/CURRENT.md`.

Decision records should remain honest history. Supersede or amend them explicitly rather than silently rewriting a past decision to look current.

Recommended filename:

```text
YYYY-MM-DD-short-decision-name.md
```

## Template

```md
# Decision: Title

## Status

Proposed | Accepted | Superseded | Rejected

## Context

## Decision

## Rationale

## Alternatives Considered

## Consequences

## Related Files, Plans, Issues, or Pull Requests
```
