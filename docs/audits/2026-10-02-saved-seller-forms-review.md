# Saved seller forms: independent implementation review

- Date: 2026-10-02. Reviewer: Codex (this chat), branch `main`, uncommitted implementation over `735ddb0`.
- Verdict: **Request changes before release.** Three actionable findings; implementation is not yet ready to be treated as having no required local work.
- Scope: saved-form diff and new files, migrations/final schema, authenticated/public routes, snapshot and referral boundaries, UI, lifecycle and validation evidence. No application edits, live database access, migration, deployment, commit or push performed.

## R1 — P1: default initialization bypasses the pilot gate and technical cap

Location: `lib/neon/queries/intake-links.ts:104-109`; `migrations-saved-seller-forms-expand.sql:97-105` (also mirrored in `schema.sql`).

`POST /api/seller-forms` checks pilot eligibility and calls the cap-enforcing save function. However, `ensureIntakeLink` calls `ensure_seller_form` without either capability or cap. Once the enable migration removes account uniqueness, that function inserts a new form whenever the account has no form in the requested workspace. `ensureAccountActivation` invokes it on ordinary authenticated requests, and the forms/intake GET routes invoke it as well.

An account with a form in workspace A can therefore obtain another form in B simply by switching workspaces and loading an authenticated page, even with additional-form creation disabled, the account absent from the pilot, or the configured account-wide cap already reached. This contradicts the documented rollout/recovery controls. It is not a request to choose commercial limits now.

Confirmed with disposable PGlite using the actual final schema: initialize A; call `save_seller_form` with cap 1 (correctly raises SF429); initialize B via `ensure_seller_form`; account form count becomes 2. No external database was used. Source trace confirms that the application ensure path never checks the environment capability.

Required fix: distinguish initial account provisioning from additional workspace-form creation. Pass verified operational eligibility/cap to the atomic ensure path, enforce it under the same owner lock, and return a deliberate unavailable result when additional provisioning is gated. Keep existing forms usable and permit legitimate first-form provisioning. If per-workspace initialization is intentionally exempt, obtain an explicit product decision and make both cap semantics and rollout claims reflect that exception; current account-wide enforcement/documentation are inconsistent.

Regression coverage: nonpilot and disabled gate account switching A→B; cap reached; simultaneous ensure versus explicit create; first-ever form still provisions; existing form reads work while gate is disabled.

## R2 — P2: request INSERT and form save acquire conflicting locks in opposite order

Location: `migrations-saved-seller-forms-expand.sql:171`, compared with `save_seller_form` at lines 113 and 129. Mirror the correction in `schema.sql`.

The request BEFORE INSERT trigger first takes FOR SHARE on the form. The request then needs the foreign-key check on `requests.account_id`, which takes a key-share lock on the account. The save function first locks that account FOR UPDATE and then locks the form FOR UPDATE. A valid interleaving is:

1. A seller request INSERT holds the form SHARE lock.
2. A form save takes the owner account UPDATE lock, then waits for the form.
3. The request INSERT reaches its account FK check and waits for that same owner lock.

This is a lock cycle; one transaction can be aborted and surface as a generic 500. There is no deadlock retry in either route. The storage test's simplified requests table omits the account FK, and PGlite serializes clients, so the current tests do not exercise this cycle.

Evidence level: source-derived lock-order finding, **not reproduced on native PostgreSQL in this review**. No native PostgreSQL executable, psql or Docker was found on PATH. PostgreSQL documents the conflicting row-lock modes and recommends consistent acquisition order: [official locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html).

Required fix: establish a consistent account→form acquisition order (or a reviewed compatible locking strategy) across form save/default/ensure and request insertion, without weakening revision, membership or snapshot guarantees. Review account closure and relevant FK locks at the same time. Add a deterministic two-connection test using the real request/account FKs, not only a reduced schema. Keep native rehearsal as a release blocker even after the code correction.

## R3 — P2: individual request UI hides stale-form recovery guidance

Location: `app/dashboard/requests/new/page.tsx:365-367`; corresponding 409 response in `app/api/requests/route.ts` and `lib/seller-forms/errors.ts`.

When the saved form changes after this page loads, POST correctly returns 409 with `code: FORM_REVISION_CONFLICT` and the reload explanation in `error`. The UI reads only `errorData.message`, so users see "Failed to create request". It also retains the stale selected revision and only fetches the forms on initial mount; retrying or reselecting the same cached form continues to fail. This newly introduced failure case has no actionable recovery in the individual-request flow.

Required fix: handle the conflict code explicitly, display the actual explanation, and offer refetch/reselection with clear treatment of request-only changes. Preserve entered address/contact data; do not silently discard question overrides. Add a browser/component test where the revision changes after the user fills in a request, then demonstrate successful recovery. The editor's existing reload handling does not cover this separate page.

## Verification and limits

- Independently reran five suites: seller-forms-storage, seller-forms-route, intake-start-route, intake-public-route, requests-route-advanced-gating. **43 tests passed.** Runtime was the existing Node 22 installation; Sol's reported Node 20/full build/full test run was not independently repeated.
- Reproduced R1 against the full current schema in an isolated PGlite instance.
- `git diff --check` passed (existing CRLF warnings only).
- Sol's browser suite is API-mocked and primarily renders development fixtures. Its three tests across three projects cover useful UI behavior, but do not prove live server authorization, concurrent SQL behavior, or actual workspace switching through the authenticated shell.
- Positive findings: explicit scoped ownership checks, fixed public workspace resolution, retained alias mapping, distinct referral identity, revision-aware snapshots and escaped seller-only introduction are present. Reported native rehearsal limitation is accurate.
- No new finding of a direct cross-workspace data disclosure was established during this pass. That is not a certification of all possible behavior.

## Next action

Have the implementation owner address R1–R3 with focused regression coverage, update the plan/handoff, and rerun relevant validation. Then repeat review of the corrections and complete native PostgreSQL concurrency/migration rehearsal before authorized rollout. Pricing, pilot membership/cap and deployment approvals remain separate release decisions. Do not send this report to another chat automatically; owner authorization is required for messaging that chat.
