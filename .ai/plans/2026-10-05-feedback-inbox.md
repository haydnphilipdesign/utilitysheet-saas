# Plan: stored customer feedback and Admin feedback inbox

- Date: 2026-10-05. Owner request: improve the in-app feedback system for both the customer and the owner, and show feedback in Admin.
- Status: **completed 2026-10-05** (Claude Opus). Phases 1 and 2 are implemented and validated. On owner authorization the migration was applied to production, and the work was committed and pushed to `origin/main` the same day. See "Implementation outcome".
- Decision record: `.ai/decisions/2026-10-05-stored-feedback-and-admin-inbox.md`.

## Verified starting state

- `components/feedback-dialog.tsx`: one free-text box in the dashboard header.
- `app/api/feedback/route.ts`: authenticated, Zod-validated (1 to 2000 characters), no rate limit, sends one email through `sendFeedbackEmail`. Nothing is stored.
- `lib/email/email-service.ts` `sendFeedbackEmail`: interpolates the customer message and display name into HTML without escaping.
- If `FEEDBACK_EMAIL` is unset or the provider fails, the route returns 500 and the feedback exists nowhere.
- `tests/dialog-focus.spec.ts` depends on the trigger name `Send feedback`, the placeholder `Type your message here...`, initial focus on the textarea, and a `Send Feedback` submit button.
- Precedents reused: `question_requests` (capture route, table, read-only Admin page) and Operations triage (versioned, audited, reason-required Admin write).

## Scope

Phase 1 (fixes) and phase 2 (persistence and inbox) are implemented by this plan. Phase 3 is recorded but not implemented.

### Phase 1: fixes

1. Escape every customer-controlled value in the feedback email.
2. Rate limit `/api/feedback` per account (5 per 10 minutes).
3. Remove the hardcoded emerald submit colour (emerald is success-only in the design system).

### Phase 2: persistence, context, inbox

1. Table `feedback_submissions` (`migrations-feedback-submissions.sql`, mirrored in `schema.sql`): account, workspace, category, message, page path, viewport, user agent, notification email status, review status, private note, version.
2. Route stores the row first, then sends the email as a notification. Success means stored or emailed. If the table is missing (migration pending) the route still works as email-only.
3. Dialog: optional type (bug, idea, question), page path and viewport sent automatically and disclosed in the dialog, character limit, inline error that keeps the draft, analytics events without message text.
4. Admin page `/admin/feedback` (nav: Customers, "Feedback"): counts, status and type filters, newest 200, per-item status (new, reviewed, resolved) with an optional reason (required when first built, relaxed the same day by owner decision), optional private note, optimistic versioning and an audit entry in the same statement.
5. Account closure deletes the closing account's feedback rows.

### Phase 3: not implemented (optional follow-up)

- One-tap contextual prompts at high-signal moments (first completed packet, PDF download).
- An optional seller-side "Was this easy?" on the seller completion screen. This touches public capability-token routes and needs its own plan (rate limit, privacy, plan gating).
- Linking a published Product Update back to the feedback that asked for it.
- Screenshot attachment.

## Acceptance criteria

- A message containing HTML arrives in the notification email as text.
- A sixth submission inside 10 minutes from one account gets 429 and stores nothing.
- A submission is stored with server-resolved account and workspace ids; client-supplied ids are ignored; malformed page path or viewport is dropped, not rejected.
- Email failure with a stored row returns success and the inbox shows the failed notification.
- Missing table: submission still succeeds through email; the Admin page says the migration is pending and shows no controls.
- Admin status change requires Admin role, writes enabled and the version the operator saw (a reason is optional); the audit entry never contains the message or the note.
- The existing dialog focus contract (above) is unchanged.

## Validation

- Focused Vitest: route, dialog, email escaping, Admin status write on PGlite, Admin page and controls.
- `npm exec tsc -- --noEmit`, ESLint on changed files, full Vitest run, `npm run security:scan`.
- Playwright and authenticated browser checks are not run locally (same limit as the previous task: `.env.local` targets a live database and email key).

## Risks and release order

- **Run `migrations-feedback-submissions.sql` before deploying.** The feedback route and Admin page tolerate a missing table, but account closure runs `DELETE FROM feedback_submissions` inside its transaction and would fail until the table exists.
- Feedback text is customer free text and can contain personal details. It must not reach logs, analytics or AI providers.
- No migration is run, nothing is committed or deployed by this plan without owner authorization. (Authorized and done 2026-10-05; the migration ran before the push.)

## Implementation outcome (2026-10-05)

Built as planned, with these points worth knowing:

- The type buttons sit below the message box, not above it, so the textarea keeps initial focus and the existing Playwright focus contract holds without changing that spec.
- The submit button keeps the label `Send Feedback` and the default placeholder is unchanged for the same reason.
- Account closure uses a plain `DELETE FROM feedback_submissions` in its transaction, matching `question_requests`. A pre-check for a missing table was considered and not added; the release order above covers it.
- The audit entry sets `target_user_id` to the feedback author so the change appears against that account in Audit Logs.
- Feedback is not added to the customer data export (neither is `question_requests`).

Files. New: `migrations-feedback-submissions.sql`, `lib/feedback/constants.ts`, `lib/neon/queries/feedback.ts`, `lib/admin/feedback.ts`, `app/(admin)/admin/feedback/{page.tsx,actions.ts}`, `components/admin/FeedbackStatusControls.tsx`, `tests/unit/{feedback-route,feedback-email,admin-feedback-write}.test.ts`, `tests/unit/admin-feedback-ui.test.tsx`, the decision record. Modified: `app/api/feedback/route.ts`, `components/feedback-dialog.tsx`, `lib/email/{email-service,types}.ts`, `lib/rate-limit.ts`, `lib/validation/{schemas,admin-schemas}.ts`, `lib/analytics/events.ts`, `lib/neon/queries/{index,account-closure}.ts`, `lib/admin/audit-log-presentation.ts`, `app/(admin)/layout-content.tsx`, `schema.sql`, `ADMIN.md`, `docs/admin-operations-runbook.md`, `tests/unit/{feedback-dialog.test.tsx,account-closure-query.test.ts}`.

Validation (Node 20): `tsc --noEmit` clean; ESLint clean on every new and changed file; full Vitest 190 files passed, 1 skipped, 1202 tests passed, 8 skipped; `next build` with database, email and billing secrets blanked succeeded and lists `/admin/feedback`; `npm run security:scan` passed; new files checked directly for secret patterns; `git diff --check` clean. The status write is proven on PGlite from `schema.sql` with the migration applied on top (idempotent).

Not performed: Playwright (including `tests/dialog-focus.spec.ts`) and any authenticated browser or visual check, for the same reason as the previous task (`.env.local` targets a live database and email key, no Admin test credentials). No email was sent and no database was touched.
