# Capability-safe auxiliary telemetry

- Date: 2026-10-13. Status: accepted for local Slice 1 implementation. **Release amended by the owner on 2026-10-13: see "Amendment" below.**
- Plan: `../plans/2026-10-13-telemetry-audit-and-improvements.md`.

## Context and decision

Capability-bearing limiter identifiers were sent to both Redis counter keys and
Upstash analytics; global browser collection and first-touch attribution could
retain sensitive URL paths/queries. Adopt deterministic versioned, scoped SHA-256
identifiers only at capability-bearing limiter callers, preserving existing
grouping and thresholds. Do not hash unrelated IP/account policies incidentally.
Treat the SDK's timeout success as unavailable to keep enforcement fail closed.

Use one finite static route policy for both collector hooks and client/server
landingPath. Reconstruct documented collector fields; drop unsupported origins
and unsafe URLs. Campaign values require a finite semantic allowlist; bounded
arbitrary text is insufficient. Preserve the public product referral slug as
intentional attribution under strict validation.

## Rationale, alternatives and consequences

Disabling limiter analytics would leave capabilities in counter keys. Hashing
high-entropy tokens removes bearer copies without introducing a new secret.
Digests remain linkable. Raw legacy/new dual writes would prolong exposure, so
the chosen release procedure requires an owner-approved traffic pause/drain of
at least 31 minutes (two 15-minute sliding buckets plus buffer) and exclusive
new-version routing. Immediate rolling rollout/rollback is unsafe. No migration,
production action or historical cleanup is authorized by this local decision.

URL granularity, unknown campaigns and preview-origin observations are lost;
future labels/campaigns need explicit allowlist updates. SDK hooks are verified
with installed packages and intercepted synthetic browser collectors; hosted
script/dashboard behavior remains unverified. Procedure and validation limits:
`../../docs/telemetry-privacy.md`.

## Amendment (2026-10-13): owner accepted an ordinary release

The owner reviewed the pause procedure and chose to release Slice 1 as an
ordinary rolling deployment, without the traffic pause, drain or 31-minute
wait. Accepted consequence: for up to about 31 minutes after the new version
goes live, the old raw-key buckets and the new digest buckets are separate,
so an identifier that had used its allowance on one of the five affected
endpoints gets a fresh one. No rate limiting is disabled and no key is
deleted; the old buckets simply expire. Reason: for a product of this size
the brief loosening costs less than a customer-visible pause.

This supersedes "Immediate rolling rollout/rollback is unsafe" above for this
release. A rollback to an old-scheme deployment has the same brief effect and
is accepted on the same terms. The strict procedure stays documented in
`../../docs/maintenance-cutover-runbook.md` for any future change where the
owner wants it. Maintenance mode ships with this release, off, as a general
pause switch; see `2026-10-13-maintenance-gate.md`.