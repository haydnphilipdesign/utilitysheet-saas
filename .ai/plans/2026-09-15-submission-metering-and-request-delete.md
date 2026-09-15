# Submission-Based Metering and Request Delete

Status: Completed (Claude, 2026-09-15). Committed and pushed as `894e025`, Vercel Production deploy succeeded, then the migration was run against production with owner authorization. Owner approved scope and existing-data cleanup.

## Production rollout (2026-09-15)

- Production database identified as the `.env.local` target (contains the reporting customer's account; `.env` holds a placeholder host).
- Read-only preview matched the migration's own WHERE clause: 52 rows (44 not deleted) of 901 requests.
- Applied after deploy: 52 rows updated. Metered requests 763 to 711; re-check found 0 remaining candidates. The reporting Free customer's monthly usage went from 2 to 0.

## Outcome and deviations

- Implemented as approved. New shared `components/requests/DeleteRequestDialog.tsx` is used by the dashboard home, Requests list, and request detail page (normal and locked views).
- Dashboard home removes the deleted row from its lists locally instead of reloading, because `loadDashboardData` shows the full-page skeleton. The Requests list refetches via `retryKey`.
- The New Request upgrade dialog no longer has a monthly-limit path (the API no longer returns that 403). It remains only as the Property Handoff Packet upsell, retitled, with "Not now" instead of "Back to Dashboard".
- Usage copy now says "submitted sheets" (Settings) and "free submissions left this month" (dashboard home).
- `app/api/seller/[token]/route.ts` working copy had CRLF endings while HEAD is LF; normalized to LF because `tests/unit/test-drive-seller-safety.test.ts` matches LF source text. Diff is the two comment lines only.

## Validation results

- Full Vitest: 153 files passed. New or changed: `request-metering-soft-delete` (unmetered creation, status updates never meter), `requests-route-advanced-gating` (Free create at limit returns 201), `intake-start-route` (start at limit), `request-list-actions`, `delete-request-dialog`; `dashboard-reusable-link` copy expectation updated.
- ESLint on all touched files: clean. `npm exec tsc -- --noEmit`: passed.
- Not done: browser check of the authenticated dashboard, `npm run build` (skipped to avoid disturbing a possibly running dev server), seller-route over-limit lock unit test (no existing route harness; logic unchanged).

## Remaining work

- Required: none.
- Optional: publish a customer Product Update (owner-drafted text provided in session), reply to the customer's Facebook comment, browser-check the Delete flow on production, add a seller-route over-limit lock unit test.

## Problem (verified)

- A Free customer asked how to delete an old request the seller never answered. The dashboard has no delete control: `bb83982` added "Delete request", and the July 17 dashboard rewrite (`123e1ff`) dropped it without the plan mentioning it. `DELETE /api/requests/[id]` and `deleteRequest` still work.
- Dashboard-created requests are metered (`metered_at`) at creation/`sent`, so an unanswered request consumes one of the 3 Free monthly slots. Soft-deleted metered requests still count (deliberate anti-abuse from `5d705b6`).
- Free creation is hard-blocked at the limit in `POST /api/requests` and `POST /api/intake/[slug]/start`.
- Over-limit lock-on-submit exists in `POST /api/seller/[token]`, but only runs for unmetered requests, so it effectively applies only to intake requests, and intake start blocks before it can happen.

## Approved behavior

1. A request counts toward the Free limit only when a seller submits it. `metered_at` means "counted submission" and is set only in the seller submission path. Usage continues to be keyed on `metered_at` (not mutable `status`, which the owner can PATCH).
2. Free creation is never blocked by the monthly limit (dashboard or reusable link). Submissions past the limit are saved and locked (`locked_reason = 'monthly_limit'`); locked submissions do not count.
3. Deleting a never-submitted request is free (hard delete). A submitted (metered) request is soft-deleted and still counts, preventing download-delete-repeat abuse.
4. Restore "Delete request" in the dashboard row menus and the request detail page, with a confirmation that the seller link stops working.
5. One-time data cleanup: clear `metered_at` on never-submitted, unlocked, non-demo requests.

## Files

- `lib/neon/queries/requests.ts` (`createRequest` default metering, `updateRequestStatus` stop metering)
- `app/api/requests/route.ts`, `app/api/intake/[slug]/start/route.ts` (remove limit blocks)
- `app/api/seller/[token]/route.ts` (comment only if logic already correct)
- `components/requests/RequestListActions.tsx`, `app/dashboard/page.tsx`, `app/dashboard/requests/page.tsx`, `app/dashboard/requests/[id]/page.tsx` (delete UI)
- `app/dashboard/requests/new/page.tsx`, `app/dashboard/settings/page.tsx` (limit copy)
- New `migrations-requests-submission-metering.sql`; `schema.sql` unchanged (no shape change)
- Tests: `tests/unit/request-metering-soft-delete.test.ts`, `tests/unit/requests-route-advanced-gating.test.ts`, `tests/unit/intake-start-route.test.ts`, new RequestListActions test

## Migration and deploy order

Code must deploy before the cleanup runs; the migration is idempotent and safe to re-run after deploy to catch rows metered by old code in between. Keep any request with a `seller_submitted` event metered even if its status was later changed. Running against production requires explicit confirmation at execution time.

## Acceptance criteria

- Creating requests at/over the Free limit succeeds on both paths; no dashboard upgrade dialog on create.
- Seller submission meters the request; at/over limit it saves locked; Pro/Teams never lock.
- Unsubmitted requests never count; deleting them frees nothing because they never counted.
- Delete available from list menus and detail page with confirmation; list refreshes after delete.
- Focused Vitest, ESLint on touched files, and `tsc --noEmit` pass.

## Risks

- Concurrent submissions at `used = limit - 1` can both stay unlocked (pre-existing race, out of scope).
- Admin activity windows and testimonial counts that read `metered_at` will reflect submissions instead of sends.
- A request sent in one month and submitted in the next counts in the submission month.
