# Submitted Requests Are Read-Only Until a Coordinator Reopens Them

- Status: Accepted
- Date: 2026-10-06
- Decision owner: Product owner, recorded by Claude Code
- Related plan: `.ai/plans/2026-10-06-ux-form-logic-review.md` ("Finding 1 implementation plan")
- Amends: `2026-10-01-hoa-questions-in-home-basics.md` (seller resubmission), `2026-10-05-seller-reminder-operations.md` (customer reminders on submitted requests)

## Context

The seller form told sellers the link was read-only after submission, and marketing copy said the same, but the server accepted any later submission and replaced the whole sheet, including coordinator corrections. A second device opened a blank form. The write was several separate statements, so a failure could leave a request marked submitted with providers missing.

## Decision

1. A submitted request is read-only for the seller link. The seller form shows an "Already submitted" screen and the server refuses a submission.
2. An authorized coordinator can reopen a submitted request, on every plan. The seller then starts from the stored sheet and submits again. Reopening sends no email.
3. Resubmitting never uses another monthly submission: `metered_at` is set once and never cleared.
4. Reopen and resubmission never change the property address, owner, workspace, tokens, question configuration, or an over-limit lock. A locked sheet and a test-drive request cannot be reopened. A different property needs a new request.
5. Direct coordinator editing of a submitted sheet is unchanged and stays a Pro and Teams capability.
6. A coordinator can close a reopened request without changes, restoring the sheet as it was.
7. Each reopen or close starts a new editing session, recorded as `requests.seller_edit_version`. A submission is accepted only for the current session. Local drafts and retry keys are tied to the session.
8. Seller submission is one atomic statement, and emails, contact lookup and credits run only after it is accepted.
9. Customer reminders are refused for a submitted request. The generic request status update can no longer move a request into or out of submitted.

## Rationale

- Read-only matches what the product already promised, and protects coordinator corrections.
- Reopen gives Free customers a correction path without touching the paid editor or using another submission.
- The session number lives on the request row because the submission locks that row; a value read from another table could be out of date after waiting for the lock.

## Alternatives considered

- Final with no reopen: a Free customer could only correct by sending a new request, which uses another submission.
- Seller may always resubmit with prefill: withdraws the read-only promise and lets a seller replace coordinator edits unasked.
- Session number derived from reopen events: no migration, but a submission racing a reopen could be accepted against the old count.

## Consequences

- Requires `migrations-seller-edit-sessions.sql` before the code is deployed.
- While a request is reopened its public info sheet and PDF are unavailable, because they require a submitted request.
- A resubmission replaces the whole sheet, so a provider recorded under a utility the form does not ask about for that home is not carried through.
- A reopened request is in progress and already metered. Admin reminders still refuse metered requests; coordinator reminders work.
- Admin status correction can restore a metered in-progress request to submitted, which also closes a reopen.
- The seller link returns the stored answers while a request is reopened, as it already did for HOA and handoff answers. Secrets must not be added to seller-visible answers.
