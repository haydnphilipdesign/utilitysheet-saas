# Telemetry retention by rule, off until previewed

- Date: 2026-10-14. Status: adopted by the owner for local telemetry Slice 9 ("yes to all" on the plan's decisions); production mode not switched, deployment unverified.
- Plan: `../plans/2026-10-14-telemetry-slice-9-retention.md`. Parent: `../plans/2026-10-13-telemetry-audit-and-improvements.md`, Slice 9.
- Amends: `2026-10-05-operations-monitoring-and-triage.md` item 17 (the operational prune now runs through this mechanism) and the "redacted AI telemetry is kept" part of `2026-09-16-self-serve-account-closure-lifecycle.md` (AI rows are now kept for 365 days, not indefinitely).

## Context

Only `operational_events` and `job_runs` had a time rule (90 days, off unless flagged, unbatched, a failure marked the monitor run failed). `event_logs` mixes lifecycle evidence with high-volume observations and stores raw IP and User-Agent on most rows; AI rows survive request deletion and account closure; old intake events hold full addresses and link slugs. On 2026-10-14 production held 11,497 event rows (median 8 per request), 21,700 AI rows, 843 intake rows with addresses and 7,175 suggestion rows with provider names.

## Decision

- **Windows by class:** seller browser diagnostics 90 days; endpoint observations (`seller_opened`, `seller_self_send_link`, `suggestions_fetched`, `suggestions_search`) 180 days; raw IP and User-Agent on `event_logs` cleared after 30 days with the row kept; AI runs and items 365 days; email and PDF evidence 180 days, never below 30; operational incidents and job runs `OPS_EVENT_RETENTION_DAYS` (default 90).
- **Never removed by retention:** lifecycle events and any event type not named in a rule, `reminder_operations`, `admin_audit_logs`, `account_security_events`, billing and `referral_credits`, activation and testimonial outreach logs (send guards), feedback, question requests, growth attribution and referral events. Keep by default: a new event type is kept until a rule names it.
- **One-time historical cleanups** remove the pre-Slice-2 intake address/slug keys and the pre-Slice-9 provider-name arrays from `event_data`, keeping the rows. They stay in preview until their own switch is set.
- **Mechanism:** `lib/telemetry/retention.ts`. `TELEMETRY_RETENTION_MODE` is `off` (default; no query runs), `preview` (counts only) or `enforce`. `OPS_RETENTION_PRUNE_ENABLED=true` still enforces the two operational rules alone. Called from the existing ops monitor, at most once in 23 hours, recorded as a `telemetry_retention` job run, one statement per rule, at most 2,000 rows per rule per run, oldest first, strictly older than the cutoff, NULL timestamps kept. A failing rule is isolated and marks the monitor run partial, never failed. Admin > Operations > Retention shows configuration and the last run.
- **Collection:** suggestion events keep counts only; creation, open, return-link and submission events add the coarse `device`/`browser` labels from the Slice 5 classifier so that signal outlives the raw header.
- **No index:** EXPLAIN on 1 million synthetic `event_logs` rows (about 87 times current volume) showed 0.25 to 0.7 seconds of sequential scan per rule, once a day.

## Alternatives

- A separate daily cron in `vercel.json`: cleaner schedule, but a deployment-config change for a job that fits in the existing monitor.
- Deleting old IP/User-Agent rows instead of clearing columns: would remove lifecycle evidence.
- Rollups of deleted observations: no report reads past 90 days, so none were built.
- Shorter AI retention (180 days): stricter, still covers every report; 365 keeps a year of prompt and cost history for Slice 8.
- Scrubbing soft-deleted requests: a business-record change, left for a separate product decision.

## Consequences

- Deletion is irreversible beyond the database point-in-time restore window. Production goes off, then preview, then enforce, each an owner-approved setting change.
- Older history becomes unknown in Admin (Seller Progress last step after 90 days, request timelines after 180 days, IP comparisons after 30 days, AI comparisons after a year, email/PDF evidence after 180 days).
- The operational prune runs daily and batched instead of every 15 minutes.
- Vercel analytics: dashboard buttons send `new_request_cta_clicked`, `new_request_started` means the page opened, an Advanced PDF download sends only `advanced_packet_downloaded`; counts change from the release date.
- Adding a rule, changing a window or making a new table removable requires changing `lib/telemetry/retention.ts`, its tests and `docs/telemetry-privacy.md` together.

## Approved Slice 8 amendment (2026-10-14)

Owner-approved A-E in `2026-10-14-ai-exposure-lineage.md` extends this policy: v2 optional opaque IDs with strict v1 compatibility, server-validated advisory memberships and immutable accepted choices; distinct generation/consumer/ack/choice denominators and first/reopen cohorts; explicit aiExposures/aiChoices 365-day independent retention rules with request CASCADE and origin SET NULL. Browser acknowledgment remains solely in existing 90-day events. One 500 ms consumer budget includes shared persistence and its exposure, no replay/detached writes. Legacy/expired/unrecorded evidence remains unknown. This authorizes local implementation only, not live execution or release.
