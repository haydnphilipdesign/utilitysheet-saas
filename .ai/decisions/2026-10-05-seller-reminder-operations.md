# Seller Reminders Are Durable Operations With a Shared Claim and Cooldown

Date: 2026-10-05. Status: Accepted (implemented locally under the Admin operational-readiness plan; not yet released).

## Context

Admin reminders had no cooldown, accepted deleted and submitted requests, sent without a provider idempotency key and wrote audit evidence only after sending. The customer endpoint had a 10 minute cooldown based on reading `event_logs` and then sending, which two simultaneous calls could both pass. A database transaction cannot roll back an email, so "send then log" could not be made safe by transactions alone.

## Decision

1. **One renderer.** `buildSellerReminderEmail` in `lib/email/email-service.ts` produces the exact subject, HTML, sender and reply-to. The Admin preview and every send use it. `sendSellerReminderEmail` (seller return-link and branding test email) keeps its behaviour and sends without an idempotency key.
2. **One durable operation per logical reminder** in `reminder_operations` (`migrations-reminder-operations.sql`): operation ID, request, actor, reason, recipient, SHA-256 payload fingerprint, state (`pending`, `accepted`, `failed`, `unknown`), provider message ID. It never stores capability tokens or rendered bodies.
3. **One shared claim for Admin and customer paths.** The claim runs as `[advisory lock per request, expire abandoned claims, claim statement]` in one non-interactive transaction. A partial unique index allows only one `pending` row per request as a database backstop.
4. **Cooldown stays 10 minutes** and is measured from the latest `reminder_sent` event, so reminders recorded before this table are honoured. There is no override.
5. **Order of effects:** commit the claim and the Admin attempt audit, call the provider with idempotency key `seller-reminder/<operationId>` outside any transaction, then finalize the accepted state, the single `reminder_sent` event and the Admin audit in one statement.
6. **Outcomes are distinct.**
   - Provider accepted: `accepted`. This is acceptance, not delivery.
   - Definitive rejection (validation, configuration, quota, rate limit): `failed`. No cooldown. A new reviewed operation is allowed.
   - Timeout, network failure, provider fault, or a key reused with a different payload: `unknown`. Fresh sends are blocked.
   - Accepted but the local record failed: the operation stays `pending`. Retrying the same operation reuses the key and only completes the record.
   - A `pending` claim older than 15 minutes is treated as `unknown`.
7. **Retry window.** Resend keeps idempotency keys for 24 hours (verified against its documentation on 2026-10-05). The same operation may be retried for 23 hours, only with an identical fingerprint. After that, or if the recipient or content changed, it cannot be retried and must be settled by an operator.
8. **Unknown outcomes block fresh sends for 24 hours**, then stop blocking, because nothing can deduplicate them any more and blocking a customer forever is worse than a possible duplicate a day later. Admin can settle one earlier as sent or not sent after checking the provider; both are audited.
9. **Eligibility.** Admin reminders require a non-deleted, unsubmitted, unmetered request with a valid seller email and an owner who is not banned or closing. Drafts remain eligible. The customer endpoint keeps its previous eligibility (any non-deleted request it is authorized for), its rate limiting and its response contract for success and cooldown.
10. **Missing table fails closed.** If the migration has not run, no reminder is sent and the caller gets a temporary-unavailable response.

## Alternatives rejected

- **Process-memory locks or rate limiter only.** Not durable across instances.
- **Unique index alone, no advisory lock.** A waiting statement would decide on a snapshot taken before the other claim committed.
- **Automatic resend after a timeout.** Risks duplicates to a seller.
- **Store the rendered body for exact replay.** It contains the seller capability link.
- **Apply Admin eligibility to the customer endpoint.** A behaviour change outside this task.

## Consequences

- The migration must be applied before the application code is deployed.
- The Admin reminder now names the owning account (or its Branding Profile contact) as the agent, not the Admin who clicked.
- The customer endpoint returns generic errors instead of raw provider messages, and new 409/502 codes for in-flight and unknown outcomes.
- Customer reminders on already-submitted requests remain possible. That is pre-existing behaviour, noted as a product follow-up.
- Phase 4 adds provider delivery evidence to `reminder_operations.delivery_status`; historical reminders remain unknown.

## Amendment: customer reminders on submitted requests (2026-10-06)

Item 9 said the customer endpoint keeps its previous eligibility, which included submitted requests. It now refuses a submitted request with a 409, because the seller has nothing left to do. A request a coordinator has reopened is in progress and can be reminded by the coordinator. Admin eligibility is unchanged, so Admin reminders still refuse any metered request, including a reopened one (superseded for reopened requests by the next amendment). See `2026-10-06-read-only-after-submission-and-reopen.md`.

## Amendment: Admin reminders on reopened requests (2026-10-06)

Owner decision. Admin may remind a request that a coordinator reopened for the seller: `status = 'in_progress'`, `metered_at` set and `seller_edit_version > 0`. Every other Admin rule is unchanged (reason, confirmation, reviewed preview, shared cooldown, owner standing). A request with a recorded submission that is in progress without a reopen (for example after a status correction) is still refused, and so is any submitted request. The rule is applied in both `prepareSellerReminder` and the claim statement. The reminder wording is not changed for reopened requests; the operator sees the exact text in the preview. Rejected: allowing any in-progress request regardless of `metered_at`, and a separate reopen reminder template.
