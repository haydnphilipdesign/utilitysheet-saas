# Reopen follow-ups: timeline labels, Admin reminders, time claims, product update

- Status: completed 2026-10-06 (Claude Opus), committed on main and not pushed. The owner approved every recommendation on 2026-10-06 and all four items are implemented; see Outcome. No required work remains.
- Follows: `.ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md`, `.ai/decisions/2026-10-05-seller-reminder-operations.md`.
- Not authorized: migrations, production database access, real email, sending or publishing product updates, commit, push, deploy. Marketing copy and customer message templates need owner sign-off before any edit.
- Each item is its own small change. No scope beyond the four items.

## Verified against the code (main at 56e47ba, clean worktree)

- `request_reopened` and `request_reopen_cancelled` are written only by `changeEditingSession` in `lib/neon/queries/seller-submission.ts`. Reopen sets `status = 'in_progress'` and `last_activity_at = NOW()`; close sets `status = 'submitted'`.
- The only code that turns request event types into readable labels is `describeSellerProgressEvent` in `lib/admin/seller-progress.ts`, used by `/admin/abandonment` (Seller Progress). Both new events fell through to "Other tracked activity".
- `components/admin/EventLogTable.tsx` (the "Technical event history" on `/admin/requests/[id]`) prints the raw event type for every event. `/admin/telemetry` "Request events" also prints raw types by design.
- No customer-facing view renders request event types. The account data export returns raw `event_type` values as data. The test-drive panel reads four named test-drive events only. `lib/admin/audit-log-presentation.ts` labels Admin audit actions, and reopen is a coordinator action that writes no Admin audit entry.
- Admin reminder eligibility is enforced twice with the same rule: `prepareSellerReminder` in `lib/reminders/seller-reminder.ts` (`status === 'submitted' || metered_at`) and the claim statement in `lib/neon/queries/reminder-operations.ts` (`q.status = 'submitted' OR q.metered_at IS NOT NULL`). The customer route refuses only `status === 'submitted'`.
- `tests/unit/provider-incident-product-update.test.ts` asserts that `FEATURED_PRODUCT_UPDATES[0]` is the provider incident entry. Adding an entry at the top needs that test updated in the same change.

## Item 1: Admin timeline labels (implemented)

- `lib/admin/seller-progress.ts`: `describeSellerProgressEvent` names both events, and a small exported `requestTimelineEventLabel` returns the same label for the request page.
- `components/admin/EventLogTable.tsx`: shows the label above the raw event type for events that have one. Other events are unchanged.
- Tests: `tests/unit/admin-seller-progress.test.ts`, new `tests/unit/admin-event-log-table.test.tsx`.
- No report logic changed. Findings on reports that read status or the event log are in "Findings: reports and reopened requests" below, for an owner decision.

Acceptance: Seller Progress shows "Reopened for seller" instead of "Other tracked activity" when the reopen is the latest event; the request page timeline shows a readable name for both events with the raw type still visible.

## Findings: reports and reopened requests (no change made)

A reopened request is `in_progress`, has `metered_at` set and `seller_edit_version > 0`. Nothing in Admin reads `seller_edit_version`.

1. Seller Progress (`app/(admin)/admin/abandonment/page.tsx`): every query selects `status = 'in_progress'`, so reopened requests are counted in the total, the age buckets, the last-stage chart and the table as if the seller had never finished. The reopen itself resets `last_activity_at`, so the request first lands in "Active in 24 hours" (hint: "Recent tracked seller activity") although the activity was the coordinator's. Once the seller opens the link the last event is `seller_opened` and the row is indistinguishable from a first-time seller. "Last observed utility category" uses the latest `suggestions_fetched`, which for a reopened request is usually from the first pass.
2. Overview chip "seller flows inactive 7+ days" (`lib/admin/operations-overview.ts`, `stale_in_progress`) and Operations "Customer follow-up" (`lib/ops/overview.ts`, `getFollowUpCandidates`): a reopened request left untouched for 7 days is counted, with the detail "In progress, no seller activity recorded since".
3. Counts keyed on `status = 'submitted'` drop a request while it is reopened and regain it on resubmission or close: overview "submitted last 7 days", the activation funnel and `activated-7d` / `habitual` user filters, testimonial candidate `submitted_requests`, the lifecycle bar. Telemetry completion uses `metered_at` and is unaffected.
4. Telemetry "Follow-up/corrections" counts `submitted_sheet_edited` only, so a reopen is not counted as a correction. Each accepted resubmission writes another `seller_submitted` event, which adds one to event counts and to the testimonial "seller submissions logged" reason.
5. Outside reports, not changed and not fully traced: referral-credit eligibility and the test-drive "has a live submission" checks also use `status = 'submitted'`, so an account whose only submitted request is currently reopened briefly looks as if it has none.

Options for the owner (none started):
- A. Leave as is. Reopens are expected to be rare and short-lived; the new label already explains the row on Seller Progress.
- B. Mark reopened rows on Seller Progress (a "Reopened" badge from `seller_edit_version > 0 AND metered_at IS NOT NULL`) and keep them in the counts. Small, display only.
- C. Exclude reopened requests from the abandonment counts and the two 7-day backlogs, or show them as a separate figure. Changes report definitions in three places that ADMIN.md says must agree.

Recommendation: B now if anything, C only if reopened requests turn out to be common enough to distort the figures.

## Item 2: Admin reminders on reopened requests (proposal, waiting)

Options:
- A. Keep refusing (current). Admin cannot nudge a reopened seller; the coordinator can.
- B. Allow Admin reminders when `status = 'in_progress' AND metered_at IS NOT NULL AND seller_edit_version > 0`, keeping every other rule (reason, confirmation, preview fingerprint, shared cooldown, owner standing). Two-place change (the prepare check and the claim statement) plus the refusal text, ADMIN.md, an amendment to the reminder decision, and tests.
- C. Allow any in-progress request regardless of `metered_at`. Simpler predicate, but also admits a request that an Admin status correction left in progress with a recorded submission and no reopen.
- D. B, plus a different reminder wording for reopened requests ("your agent asked you to review and resubmit"). Touches a customer-editable message template.

Recommendation: B. It matches what the coordinator can already do, is the narrowest predicate, and leaves the template alone. The default reminder ends "If you already completed it, you can ignore this email", which reads slightly off for a seller who is being asked to correct a sheet; the Admin preview shows the exact text before sending, so the operator can decide per case. D can follow if that wording proves confusing.

## Item 3: older time claims (proposal, waiting)

No file edited. Proposed direction for every line: drop the duration and keep the factual part (phone, no account, progress saves, "Not sure" is fine). Exact wording per line was given to the owner in the session report and must be approved before editing.

Numeric claims found (16):
- `app/i/[slug]/page.tsx` 374, 375: "about 2 to 3 minutes".
- `app/dashboard/page.tsx` 432, 447 (share text), 622 (help accordion): "about 2 minutes".
- `app/dashboard/requests/new/page.tsx` 293, 311 (share text): "about 2 minutes"; 654: "~2 min".
- `components/test-drive/TestDriveCard.tsx` 193: "about 2 minutes".
- `components/landing/TrustStrip.tsx` 12: "Sellers finish in ~2 minutes".
- Beyond the brief: `components/seller-form/steps/SuccessStep.tsx` 72 ("under 2 minutes", demo success); `lib/message-templates/defaults.ts` 4, 14 ("under 2 minutes") and 27 ("usually 2 to 3 minutes"); `lib/email/email-service.ts` 733 ("typically takes 2-3 minutes", built-in seller request email); `app/(marketing)/from-a-closing/page.tsx` 47 ("about two minutes").

Unquantified (4): "a few minutes" in `app/(marketing)/tc-utility-handoff-kit/page.tsx` 40, 61, 78 and `docs/growth/tc-utility-handoff-kit.md` 17.

Left alone: `PRD.md` 22, 219, 486 and `ANALYSIS.md` 34 (internal targets, not customer copy); "66 seconds" in `DemoVideoSection.tsx` (describes the video; its length was not checked); "in about a minute" in `from-a-closing` 175 (coordinator setup, a different claim, also unmeasured).

Changing a default message template changes what every account without a saved custom template sends. Saved custom templates are untouched.

## Item 4: product update (draft, waiting)

Draft entry for `lib/product-updates.ts` is in the report to the owner. On approval: add it as the first entry with a new timestamp constant, update `tests/unit/provider-incident-product-update.test.ts` to find the incident entry by id, and add a small test for the new entry. Adding the entry re-surfaces the dashboard banner for every customer once deployed, so it is a customer-visible publication that happens on deploy.

## Validation

- Focused: `tests/unit/admin-seller-progress.test.ts`, `tests/unit/admin-event-log-table.test.tsx`.
- Suites: Admin unit tests (`tests/unit/admin-*`), reminder tests (`seller-reminder-*`), product update tests.
- `npm exec tsc -- --noEmit`; ESLint on changed files.

## Outcome (2026-10-06)

Owner approved all recommendations: reports option B, reminders option B, the proposed wording for every time claim, and the product update draft.

- Reports: Seller Progress rows for reopened requests show a "Reopened" badge (`metered_at IS NOT NULL AND seller_edit_version > 0`). No count or report definition changed; the findings above still describe current behaviour.
- Reminders: option B implemented in `prepareSellerReminder` and the claim statement, with tests for the claim against the real schema and for the preview path. `ADMIN.md` and both decision records updated.
- Time claims: all 16 numeric claims and the 4 "a few minutes" lines changed as proposed. The trust strip item became "Sellers confirm suggested providers instead of typing" with a list icon.
- Product update: entry `reopen-submitted-request-for-seller` added first, dated 2026-10-06T17:00:00Z. The owner did not give a date, so the agent used the approval date; it can be changed before release. The incident test now finds its entry by id, and `tests/unit/reopen-product-update.test.ts` covers the new one.
- Validation: full Vitest 199 files passed, 1 skipped (1340 tests passed, 8 skipped); `tsc --noEmit` clean; ESLint on changed files shows only one existing error (`EventLogTable.tsx` `any`) and one existing warning (`TrustStrip.tsx` `<img>`); `git diff --check` clean; `security:scan` passed.
- Not verified: Playwright, `next build`, signed-in browser checks, the Seller Progress query on a real database, email rendering.
- Optional follow-up, not required: report option C if reopened requests become common; a reopen-specific reminder wording; the remaining soft claims listed under Item 3.
