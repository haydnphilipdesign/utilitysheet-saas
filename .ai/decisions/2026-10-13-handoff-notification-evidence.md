# Email handoff and PDF execution evidence live in two slot-based tables

- Date: 2026-10-13. Status: adopted for local Slice 6; migration not run, deployment unverified.
- Related plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context

The completion email and the seller invitation produced only a coarse
"send failed" incident or nothing at all. The provider message ID was
discarded, so the signed delivery webhook could only ever match seller
reminders. A returned (not thrown) refusal of the invitation was ignored. A
PDF failure was one undifferentiated incident with no request, stage,
duration or size, and a thrown send reported the attachment as failed even
when the PDF had been produced.

## Decision

Add `notification_observations` and `pdf_render_observations`
(`migrations-handoff-evidence.sql`, mirrored in `schema.sql`). Contract:
`lib/telemetry/handoff-evidence.ts`. Storage and readers:
`lib/neon/queries/handoff-evidence.ts`.

- **One row per recipient slot.** A handoff attempt gets one random
  `operation_id`; each recipient is a position (0, 1, ...) in the order
  attempted. No email address, name, property address, link, filename, subject
  or body is stored. Operational delivery still uses the real recipients; they
  are never copied into evidence.
- **Three send outcomes plus one.** `accepted` (the provider took it),
  `failed` (it refused, or no provider key), `unknown` (no provider response,
  so it may or may not have been sent) and `no_recipients` (nobody eligible,
  nothing attempted). Attachment status is a separate fact on the same row.
- **Purposes are a closed list:** `completion_notification` and
  `request_invitation`. Live and seller-test sends are marked and read apart.
- **Reminders keep their own contract.** `reminder_operations` and
  `applyEmailDeliveryEvent` are unchanged. The webhook asks reminders first and
  only then notification evidence. Delivery status is monotonic in both.
- **PDF evidence comes from the renderer**, after the caller's id or link has
  resolved to a request: packet mode, render and launch strategy, stage
  reached, total/data/launch/render milliseconds and byte size. It is stored
  for downloads and completion attachments.
- **Writes are auxiliary.** One statement through `writeAuxiliary` (one
  attempt, 500 ms). A failed or slow write changes no send, download or
  submission.
- **Bounded per request:** 200 notification rows and 300 PDF rows, after which
  nothing more is stored for that request. Rows are deleted with the request.

## Rationale and alternatives

- **Not `event_logs`.** Webhook matching needs an indexed provider message ID
  and an updatable delivery status, and Seller Progress classifies
  `event_logs` rows as seller or operator activity.
- **Not `reminder_operations`.** That table is an idempotency and audit record
  holding the recipient address and a payload fingerprint. Widening it would
  weaken a contract that prevents duplicate reminders.
- **Not extra `operational_events` metadata.** Those rows are sampled on
  success and grouped as incidents; per-execution duration and size need a row
  per execution.
- **Nothing stored before a request is resolved.** An unknown link, a
  rate-limited request and a lookup that failed before resolving store no
  row. Otherwise random links would turn into unbounded writes. They remain
  visible as HTTP statuses in hosting logs, and a lookup failure is still an
  incident.
- **No retry, no shared render.** One PDF is still produced per recipient who
  wants the attachment. Sharing it is a possible later optimization.

## Consequences

- Accepted is not delivered, and delivered is not read. Admin copy says so
  beside the figures.
- Evidence is best effort. A missing row means unknown, not failure. Nothing
  exists for sends before deployment; there is no backfill.
- A delivery callback that arrives when its observation row was never stored
  matches nothing and is acknowledged as untracked.
- Until the migration is applied, writers log one redacted marker, readers say
  "not installed", and the webhook acknowledges unmatched events instead of
  asking the provider to retry.
- New incident fingerprints: `email:invitation_send_failed`, and
  `email:{completion,invitation}_{bounced,complained,undelivered}` for live
  messages. The PDF incident now carries the request and a stage reason
  (`data_failed`, `browser_launch_failed`, ...).
- These tables have no time-based pruning yet. Growth is bounded per request
  and ends with the request; a retention window belongs to Slice 9.
- Adding a purpose, outcome or stage requires changing the shared contract,
  the table checks and the readers together.
- Registering the webhook, running the migration and any production setting
  remain separate, owner-approved steps.
