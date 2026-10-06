# Current task: Read-only after submission with coordinator reopen, plus UX findings 2 to 9 (migrated, committed and pushed; post-deploy check pending)

- Date: 2026-10-06. Last agent: Claude Opus. Branch: main, committed as "Make submitted requests read-only with coordinator reopen and smooth the seller form" on top of 164ccb4 and pushed to `origin/main`. No concurrent work known. No ownership warnings.
- Status: implementation complete. On 2026-10-06 the owner authorized applying the migration and pushing to main; both were done, migration first. No required implementation work remains. Whether the push produced a healthy production deployment was not verified from here.
- Production migration applied 2026-10-06 by Claude Opus on explicit owner authorization: `migrations-seller-edit-sessions.sql`, 2 statements in one Neon HTTP transaction against the `.env.local` target (`neondb/public`, PostgreSQL 17.11, sanitized host fingerprint `79d6a988e446`, the same target as earlier recorded production migrations). Preflight: neither column existed. After: `seller_edit_version` (integer, not null, default 0) and `seller_submission_key` (text, nullable) present; all 972 requests at version 0 with no key; counts unchanged (160 accounts, 972 requests, 768 submitted, 3537 utility entries, 11022 events).
- Plan: `.ai/plans/2026-10-06-ux-form-logic-review.md` (outcomes and release section current). Decision: `.ai/decisions/2026-10-06-read-only-after-submission-and-reopen.md`. Amended: `2026-10-01-hoa-questions-in-home-basics.md`, `2026-10-05-seller-reminder-operations.md`.

## What was built

- One atomic statement stores a seller submission (request, provider rows, event) and only for the current editing session of a request that is not submitted: `lib/neon/queries/seller-submission.ts`. Emails, contact lookup, suggestion marking and credits run only after it is accepted.
- Editing sessions: `requests.seller_edit_version` rises on every reopen and close. Stale tabs get `STALE_SESSION` or `ALREADY_SUBMITTED`. A retry key (`requests.seller_submission_key`) makes a lost-response retry a no-op success within the same session only.
- Seller side: "Already submitted" screen; a reopened form opens on Review from the stored sheet; drafts carry the session number and older ones are discarded; no draft is kept after success; "Want a copy?" removed.
- Coordinator side: "Reopen for Seller" with stated consequences and "Close Without Changes" on the request page; `POST` and `DELETE /api/requests/[id]/reopen`, which read no body. Available on Free, Pro and Teams. No email is sent.
- Tightened: the generic status `PATCH` cannot enter or leave submitted; customer reminders and the seller return-link email refuse submitted requests; the seller `GET` returns no answers once submitted.
- Never changed by reopen or resubmission, enforced in SQL and covered by tests: property address, owner, workspace, tokens, `metered_at`, an existing lock. Locked and test-drive requests cannot be reopened.
- Findings 2 to 9 (provider answer keep and Review navigation, irrigation normalization, Review labels, Welcome copy, mobile sizing, info sheet link first, heating helper, meter step) are summarized under the previous task below.

## Validation before release (Node 22.22.2; CI uses 20)

- Full Vitest: 196 files passed, 1 skipped; 1304 tests passed, 8 skipped (18 against embedded PostgreSQL with the real schema and migration).
- Concurrency harness with two real connections on a disposable local PostgreSQL 18: all 20 checks passed, 8 new.
- `tsc --noEmit` clean. ESLint on changed files: 0 errors, 8 pre-existing warnings.
- Playwright, mocked APIs, Desktop Chrome and Mobile Chrome: 43 passed, 1 skipped by design.
- `git diff --check` clean; `security:scan` passed.

## Still open (owner)

1. Confirm the Vercel deployment of the pushed commit is healthy.
2. Smoke check on production with a test request: submit as the seller, reload the seller link (expect "Already submitted"), use "Reopen for Seller" on the request page, reload the seller link (expect Review with the stored answers), submit again, and confirm monthly usage did not rise. Also try "Close Without Changes" once.
3. If the deployment is unhealthy and has to be rolled back, the migration can stay: the earlier code ignores both columns.

## Not verified, and limitations

- The feature has not been exercised against the hosted database or in a signed-in browser (no fixture for the request page). Not run: Mobile Safari, real iPhone, screen readers, PDF output, `next build`.
- While reopened, the public info sheet and PDF are unavailable. A resubmission replaces the whole sheet.
- Admin reminders still refuse reopened (metered) requests. Two different requests can still both pass the Free limit check when submitted at the same moment (unchanged).
- Full list in the plan's Outcome sections.

## Next action

Owner confirms the deployment and does the smoke check above. Optional: a product update announcing reopen, Admin labels for the two new timeline events, a signed-in fixture so the request page can be browser-tested.

## Previous task: UX review findings 2 to 9 (completed, in the same commit)

- Date: 2026-10-06. Agent: Claude Opus. Branch: main at 164ccb4. No concurrent work known. No ownership warnings.
- Plan: `.ai/plans/2026-10-06-ux-form-logic-review.md`. See "Implementation plan: findings 2 to 9" with its "Outcome", and "Finding 1 proposal".
- Owner authorization (2026-10-06): implement findings 2 to 9 with Codex's qualifications. Finding 1 proposal only. Findings 10 and 11 deferred. No production queries, billing or entitlement changes, historical cleanup, migrations, commit, push, deploy, or real email. None of those were done.

## What changed

1. Irrigation (finding 3): a No answer keeps only the gate answer. One helper, `normalizeConditionalAdvancedAnswers` in `lib/packet/modules.ts`, applied after exclusion filtering and before the excluded-field merge in the seller `POST` and the coordinator `PATCH submitted-data`. Excluded stored fields are preserved, and a hidden stored No cannot erase visible answers. The wizard and editor keep the values in memory, so switching back to Yes restores them. The editor hides the detail fields while No.
2. Review (finding 4): handoff rows use question labels and format only coded fields (choice, weekdays, months). Free text and access codes are shown as typed. Fuel names use the question's labels.
3. Provider steps (finding 2): an existing answer is shown with "Keep this answer". An edit from a Review row returns to Review after its meter or trash screen. Editing Home Basics from Review visits only provider steps with no answer and handoff sections that edit enabled, then returns. Navigation mode and the pre-edit handoff list are saved in the draft; older drafts still restore.
4. Draft resume fix: applicable provider steps are now derived during render, so a draft saved on a later provider step resumes there instead of the first one.
5. Findings 5 to 9: Welcome makes no count or duration claim and the header shows "N of M" only after Home Basics; primary heat helper corrected in the form and inventory; 16px inputs and 44px targets on phones, focus rings, explicit labels, labelled choice groups, and the disabled-Continue reason repeated at the button; submitted requests lead with "Copy Info Sheet Link"; the meter screen has one Continue and the Review field stays editable.

## Validation (Node 22.22.2; CI uses 20)

- Full Vitest: 192 files passed, 1 skipped; 1242 tests passed, 8 skipped.
- `tsc --noEmit` clean. ESLint on all changed and new files: 0 errors, 8 pre-existing warnings.
- Playwright with mocked APIs on Desktop Chrome and Mobile Chrome (seller flow, wizard journey, new review-edit spec, saved-form preview, intake): 37 passed, 1 skipped by design.
- `git diff --check` clean.

## Not done or not verified

- Finding 1 was implemented afterwards; see the current task above.
- Not run: Mobile Safari, a real iPhone, screen readers, PDF output, the signed-in dashboard in a browser, `next build`.
- The request detail change (finding 7) has no automated test; no signed-in fixture exists for that page.
- Packet and PDF still print handoff codes with their own formatting; only Review was changed.
- Stored sheets that already hold irrigation No plus details are untouched until a coordinator next saves them.

## Previous task: HOA-first seller flow (completed, committed)

- Date: 2026-10-06. Agent: Codex. Committed as 164ccb4 "Ask HOA membership first and reconcile billing choices" (verified 2026-10-06: worktree clean; the earlier note describing these as uncommitted local changes was stale). Push and deployment state not verified from here.
- Plan: `.ai/plans/2026-10-06-hoa-first-flow.md` completed. Decision amendment: `.ai/decisions/2026-10-01-hoa-questions-in-home-basics.md`.
- Membership question is first when enabled; contact/dues fields remain below core basics with their own heading. Only explicit No hides water/sewer HOA billing choices. Yes never auto-selects billing; unanswered/Not Sure/disabled keep choices.
- Conflicting choices are cleared, explained, and must be reselected (Not Sure is valid). Draft-only pending markers survive autosave, return conflicting resumed drafts to Home Basics, and are omitted from submissions. Corrected public choices reach provider steps.
- Changed: `components/seller-form/SellerWizard.tsx`, `components/seller-form/steps/HomeBasicsStep.tsx`, `lib/packet/seller-questions.ts` (inventory order/help), `tests/unit/seller-wizard-hoa-flow.test.tsx`, `tests/saved-seller-forms.spec.ts` (new mocked preview test), plan/decision/current docs.
- Validation: 57 focused unit tests across HOA/advanced wizard and inventory/dialog passed; two new preview Playwright cases passed Desktop Chrome and Mobile Chrome. TypeScript passed. Focused ESLint: zero errors, six existing hook warnings in SellerWizard. Diff check passed. Initial test issues fixed and relevant checks rerun.
- Runtime: Node 22.22.2 on PATH (CI uses 20). No API/schema/PDF changes, live writes, commit, push, deployment or migrations.
- The preview sizing/subtitle changes in SellerLayout, FormEditor, FormsWorkspace and the saved-form browser assertions were included in the same commit.
- No required work remains for that task.

## Previous task: Seller forms preview desktop and tablet sizing (completed)

- Date: 2026-10-06. Agent: Codex. Branch: main. No concurrent editing known.
- Fixed `FormEditor.tsx`: use `sm:max-w-4xl` to override DialogContent's `sm:max-w-sm`, preserving its mobile viewport margin.
- `SellerLayout.tsx` now clips decorative gradients within their background layer, eliminating horizontal overflow and focus-induced sideways scrolling.
- Root cause: the default desktop breakpoint cap squeezed four-column seller choices into a narrow modal.
- Added geometry/overflow assertions to the existing saved-form preview Playwright flow in `tests/saved-seller-forms.spec.ts`.
- Prior requested subtitle update in `FormsWorkspace.tsx` remains uncommitted and preserved.
- Validation: focused saved-form Playwright passed on Desktop Chrome and Mobile Chrome; fixture screenshots reviewed at 1440x1000, 1024x1366 and 412x915. No page errors; buttons remain readable and all three have zero horizontal overflow. TypeScript passed; focused ESLint passed with two existing img warnings in SellerLayout; git diff --check passed.
- Browser plugin not available; using repository Playwright with development-only fixture and mocked APIs (no live writes).
- Runtime available on PATH: Node 22.22.2 (CI uses 20).
- No required work remains. Next action: owner review of local changes. No commit, push, deployment or database actions authorized/performed.

## Previous task context: Stored customer feedback, Admin feedback inbox, and optional Admin reasons (migrated, committed and pushed; post-deploy check pending)

- Date: 2026-10-05. Last agent: Claude Opus. Branch: main, committed as "Store customer feedback, add an Admin feedback inbox, and make low-risk Admin reasons optional" on top of 3af4b56 and pushed to `origin/main`.
- Status: **implementation complete. On 2026-10-05 the owner authorized running the migration, committing and pushing to main; all three were done.** No required implementation work remains. Whether the push produced a healthy production deployment was not verified from here.
- Production migration applied 2026-10-05 by Claude Opus on explicit owner authorization: `migrations-feedback-submissions.sql`, 4 statements in one Neon HTTP transaction against the `.env.local` target (`neondb/public`, sanitized host fingerprint `79d6a988e446`, the same target as earlier recorded production migrations). Preflight: the table did not exist. After: table present with its primary key and 3 indexes, zero rows, existing counts unchanged (160 accounts, 970 requests).
- Plan: `.ai/plans/2026-10-05-feedback-inbox.md` (status and "Implementation outcome" are current).
- Decision records: `.ai/decisions/2026-10-05-stored-feedback-and-admin-inbox.md`, `.ai/decisions/2026-10-05-optional-admin-reasons.md`.
- No concurrent editing is known. No ownership warnings are active.

## What was built

1. **Fixes.** The feedback notification email escapes every customer-controlled value (it previously interpolated raw HTML). `/api/feedback` is rate limited to 5 per 10 minutes per account. The dialog's hardcoded emerald submit colour is gone.
2. **Stored feedback.** New table `feedback_submissions`. The route stores the row first and emails second; it succeeds if either worked, and records whether the email notice was sent. A missing table falls back to email only.
3. **Context.** Optional type (bug, idea, question), page path without query string, viewport and user agent. The dialog discloses that page and screen size are included. Account and workspace come from the server session.
4. **Dialog UX.** Type buttons below the message, character counter near the limit, inline error that keeps the draft, a clearer rate-limit message, and analytics events (`feedback_dialog_opened`, `feedback_submitted`) that never carry the text.
5. **Admin inbox** at `/admin/feedback` (nav: Customers, "Feedback"): counts, status and type filters, newest 200, link to the user, plan badge, failed-email flag, and a per-item status (new, reviewed, resolved) with optional reason, optional private note, optimistic version and same-statement audit entry (`feedback_status_changed`).
6. **Account closure** deletes the closing account's feedback rows.
7. `ADMIN.md` and `docs/admin-operations-runbook.md` updated.
8. **Optional Admin reasons (owner decision, same day).** The owner runs the product alone and asked not to type reasons for his own work. The reason is now optional for Product Update draft, publish and delete, Operations triage, and feedback status. It is still required for customer-affecting writes (role, ban, entitlement, request status, seller contact, reminders, reconciliation, testimonial outreach). Audit entries are unchanged apart from an absent `reason` key, and the Product Update publish and delete confirmation checkbox stays. `AGENTS.md` and `ADMIN.md` guardrail wording was updated to match.

## Files changed (all committed)

New: `migrations-feedback-submissions.sql`, `lib/feedback/constants.ts`, `lib/neon/queries/feedback.ts`, `lib/admin/feedback.ts`, `app/(admin)/admin/feedback/{page.tsx,actions.ts}`, `components/admin/FeedbackStatusControls.tsx`, `tests/unit/{feedback-route,feedback-email,admin-feedback-write}.test.ts`, `tests/unit/admin-feedback-ui.test.tsx`, the plan and the decision record.

Modified: `app/api/feedback/route.ts`, `components/feedback-dialog.tsx`, `lib/email/{email-service,types}.ts`, `lib/rate-limit.ts`, `lib/validation/{schemas,admin-schemas}.ts`, `lib/analytics/events.ts`, `lib/neon/queries/{index,account-closure}.ts`, `lib/admin/audit-log-presentation.ts`, `app/(admin)/layout-content.tsx`, `schema.sql`, `ADMIN.md`, `docs/admin-operations-runbook.md`, `tests/unit/{feedback-dialog.test.tsx,account-closure-query.test.ts}`.

For optional reasons: `lib/validation/admin-schemas.ts` (`adminOptionalReasonSchema`), `lib/neon/queries/admin-writes.ts`, `lib/ops/triage.ts`, `lib/admin/feedback.ts`, `app/(admin)/admin/{updates,operations,feedback}/actions.ts`, `components/admin/{AdminActionReasonField,ProductUpdatesAdmin,TriageControls,FeedbackStatusControls}.tsx`, `AGENTS.md`, `ADMIN.md`, and tests `product-updates-admin`, `admin-operations-ui`, `ops-instrumentation`, `admin-writes`, `admin-feedback-ui`, `admin-feedback-write`.

## Validation performed (2026-10-05, Node 20)

- `tsc --noEmit`: clean. ESLint on all new and changed files: clean (the one error in the Admin folders is the pre-existing `components/admin/EventLogTable.tsx`).
- Full Vitest after the optional-reason change: 190 files passed, 1 skipped; 1207 tests passed, 8 skipped (the skipped file is unrelated).
- `next build` with `DATABASE_URL`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` blanked: succeeded for the feedback work. It was not rerun after the optional-reason change (type-check and tests were).
- `npm run security:scan`: passed. New files checked directly for secret patterns: none. `git diff --check`: clean.

## Not performed

- **Playwright and any authenticated browser or visual check.** `.env.local` targets a hosted database with a live email key and there are no Admin test credentials. `tests/dialog-focus.spec.ts` covers the feedback dialog; its contract (trigger name, default placeholder, initial textarea focus, `Send Feedback` button) was preserved by design but the spec was not run.
- No email was sent. The only database action was the migration above.

## Release steps

Done 2026-10-05 on owner authorization: production migration, commit, push to `origin/main`. The migration ran before the push, so account closure never saw the code without the table.

Still open (owner):

1. Confirm the Vercel deployment of the pushed commit is healthy.
2. Send one piece of feedback from the dashboard, confirm the email arrives with escaped content and the item appears at `/admin/feedback`, then mark it reviewed (no reason needed) and check the entry in Audit Logs.
3. Confirm `FEEDBACK_EMAIL` is set in the deployment. Without it feedback is stored but no notice is sent (the inbox flags this).

## Open owner decisions

- Two customer emails are tracked in git: `New Feedback from Jimena Szychowski.html` (repo root) and the Alisha Starkey email under `user-feedback/`. Removing the files would still leave them in history. Not touched.

## Still open from the previous task (Admin operational readiness, commit bed7e78 and 3af4b56)

Plan `.ai/plans/2026-10-05-admin-operational-readiness.md`, runbook `docs/admin-operations-runbook.md`.

- Confirm the Vercel deployment is healthy and do the smoke checks (runbook 5.4).
- Authenticated browser verification (runbook 5.6) was skipped by owner decision.
- Owner reported the Resend webhook and `OPS_*` variables are set in Vercel (not verified from here). No external uptime probe exists.
- Owner-only checks: provider MFA and recovery (runbook 3), recovery rehearsal (runbook 4).

## Risks and things to verify, not assume

- Whether `.env.local` points at production or a development branch is unknown; treat it as live.
- Feedback text is sensitive free text: keep it out of logs, analytics, audit metadata and AI calls.
- Reasons are optional only for Product Updates, triage and feedback status. Whether to relax them for customer-affecting writes too was offered to the owner and is undecided; do not relax those without his say.

## Optional follow-up (not required)

- Phase 3 of the plan: contextual one-tap prompts, an optional seller-side "Was this easy?" (public capability-token route, needs its own plan), linking Product Updates to feedback, screenshots.
- Pagination and search in the inbox; a "new feedback" count on the Admin overview.
- Add feedback and requested questions to the customer data export.
- Earlier optional items (pre-existing lint errors, concurrency harness in CI, marketing follow-ups) are unchanged.

## Next action

Owner confirms the deployment and does the post-deploy feedback check above.
