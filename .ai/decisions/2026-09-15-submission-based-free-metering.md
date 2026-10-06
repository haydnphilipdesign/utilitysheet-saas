# Free Plan Usage Counts Seller Submissions

Date: 2026-09-15. Status: Accepted (owner approved).

## Context

Free accounts get 3 requests per month. Dashboard-created requests were metered (`requests.metered_at`) at creation, so requests a seller never answered used a slot, and Free creation was hard-blocked at the limit. Reusable-link requests were metered on submission and locked when over the limit, but intake start also blocked at the limit. A customer asked how to delete an unanswered request, which exposed both the missing delete control and the unfair metering.

## Decision

- `metered_at` marks a counted seller submission. Only `POST /api/seller/[token]` sets it. Creation and owner status changes never meter.
- Monthly usage counts metered, unlocked, non-demo requests by `metered_at` month, including soft-deleted ones. It does not read `status`, which owners can PATCH.
- Free request creation (dashboard and reusable link) is never blocked by the monthly limit. A Free submission when usage is already at the limit is saved with `is_locked = TRUE`, `locked_reason = 'monthly_limit'` and shown behind the upgrade prompt. Locked submissions do not count.
- Deleting an unmetered request hard-deletes it. Deleting a metered request soft-deletes it and it keeps counting, preventing download-delete-repeat abuse.

## Alternatives rejected

- Keep metering at send and refund on delete: lets users delete submitted requests to reset usage.
- Count by `status = 'submitted'`: status is owner-mutable through `PATCH /api/requests/[id]`.

## Consequences

- Existing never-submitted metered rows are cleared by `migrations-requests-submission-metering.sql`, run after deploy.
- Admin activity windows and testimonial counts that read `metered_at` now reflect submissions.
- A request sent in one month and submitted in the next counts in the submission month.
- Two simultaneous submissions at one slot remaining could both stay unlocked. Addressed 2026-10-06; see the amendment below.

## Amendment 2026-10-06: the limit is decided where the submission is stored

Owner approved (plan `.ai/plans/2026-10-06-free-limit-submission-race.md`, Option B).

- The seller route no longer reads usage. `submitSellerRequest` runs two statements in one transaction: a per-owner `pg_advisory_xact_lock`, then the submission statement, which reads the plan and the month's count and decides the lock on the locked request row.
- The lock must be a separate first statement. A single statement counts from one snapshot, so two submissions for different requests would not see each other. Do not merge the two statements or raise the isolation level above READ COMMITTED.
- The month is the UTC calendar month, now stated explicitly in SQL and in `getMonthlyUsage` (previously inherited from the server time zone, which is UTC in production).
- The limit is `FREE_MONTHLY_SUBMISSION_LIMIT` in `lib/constants.ts`, still 3.
- Submissions in a workspace that is on Team do not count toward the owner's Free usage (owner decision, same day). Every account has its own workspace and can also be a member of a Team workspace; before this, a member's Team sheets used up the Free allowance of their own workspace. The check uses the workspace's plan at the time of counting, so if a Team workspace stops being on Team during the month, its sheets from that month count again.
- Unchanged: the count is otherwise owner-wide across workspaces, soft-deleted rows count, locked rows do not, sheets submitted while the account was on Pro count after a downgrade in the same month, and a paid viewer sees locked sheets at read time. No migration.
- Rejected: counting inside one statement without the lock (narrows the race, does not close it); a usage counter table (migration and a second source of truth).
