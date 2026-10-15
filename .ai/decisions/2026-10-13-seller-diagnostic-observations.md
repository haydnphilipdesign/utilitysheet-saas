# Seller diagnostic observations are a bounded, advisory browser contract

- Date: 2026-10-13. Status: adopted for local Slice 5; deployment unverified.
- Related plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context

Seller Progress could only infer where a seller stopped from endpoint access
(`seller_opened`, suggestion fetches). Browser step events went to Vercel with
no request or session join key, and the original failed submission was visible
only as a browser console message unless the seller clicked Retry.

## Decision

Add `POST /api/seller/[token]/observations` and six `event_logs` event types:
`seller_step_viewed`, `seller_step_completed`, `seller_submission_attempted`,
`seller_submission_failed`, `seller_suggestions_rendered`,
`seller_suggestions_failed`. The contract (schema version 1) lives in
`lib/telemetry/seller-observations.ts` and `sellerObservationBodySchema`.

- **Payload:** strict objects of finite enums, bounded integers and random
  identifiers only. No address, answer, provider/seller text, search query,
  URL, raw error or response body can be expressed. Unknown keys are rejected.
- **Server-resolved identity:** the seller link authorizes the write with the
  same read/write boundary as the other seller routes (a packet link gets
  404). Request, test/live mode and device/browser family are resolved on
  the server. The link, IP address and User-Agent header are not stored.
- **Storage:** existing `event_logs`, no migration. One statement skips event
  ids already stored for the request and stores nothing past 600 diagnostic
  rows per request. It runs through `writeAuxiliary` (one attempt, 500 ms).
- **Abuse bounds:** a separate 60 per 60 seconds limiter on hashed token + IP,
  required in production; an 8 KB body; 10 events per batch; 150 per browser
  tab session.
- **Browser:** `lib/telemetry/seller-observer.ts` never throws into, and is
  never awaited by, the wizard. It batches, reuses event ids on resend, holds
  events while offline, pauses after repeated failures and stops on a refusal.
- **Reading:** Seller Progress counts each in-progress request once, at the
  last step viewed in the tab session heard from most recently, ordered by
  that session's sequence. Only rows for the request's current editing session
  count. Values outside the contract are dropped at read time as well.

## Rationale and alternatives

- **No dedicated table or unique index.** Volume is a few dozen rows per
  request and readers never count rows, so insert-time `NOT EXISTS` plus
  read-time "one per request" is sufficient and needs no schema change.
  Simultaneous identical batches can still both insert. Revisit with a
  focused migration only if a reader ever needs exact row counts.
- **Not the seller GET.** Recording steps on page fetch would again confuse
  fetches with views.
- **Not Vercel custom events.** They are aggregate and have no request key.
  The existing browser events stay as they are; do not add the two together.
- **Client edit version, bounded by the server.** A body claiming an editing
  session the request has not reached is ignored; a stale tab from before a
  reopen is stored but not counted.

## Consequences

- Evidence is advisory. It can be missing (blocked, offline, closed tab, write
  deadline) or forged by anyone holding the seller link. A request with no
  report is unknown, not stuck. Admin copy states coverage beside every figure.
- A link holder can fill a request's 600-row ceiling and suppress later
  reports for that request. Nothing else is affected.
- The tab session id is a pseudonymous random value in `sessionStorage`. It is
  not identity, does not cross devices and must not be joined to other data.
- Accepted submissions remain the atomic, metered `seller_submitted` evidence.
  Browser attempts and failures never count as completion.
- New fields or event types require a contract change in the shared module,
  the Zod schema and the reader allowlists together.
- The account export lists event types and times, so these types appear there
  without payloads. Rows are deleted with their request as before.
- No retention, schema, dependency, deployment setting or production data
  change is authorized by this decision.

## Approved Slice 8 amendment (2026-10-14)

Owner-approved A-E in `2026-10-14-ai-exposure-lineage.md` extends this policy: v2 optional opaque IDs with strict v1 compatibility, server-validated advisory memberships and immutable accepted choices; distinct generation/consumer/ack/choice denominators and first/reopen cohorts; explicit aiExposures/aiChoices 365-day independent retention rules with request CASCADE and origin SET NULL. Browser acknowledgment remains solely in existing 90-day events. One 500 ms consumer budget includes shared persistence and its exposure, no replay/detached writes. Legacy/expired/unrecorded evidence remains unknown. This authorizes local implementation only, not live execution or release.
