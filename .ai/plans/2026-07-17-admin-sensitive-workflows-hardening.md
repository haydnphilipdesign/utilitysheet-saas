# Admin Sensitive Workflows Hardening Plan

## Status

Completed on 2026-07-17. All required implementation, documentation, focused validation, production build validation, and non-mutating authenticated browser QA are complete.

## Objective

Harden Customer Outreach, Product Updates, and Audit Logs so external communication, publishing, deletion, and other sensitive Admin writes require deliberate review, a documented reason, server authorization, audit evidence, and accessible feedback without changing production data or weakening `ADMIN_WRITES_DISABLED`.

## Verified Foundation

- `/admin/testimonial-candidates` currently exposes the first real outreach send as a direct button; only resends use a browser confirmation.
- Testimonial sends enforce Admin authorization, the write safety catch, recipient eligibility, send logging, and audit logging, but do not collect the Admin reason required by `ADMIN.md`.
- `/admin/updates` currently defaults the create form to published, combines creation and publication, deletes without confirmation, and does not collect reasons for create/delete audit entries.
- `createProductUpdate()` also defaults `isPublished` to `true`; no separate publish query/action exists.
- Audit Logs show action identifiers and metadata chips before a human-readable explanation. User agent and other technical fields dominate the default view, while action/date filtering and related-record links are limited.
- The worktree was clean at startup. `main` is at `480448a`, three local commits ahead of `origin/main`; all existing commits and unrelated generated/tracked artifacts must be preserved.

## Chosen Approach

Use focused client action components for review dialogs, reason collection, pending/error/success feedback, and keyboard focus while retaining all authoritative checks in server actions. Add small pure presentation/filter helpers for audit-log summaries and sanitization, and add narrow Neon query functions for draft creation, one-way publication, and delete-returning-record behavior. This keeps the change within existing route and data-model boundaries and does not require a migration.

Alternatives rejected:

- Native `window.confirm` and form submits remain too weak for previews, reasons, focus management, and clear pending/error states.
- A schema-heavy workflow/state-machine redesign would exceed the requested refinement and require migration/deployment coordination.

## Phase 1: Policy and Server Action Hardening

Status: Complete.

- Require `assertAdminActionReason()` for candidate outreach, test outreach, draft creation, publication, and deletion.
- Keep `requireAdmin()` and `assertAdminWritesEnabled()` before every mutation or external send.
- Make product-update creation unconditionally draft and add an idempotent publish query/action that only changes an unpublished update.
- Return the deleted update from the query so the audit record can identify what was removed.
- Include the reason and useful non-secret record fields in every relevant audit entry.
- Preserve testimonial recipient validation, resend gating, send-attempt logging, and provider idempotency support.
- Bind the server send to the recipient and exact message reviewed in the dialog; reject stale confirmations if either changed.

Acceptance criteria:

- No scoped write or outreach can bypass server authorization, the write safety catch, or the minimum reason rule.
- New updates are drafts even if a client submits a publish-like field.
- Publication is a separate, one-way, audited action; duplicate publication and duplicate UI submissions are handled safely.
- Audit metadata identifies the affected record and reason without storing new secrets.

## Phase 2: Customer Outreach and Product Update Review UX

Status: Complete.

- Rename Admin navigation and page language from Top Users/Testimonial Candidates to Customer Outreach, while preserving the route URL.
- Replace direct outreach sends with a dialog showing recipient, exact subject/message preview, candidate selection reasons, reason field, resend context, and explicit confirmation.
- Give test-to-self outreach the same reason, confirmation, pending, success, and failure pattern.
- Replace the Product Updates server-only form/actions with accessible client controls that create drafts and present update previews before publish/delete.
- Use visually distinct destructive styling only for the final delete confirmation; keep ordinary create/publish actions neutral or primary.
- Disable controls during pending operations, retain dialogs on failure, close/reset on success, and refresh server data only after success.

Acceptance criteria:

- External outreach cannot be sent from an unreviewed one-click action.
- Recipient, message, selection rationale, reason, and confirmation are visible before send.
- Draft creation, publish, and delete expose clear pending/error/success states and cannot be accidentally double-submitted.
- Dialog titles/descriptions, form labels, focus, buttons, and status text are accessible by name and keyboard.

## Phase 3: Audit Log Comprehension and Evidence

Status: Complete.

- Add human-readable action labels and per-action summaries using existing actor, target, and metadata fields.
- Make the timestamp prominent and show actor plus affected record with safe Admin links for users, requests, and Product Updates.
- Add accessible action, from-date, and through-date filters while preserving search and pagination.
- Show the Admin reason in the default evidence hierarchy when present.
- Move user agent, identifiers, and sanitized raw metadata into collapsed technical evidence.
- Redact values under secret-like keys from displayed metadata while preserving the database record unchanged.

Acceptance criteria:

- An operator can understand who did what, when, why, and to which record without opening raw JSON.
- Action/date filters round-trip through pagination and reject malformed date input safely.
- Technical evidence remains inspectable but does not dominate, and secret-like values are not rendered.

## Phase 4: Documentation, Tests, and Safe Validation

Status: Complete.

- Update `ADMIN.md` so the reason-and-audit convention explicitly covers outreach, Product Updates creation/publication/deletion, and narrowly states that no scoped exception remains.
- Add focused tests for server action enforcement/audit metadata, draft defaults/publication behavior, dialog previews/accessibility/pending states, audit summaries/sanitization/links, and date filters.
- Run focused Vitest files first, then task-scoped ESLint, full `npm run lint`, `npm exec tsc -- --noEmit`, `npm run build`, `git diff --check`, and direct secret-pattern inspection of new files.
- Use the available Browser workflow for non-mutating authenticated desktop QA. Open dialogs and exercise client validation only; do not confirm any real send, publish, delete, or production mutation. Cover the unavailable publish-dialog browser state through focused component tests rather than creating a real draft.
- Update this plan and `.ai/CURRENT.md` with exact results and remaining required versus optional work.

Acceptance criteria:

- Focused tests cover the sensitive action and presentation boundaries.
- Broader validation passes or precisely isolates unrelated baseline failures.
- Browser QA verifies page identity, meaningful render, no framework overlay, console health, dialog focus/naming, previews, and disabled confirmations without executing writes.
- No commit, push, deploy, migration, production-data change, real testimonial email, product publication, or deletion occurs.

## Final Validation

- Focused Vitest: 10 files, 34 tests passed, including policy/action enforcement, stale-preview rejection, provider idempotency, draft defaults, publish/delete confirmations, accessible dialogs, audit summaries, sanitization, and date parsing.
- Task-scoped ESLint passed. Full `npm run lint` remains blocked only by three pre-existing out-of-scope `no-explicit-any` errors in `app/invite/[token]/page.tsx`, `components/admin/EventLogTable.tsx`, and `components/email-verification-banner.tsx` (plus baseline warnings).
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- `git diff --check` passed. Direct secret-pattern inspection found only intentional dummy values in tests.
- Authenticated Chrome QA passed for Customer Outreach, Product Updates, and Audit Logs. Outreach and deletion remained disabled until both reason and explicit confirmation were present; no final action was submitted. Draft-only creation and readable/filterable collapsed audit evidence rendered correctly, with no console warnings/errors or framework overlay.
- Browser QA exposed an historical audit-label edge case: legacy `product_update_created` records with `is_published: true` are now presented as created-and-published, while new records remain draft-created.

No required work remains. Optional follow-up is limited to unrelated repository lint-baseline cleanup and any separately requested additional responsive/browser matrix coverage.

## Expected Files and Areas

- `.ai/CURRENT.md`
- `.ai/plans/2026-07-17-admin-sensitive-workflows-hardening.md`
- `ADMIN.md`
- `app/(admin)/layout-content.tsx`
- `app/(admin)/admin/testimonial-candidates/`
- `app/(admin)/admin/updates/`
- `app/(admin)/admin/audit-logs/page.tsx`
- `components/admin/TestimonialCandidatesTable.tsx`
- `components/admin/TestimonialOutreachActions.tsx`
- new focused Product Update and audit presentation components/helpers under `components/admin/` and `lib/admin/`
- `lib/admin/index.ts`
- `lib/admin/testimonial-outreach.ts`
- `lib/neon/queries/updates.ts`
- `types/index.ts`
- focused files under `tests/unit/`

## Constraints and Risks

- Preserve the three local commits ahead of `origin/main` and all unrelated work.
- Do not send real emails, publish/delete real updates, mutate production data, deploy, run a migration, commit, or push.
- Do not move authorization, reason validation, write-disable enforcement, eligibility checks, or audit guarantees into client-only code.
- Raw audit metadata can contain investigation evidence; sanitize only the rendered view and leave stored evidence unchanged.
- Browser QA must stop before final confirmation of any write.
