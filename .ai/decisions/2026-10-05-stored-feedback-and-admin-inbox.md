# Customer Feedback Is Stored First and Emailed Second, and Reviewed in Admin

Date: 2026-10-05. Status: Accepted (implemented under `.ai/plans/2026-10-05-feedback-inbox.md`; migration applied to production and code pushed to `origin/main` on 2026-10-05).

## Context

Dashboard feedback was a single text box that sent one email and stored nothing. A missing `FEEDBACK_EMAIL` or a provider failure lost the message. The owner tracked feedback by saving emails as files and could not see it in Admin, sort it, or tell which page a customer was on.

## Decision

1. **The database row is the record; the email is a notification.** `/api/feedback` inserts into `feedback_submissions` and then emails `FEEDBACK_EMAIL`. The request succeeds if either succeeded. Each row records whether its notice was sent.
2. **Storage failure falls back to email.** A missing table (migration pending) or a database error does not cost the customer their message.
3. **Context is captured automatically and disclosed.** Page path (no query string or fragment), viewport and user agent are stored with an optional type (bug, idea, question, default general). The dialog tells the customer the page and screen size are included. Malformed context is dropped, never a reason to reject the message. Account and workspace come from the server session only.
4. **Review state lives on the row**, not in `admin_triage_items`: `new`, `reviewed`, `resolved`, a private note, a version, and who changed it. Feedback is a customer record with its own lifecycle, while triage items are keyed to derived Operations signals and can recur.
5. **Admin status changes follow the Admin write rules**: Admin role checked in the statement, optimistic version, and the audit entry written in the same statement. The reason is optional (`.ai/decisions/2026-10-05-optional-admin-reasons.md`). The audit entry holds ids and statuses only, never the message or the note.
6. **Feedback text is sensitive free text.** It must not reach logs, analytics events, audit metadata or AI provider calls. Analytics events for the dialog carry only the type and success.
7. **Account closure deletes the account's feedback.** Closure tombstones the account row instead of deleting it, so the foreign-key cascade does not fire and the delete is explicit in the closure transaction.

## Alternatives considered

- **Keep email only and add fields to the email.** Rejected: still no durable record, no sorting, and a provider failure still loses the message.
- **Reuse `admin_triage_items` with a `feedback:<id>` key.** Rejected: it would need the kind constraint widened and would put customer-record state in a table designed for derived, recurring signals.
- **A third-party feedback widget.** Rejected for now: new provider, new cost, and customer text leaving the product for something a small table covers.
- **A required reason for marking feedback reviewed.** Built first, then reversed the same day at the owner's request.

## Consequences

- `migrations-feedback-submissions.sql` must be run before the code is deployed, because account closure deletes from the table inside its transaction. The feedback route and Admin page tolerate a missing table.
- Feedback is not included in the customer data export, matching `question_requests`. Add both together if the export is extended.
- The inbox shows the newest 200 rows with status and type filters. Pagination and search are not built.
- Seller-side feedback, contextual prompts, and linking Product Updates to feedback are not part of this decision.
