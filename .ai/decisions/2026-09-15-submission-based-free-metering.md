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
- Two simultaneous submissions at one slot remaining can both stay unlocked (known race, not addressed).
