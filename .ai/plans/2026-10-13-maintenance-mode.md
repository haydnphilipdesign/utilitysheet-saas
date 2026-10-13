# Maintenance mode for the telemetry Slice 1 cutover

- Date: 2026-10-13. Owner: Claude Code. Worktree `.worktrees/maintenance-mode`, branch `codex/maintenance-mode`, base main `3de1a54` (Slices 1-5 committed).
- Status: **completed and validated locally 2026-10-13; committed to `codex/maintenance-mode` only. No required local work remains.** Not merged, pushed or deployed; maintenance was never activated.
- Authorized scope: local preparation and validation only. Not authorized: activating maintenance, the production cutover, merge, push, deploy, production settings/data, migrations, messages, alerts, telemetry or model calls.
- Related: Slice 1 "Release UX readiness" in `2026-10-13-telemetry-audit-and-improvements.md`; counter-key procedure in `../../docs/telemetry-privacy.md`; decision `../decisions/2026-10-13-capability-safe-telemetry.md`. Operator steps: `../../docs/maintenance-cutover-runbook.md`. Decision: `../decisions/2026-10-13-maintenance-gate.md`.

## Verified facts (current code at `3de1a54`)

- The five endpoints whose limiter identifier changed in Slice 1 (the only callers of `capabilityRateLimitIdentifier` besides the new observation scope):
  - `POST /api/seller/[token]` (submission, `formSubmissionRatelimit`, per token)
  - `GET /api/seller/[token]/suggestions` (`aiRatelimit`, token + IP)
  - `GET /api/seller/[token]/suggestions/search` (`aiRatelimit`, token + IP, shared scope)
  - `POST /api/seller/[token]/send-link` (`reminderRatelimit`, per token, 15-minute window)
  - `GET /api/packet/[token]/pdf` (`packetPdfRatelimit`, token + IP)
- Suggestions and search do two request lookups before the limiter; the other three call the limiter first. None has a maintenance concept. An unavailable limiter already answers a plain 503 without `Retry-After`.
- `GET /api/seller/[token]` (form read), `GET /api/packet/[token]` (sheet read), intake metadata/start and `POST /api/seller/[token]/observations` use no changed identifier. The observation scope is new and has no legacy bucket.
- Browser callers: wizard submit and initial suggestions (`SellerWizard.tsx`), provider search (`UtilityStep.tsx`), return-link email (`SellerLayout.tsx`), PDF download through `lib/pdf-generator.tsx` (public sheet page, dashboard home, requests list, request detail, submitted-sheet editor) and a direct link in `TestDriveCard.tsx`.
- Before this work a refused suggestion call rendered as an empty provider list, a refused search as "No matches in our directory", a refused submit as a red generic failure and a refused PDF as "We couldn't create the PDF".
- Seller answers live in React state and a best-effort `localStorage` draft (`us_seller_draft:<token>`, 250 ms debounce, write failures swallowed). The draft is per browser and device, is dropped when the request's editing session changes, and is never sent to the server before submit. Nothing server-side stores partial answers.
- No `middleware`/`proxy` file exists. `vercel.json` only declares four crons. No route sets `maxDuration`.
- Other worktrees: `.worktrees/slice-6` (`telemetry-slice-6`) and `.worktrees/slice-7` (`telemetry-slice-7`), both from `3de1a54`, both recorded as completed and committed on their own branches. Slice 6 edits `app/api/seller/[token]/route.ts` and `app/api/packet/[token]/pdf/route.ts`; both slices edit `.ai/CURRENT.md`, the telemetry plan and `docs/telemetry-privacy.md`.

## Assumptions (not verified; see the runbook for the full list)

- Production is hosted on Vercel and currently serves `origin/main` `7d6a2af` (the old limiter scheme). Environment variables are fixed per deployment, so changing one needs a new deployment.
- Older deployments stay reachable at their generated URLs and keep their production environment, including the Redis credentials.

## Design

1. **Server gate, per route.** `lib/maintenance/config.ts` reads `MAINTENANCE_MODE`. Unset, empty, `off`, `false`, `0` and `no` mean off; any other value means on, so a mistyped value during a cutover cannot open traffic. `lib/maintenance/server.ts` `maintenanceResponse(surface, request)` is the first statement of the five handlers, before parameters, lookups, the limiter, the body, writes, email, rendering or model calls. It answers 503 with `Retry-After`, `Cache-Control: no-store`, `X-UtilitySheet-Maintenance: 1` and `{ error, code: 'MAINTENANCE', maintenance: true, surface, expectedBackAt }`. A browser navigation to the PDF URL gets a small HTML page instead of JSON. No global middleware: crons, webhooks, auth, billing and every other route are untouched by construction.
2. **Status endpoint.** `GET /api/maintenance` returns `{ maintenance, expectedBackAt }`, always 200, never cached. Pages use it for new visits and for "Check again"; the operator uses it to verify a deployment.
3. **Estimated return.** `MAINTENANCE_EXPECTED_BACK_AT` (ISO time with offset) is shown only when set, valid and still in the future. No countdown, no timer and nothing reopens by itself. `Retry-After` is the time until then, otherwise `MAINTENANCE_RETRY_AFTER_SECONDS` (default 1800, bounded 60 to 86400).
4. **Browser.** `lib/maintenance/client.ts` recognizes the header, and asks the status endpoint after an unexplained 403/5xx so an external gate in front of the app is also recognized.
   - New seller visit: the page asks the status endpoint alongside the form read and shows a paused screen instead of the wizard. New intake visit: paused screen instead of the address form.
   - Already-open wizard: suggestions, search, submit and the return-link email each show maintenance wording, never the empty-list, no-match, red-failure or generic text. The seller can keep answering. Submit stays a manual action; nothing is replayed.
   - Draft guidance is conditional on what actually happened: stored in this browser, or storage unavailable so keep the page open. No promise of permanence or other devices.
   - "Check again" only reads the status endpoint. When maintenance is over the notice clears and failed suggestion lists are fetched again (a read); the seller taps Submit themselves.
   - PDF: `generatePacketPdf` throws a typed maintenance error and `notifyPacketPdfFailure` shows a calm notice in all five callers.
   - Dashboard: a banner tells signed-in users that seller submissions and PDF downloads are paused.
5. **Deployment boundary.** Application code only gates deployments that contain it and were built with the flag on. Old deployments, generated deployment URLs and Skew-Protection-pinned tabs need an owner-approved external gate. The runbook documents it; this work does not claim to solve it.

## Expected files

- New: `lib/maintenance/{config,server,client}.ts`, `app/api/maintenance/route.ts`, `components/maintenance/{MaintenanceNotice,DashboardMaintenanceBanner}.tsx`, `docs/maintenance-cutover-runbook.md`, `.ai/decisions/2026-10-13-maintenance-gate.md`, tests under `tests/unit/maintenance-*.test.ts(x)`, `tests/maintenance.spec.ts`, `tests/maintenance.playwright.config.ts`, `tests/fixtures/maintenance-harness.tsx`.
- Changed: the five route files, `app/s/[token]/page.tsx`, `components/seller-form/{SellerWizard,SellerLayout}.tsx`, `components/seller-form/steps/{UtilityStep,ReviewStep}.tsx`, `components/intake/IntakeLinkScreen.tsx`, `lib/pdf-generator.tsx` and its five callers, `app/dashboard/layout-content.tsx`, `docs/telemetry-privacy.md` (pointer only), `.ai/CURRENT.md`.

## Acceptance criteria

- Flag off: all five endpoints behave exactly as before (existing suites pass unchanged).
- Flag on: each of the five answers the maintenance 503 with `Retry-After`, `no-store` and the marker, without calling the limiter, a query, the body reader, email, the renderer or the suggestion service.
- Only those five handlers call the gate (guard test); webhooks, crons, auth and reads are not gated.
- New seller and intake visits, and already-open tabs, show maintenance wording that is distinct from empty suggestions, an invalid link, a failed submit and a failed PDF.
- A refused submit keeps the answers on screen and in the draft, sends once, and succeeds on a later manual submit without a duplicate.
- Draft guidance matches reality with storage working and with storage blocked.
- An estimated time appears only when configured and in the future.

## Validation

Node 20.19.0, installed CLIs, Redis variables cleared: complete Vitest run, TypeScript, ESLint on affected files, security scan, `git diff --check`, and an isolated Playwright bundle (Desktop Chrome, Mobile Safari, Mobile Chrome) with every request intercepted.

## Risks and limits

- Tabs opened before a maintenance-aware build is live keep their old script and show the old generic wording. Only a release that ships this code ahead of the window fixes that, and this branch cannot be that release because it contains Slice 1.
- Merge overlap with `telemetry-slice-6` in two route files and with both slice branches in the shared `.ai`/docs files.

## Outcome (2026-10-13)

Implemented as designed. Files as listed under "Expected files", plus `tests/seller-observations.spec.ts` (its request fixture now answers the status endpoint, because a failed submit asks it).

Deviations and additions, recorded honestly:

- `docs/telemetry-privacy.md` gained a pointer to the runbook only; the procedure text is unchanged.
- The seller page asks the status endpoint in parallel with the form read rather than before it, so ordinary loads are not slowed. During a pause the form read therefore still runs (it records the open, as it always did).
- Reusable-link start is not gated on the server; the page shows the paused screen instead. Recorded in the runbook as intentional.
- No Admin view of the maintenance state was added. The status endpoint is the check.
- Not built: maintenance wording for tabs loaded before a maintenance-aware build. A read-only merge simulation of this change onto the deployed commit `7d6a2af` conflicts in the five route files, `SellerWizard.tsx`, `UtilityStep.tsx` and shared docs, so a release that ships the browser code ahead of the window is separate work and an owner decision (runbook, "Known limit").

Validation (Node 20.19.0, installed CLIs, Redis variables cleared, `node_modules` joined to the main checkout because `npm ci` fails with the cached npm):

- Complete Vitest: **242 files passed, 1 skipped; 2,028 tests passed, 13 skipped, 0 failed** (baseline before this work: 237 files, 1,933 tests). New: configuration 20, route gate 37, browser helpers and PDF 16, wizard 11, new visits/intake/dashboard 11. One of six complete runs had a single failure in `tests/unit/branding-list-page.test.tsx` ("duplicates a profile from the overflow menu"), a file this work does not touch; it passed alone and in the runs before and after. Treated as an existing intermittent test, not investigated further.
- Isolated Playwright `tests/maintenance.playwright.config.ts`: **12 passed** (4 scenarios in Desktop Chrome, Mobile Safari, Mobile Chrome) against the real seller page, wizard and compiled stylesheet with every request intercepted. Covers a new visit, an open tab through a refused submit, a reload during the pause and reopening, blocked storage, and paused suggestions/lookup/return-link email; checks roles, heading, accessible name, keyboard operation, touch-target height, no horizontal overflow and that the notice is in view beside Submit. Screenshots were reviewed by eye. `tests/telemetry.playwright.config.ts`: 15 passed.
- TypeScript passed. ESLint on all changed files: 0 errors, 12 warnings, all existing (`<img>` in the sheet page and seller layout, 6 hook warnings in `SellerWizard.tsx` identical to the baseline). Tracked security scan and `git diff --check` passed.
- Not run: production build, the Next-server Playwright suites, anything hosted. Not automated: contrast measurement (no axe tooling installed; the notices use existing theme tokens), the public sheet page and dashboard buttons in a browser (their shared download helper and notifier are unit-tested), dark theme screenshots.

Local-only working-copy note: `scripts/demo-seed.mjs` shows as modified because its line endings were normalized to LF so its test can run in a fresh worktree. It is deliberately not committed.

Remaining required local work: none. Everything else is a production action listed in the runbook.

## Release decision (2026-10-13, after completion)

The owner chose an ordinary rolling release of Slice 1 instead of the paused cutover, accepting briefly looser limits (amendment in `../decisions/2026-10-13-capability-safe-telemetry.md`), and asked for maintenance mode to be included. `codex/maintenance-mode` was fast-forwarded into `main` and pushed with the owner's authorization. Maintenance mode is off and was not activated. The paused procedure in the runbook was not used. The owner asked whether the switch is in Admin; it is not (environment variable plus redeploy). An Admin toggle would be new, optional work.