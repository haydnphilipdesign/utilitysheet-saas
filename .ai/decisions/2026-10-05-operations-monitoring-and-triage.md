# Operational Observations, Quiet Alerts and Triage Are Small, Best-Effort and Separate From Customer State

Date: 2026-10-05. Status: Accepted (implemented locally under the Admin operational-readiness plan; not yet released or activated).

## Context

The Admin had no place to see email, PDF, billing-webhook or scheduled-job failures, and the overview's "Needs attention" chips mixed cumulative customer inactivity with anything urgent. The owner needs to see real failures, be told quietly when something breaks, and stop re-investigating the same records, without a ticketing product, an analytics warehouse or new provider spend.

## Decision

### Observations

1. **Three small tables** (`migrations-operational-events.sql`): `operational_events` (email, PDF, billing webhook), `job_runs` (scheduled jobs), `ops_alert_state` (notification state). AI outcomes stay in existing Telemetry and are linked, not duplicated.
2. **Best-effort writers** (`lib/ops/events.ts`). They never throw into a seller submission, packet download or billing webhook; on failure they emit a redacted structured log line. This is telemetry. Admin audit evidence is separate, atomic and authoritative.
3. **Allowlisted metadata only.** A fixed set of keys with short scalar values. No URLs, tokens, seller answers, email bodies, provider payloads, raw exception text or contact fields are stored or displayed. Request and account references become NULL when the customer record is deleted, so history never blocks account closure.
4. **Incidents are grouped by a stable fingerprint** at query time. Provider redeliveries are deduplicated by provider event identity (Stripe event ID, webhook message ID) and bump an attempt counter instead of adding rows.
5. **Expected outcomes are not incidents.** Invalid packet tokens, locked packets, rate limits and unverified webhook signatures are never recorded as service failures.
6. **Success is sampled** (at most one row per fingerprint per 15 minutes) or recorded when it recovers a specific failed provider event. "Last success" is therefore approximate and labelled as sampled.
7. **Honest states.** Every section distinguishes not installed (migration pending), could not load, no observations yet, stale, and zero failures.
8. **Only the three scheduled jobs are monitored.** A job with no observed runs is "not observed", never overdue. Overdue means more than 26 hours without success after monitoring has watched the job for at least that long. The unscheduled weekly summary is never reported overdue.

### Email delivery

9. **Resend webhook** (`app/api/webhooks/resend/route.ts`) verifies the signature on the raw body with the Resend SDK before reading anything. Only the event type and provider message ID are used.
10. **Correlation is limited to messages whose provider ID was stored**, which today means seller reminders. Unmatched events store nothing. Historical and untracked email stays "unknown".
11. **Delivery status only moves to a more significant fact** (delayed, delivered, failed, bounced, complained). A late "delivered" cannot erase a bounce or complaint. Each distinct event is kept once.
12. A failed durable write returns a retryable status so the provider redelivers.

### Alerts

13. **Disabled by default.** Sending requires both `OPS_ALERTS_ENABLED=true` and a valid `OPS_ALERT_EMAIL`. Evaluation runs only from `/api/cron/ops-monitor`, which has no schedule in `vercel.json`.
14. **One message when a condition starts and one when it recovers.** No repeats while unchanged. State advances only after a successful send.
15. **Alerts carry counts and an Admin link only.** No seller or customer data.
16. **Database and site outages are out of scope for in-app alerts** because they depend on the same database. An external uptime probe is required and is documented, not provisioned.

### Retention

17. Transient observations default to 90 days (`OPS_EVENT_RETENTION_DAYS`). Pruning requires `OPS_RETENTION_PRUNE_ENABLED=true` and the monitor route being scheduled. `admin_audit_logs` and `reminder_operations` are never pruned by it.

### Triage

18. **One table** (`migrations-admin-triage.sql`) keyed by a stable source key, holding state (`open`, `acknowledged`, `snoozed`, `resolved`), snooze time, a private plain-text note (maximum 1,000 characters), actor and a version number.
19. **Triage never changes the source.** Raw backlog counts, request status, analytics and customer records are untouched, and it never sends a message.
20. **Service issues and customer follow-up are separate lists.** Inactivity is a follow-up candidate, not an incident.
21. **Writes are atomic with audit and use the version number** for optimistic concurrency. Notes are not copied into audit evidence.
22. **Effective state is computed on read.** An expired snooze returns to the queue. A failure after resolution reopens the item. An unchanged resolved follow-up stays dismissed.
23. **Resolving is not recovery.** Whether a later success was observed is shown separately from triage state.

## Alternatives rejected

- **Third-party error tracking or a paid uptime product.** Possibly right later; this task must not provision spend or new vendors.
- **A persisted incident table with lifecycle.** Query-time grouping is enough at this volume and cannot drift from the events.
- **Recording every success.** A write on every packet download for little value.
- **Storing provider payloads or exception messages for debugging.** They carry personal data and tokens.
- **Assignments, priorities, attachments or external ticket sync.** Out of scope for one operator.
- **Letting triage hide items from backlog counts.** It would make the numbers untrustworthy.

## Consequences

- New instrumentation points must use the allowlist and add a redaction test.
- Completion and other transactional email have no delivery evidence until their provider IDs are stored. That is a deliberate limit, stated on the page.
- PDF failures are not linked to a request, because the route only has the capability token and must not store it.
- Activation needs separate owner approval: registering the webhook, setting the alert destination, scheduling the monitor route, enabling pruning, and configuring an external probe. See `docs/admin-operations-runbook.md`.
- Triage rows for sources that no longer exist are simply never shown. They are small and are not cleaned up automatically.
