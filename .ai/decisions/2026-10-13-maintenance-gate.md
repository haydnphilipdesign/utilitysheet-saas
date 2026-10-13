# Maintenance gate for planned pauses

- Date: 2026-10-13. Status: accepted for local implementation on `codex/maintenance-mode`; activation and release separately authorized.
- Plan: `../plans/2026-10-13-maintenance-mode.md`. Runbook: `../../docs/maintenance-cutover-runbook.md`. Related: `2026-10-13-capability-safe-telemetry.md`.

## Context and decision

The Slice 1 counter-key change needs a pause of five endpoints with no limiter
traffic in either scheme. Adopt an explicit per-route gate:
`maintenanceResponse(surface, request)` from `lib/maintenance/server.ts` is the
first statement of each paused handler and answers a marked 503
(`Retry-After`, `no-store`, `X-UtilitySheet-Maintenance: 1`,
`code: "MAINTENANCE"`). `MAINTENANCE_MODE` is off when unset or an explicit
off value and **on for any other value**. A public, uncached
`GET /api/maintenance` reports the state. Pages recognize the marker, and ask
the status endpoint after an unexplained 403/5xx, so a pause is never shown as
an empty list, an invalid link, a failed submit or a failed PDF.

Seller answers are not stored on the server during a pause. The existing
best-effort browser draft is the only persistence, and the wording states
what that browser actually did. Nothing is replayed: a refused submit is sent
again only when the seller submits again, with the same submission key.

## Rationale and alternatives

- **Global middleware/proxy** was rejected: it would sit in front of webhooks,
  crons, auth and billing, where a mistake interrupts money and delivery
  callbacks. A guard test instead fails if any route other than the five is
  gated. A future pause of other endpoints adds a surface and updates that test.
- **Fail-open parsing** (only `on` enables) was rejected: during a cutover a
  typo would silently open mixed limiter traffic.
- **A runtime switch** (database, Redis or edge configuration) was rejected for
  now: it adds a dependency read to five hot paths, and Redis is the very
  system being cut over. The cost is that turning the gate on or off needs a
  deployment, which also makes reopening deliberate.
- **Server-side draft storage** was rejected: it would create a new copy of
  seller answers before submission, against the privacy direction of the
  telemetry work, to cover a pause of about an hour.
- **Automatic reopening or a countdown** was rejected: reopening depends on
  when the last old request finished, which no timer in the app knows.

## Consequences

- The gate covers only deployments that contain it and were built with the
  flag on. Old deployments, generated URLs, pinned tabs and previews need an
  owner-approved external gate; the runbook lists the options and the
  unverified hosting assumptions.
- Tabs loaded before a maintenance-aware build keep their old wording.
- A failed call to an affected endpoint now costs one extra status request.
- The estimate is optional and disappears once it passes.
