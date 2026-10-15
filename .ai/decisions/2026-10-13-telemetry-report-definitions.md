# Honest telemetry report definitions

- Date: 2026-10-13. Status: adopted locally in telemetry Slice 4; not deployed.
- Plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context and decision

Existing nullable usage columns suffice to represent absent grounding metadata.
Missing candidate/query/source arrays remain NULL. Explicit empty arrays may
report zero; historical zero rows can also mean missing metadata and cannot be
reclassified. If any pipeline pass is unmeasured, grounding run totals remain
unknown; available token counts are still a lower bound. Source counts sum
per-pass distinct URLs, not distinct sources across a run. No schema or backfill.

Reports distinguish generated/served pipeline evidence from browser exposure.
Acceptance groups current provider choices by the first recorded suggestion
result before first metering, retaining an unrecorded bucket. It is a mutable
submission proxy with incomplete linkage, not an impression or accuracy metric.
Latency cohorts separate feature/outcome/model/prompt; fresh nonnegative timings
have an explicit sample count and continuous p50/p95. Pipeline time includes
retries and excludes observation persistence and full HTTP/browser time.
Failure counts are runs carrying a first failure, including recovered runs;
passes exclude transport retries. Token and search metrics each expose coverage.
Offline evaluation search/total/cost-per-top-3 estimates are unknown with missing
case coverage. Available token-only estimates remain labelled lower bounds.

Growth and its Users drilldowns use retained non-demo requests and first metering
regardless of mutable status. A timed submitted legacy row without metering uses
last activity as an explicit estimate. Untimed legacy rows remain unknown;
deletion can remove contributions. No immutable account history is claimed.
Seller Progress uses the same customer/request exclusions and ages only known
seller endpoint evidence in the current creation/reopen cycle. Operator/technical
timestamps are separate and absent observations do not prove inactivity.

## Rationale and consequences

Coercing missing metadata to zero or counting mutable status would preserve
familiar numbers but misstate evidence. A new coverage column or historical
backfill would not repair unknown old zeros and is unnecessary for these local
corrections. Reports may change numerically; no submission, entitlement, billing
or metering write changes. Browser acknowledgments, immutable exposure/call
lineage, complete billing reconciliation and monitoring coverage are separately
scoped work. Current semantics are maintained in `ADMIN.md`, AI telemetry docs
and the operations runbook. No production changes or external calls authorized.

## Approved Slice 8 amendment (2026-10-14)

Owner-approved A-E in `2026-10-14-ai-exposure-lineage.md` extends this policy: v2 optional opaque IDs with strict v1 compatibility, server-validated advisory memberships and immutable accepted choices; distinct generation/consumer/ack/choice denominators and first/reopen cohorts; explicit aiExposures/aiChoices 365-day independent retention rules with request CASCADE and origin SET NULL. Browser acknowledgment remains solely in existing 90-day events. One 500 ms consumer budget includes shared persistence and its exposure, no replay/detached writes. Legacy/expired/unrecorded evidence remains unknown. This authorizes local implementation only, not live execution or release.
