# Auxiliary observations have a bounded awaited write

- Date: 2026-10-13. Status: adopted for local Slice 3; deployment unverified.
- Related plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context

Creation/intake/open/self-link event inserts could reject after primary mutations
or accepted email and return 500; intake lost its resume cookie. AI/ops caught
write failures but had no wait budget; suggestion events were detached.

## Decision

Explicitly opt auxiliary events into `auxiliaryEventWriter`. Keep `createEventLog`
strict. Event, AI run/selection, operational event/success and job start/finish
observations use `writeAuxiliary`: one awaited attempt, 500 ms per operation,
AbortController passed through Neon `fetchOptions.signal`, and a deadline guard
that also bounds local waiting if a sink fails to honor abort. Emit one fixed
`auxiliary_write_failed` diagnostic with finite observation/reason and allowlisted
exception context. Do not copy SQL, messages, provider codes, tokens or payloads.

Neon 1.0.2 installed source/types and [official driver documentation](https://neon.com/docs/serverless/serverless-driver)
confirm HTTP fetch and per-query fetch options. Tests use the installed driver
with intercepted synthetic HTTP; no hosted lifecycle assumption is needed.

Required submission/metering and sheet-edit evidence, Admin audits, reminder
intent/finalization, signed delivery application and retry behavior, billing
writes and retention deletes stay strict and outside this helper. The optional
StatementExecutor signal affects only callers that explicitly provide it.

## Rationale and alternatives

Small observation writes do not warrant a queue/outbox. A detached promise can
lose work when a serverless invocation ends. A deadline race alone leaves HTTP
running; coupling it to fetch abort cancels the actual transport. A separate
SQL session/statement-timeout deployment setting is unnecessary for the bounded
local wait contract and would expand infrastructure scope. 500 ms is a fixed
latency allowance, not a measured production persistence guarantee.

## Consequences

- Missing observations are tolerated; absence is unknown evidence, not failure
  of the underlying action. New diagnostics help identify degraded collection.
- HTTP abort is not proof of PostgreSQL rollback. A row can commit even when
  the caller receives its fallback. Never automatically retry an observation.
- The budget is per observation, not per endpoint. Multiple observations add
  bounded waits; primary reads, mutation, provider/email/cache calls have their
  existing budgets and failure contracts.
- AI run/items share one deadline but remain separate statements; partial rows
  remain possible. Run/item atomicity/lineage belongs to Slice 8.
- A timed-out job start can leave a running row without a returned handle;
  a timed-out finish can leave stale evidence. This is a coverage limitation,
  not proof a job is stuck. Late results cannot mutate the returned null handle.
- Collection policies and historical data are unchanged. No deployment/config,
  schema, dependency or production data action is authorized by this decision.
