# Self-Serve Test UtilitySheet Implementation Plan

> **For agentic workers:** Implement task-by-task with focused tests before production code. Preserve the completed live-schema handoff artifacts already present in the worktree. Do not commit, push, deploy, run migrations, send production email, or modify production data without separate authorization.

**Goal:** Let an eligible authenticated user start or resume one branded fictional UtilitySheet, complete the real seller flow, receive and review the real completion output at their own verified email, and then return to placing their reusable seller link in the real workflow.

**Architecture:** Add a narrow authenticated test-drive API and request-query helper rather than accepting demo identity or recipients through the general request endpoint. Create-or-resume is serialized with a transaction-scoped account advisory lock and uses existing request tokens, Branding Profile, intake defaults, seller submission persistence, packet data, and production PDF renderer. `requests.is_demo` is the durable switch for every quota, operational-reporting, notification, referral, and acquisition boundary; delivery outcome is persisted in existing event logs, so no schema change is required.

**Tech stack:** Next.js App Router, React, TypeScript, Neon Postgres, Stack Auth, Zod, Resend, production Chromium PDF pipeline, Vitest/Testing Library, Playwright.

**Status:** Completed (2026-07-21, OpenAI Codex).

---

## Verified starting state

- `requests.is_demo` exists in `schema.sql` and `migrations-onboarding-demo.sql`; no new migration is expected.
- `/api/requests` currently accepts client-supplied `isDemo`, bypasses monthly usage, and permits client-selected seller identity/recipient. This is not the safe boundary for the self-serve experience.
- `getMonthlyUsage`, activation funnel, testimonial candidates, and referral-credit SQL already exclude demos.
- Customer request lists, dashboard stats, weekly stats, activation outreach counts, provider memory, Branding Profile usage counts, admin seller-progress reporting, and admin latest-request summaries do not all exclude demos yet.
- Seller submission currently meters/locks unmetered requests, schedules referral credit, can notify workspace admins, can send contact-resolution alerts, and can render acquisition/referral paths. Those branches must become demo-aware without changing non-demo behavior.
- Completion email already calls the production PDF attachment renderer but does not expose attachment failure separately from email success.
- Onboarding and dashboard already center the reusable seller link. The test drive will be a secondary confidence-building card, not a prerequisite or replacement for `/demo`.

## Product and technical decisions

1. **Eligibility is server-derived per account.** An account is eligible only while it has no submitted, non-deleted, non-demo request. Existing demo state is scoped to the authenticated account; organization membership never grants another member access to the test-drive state endpoint.
2. **One demo per account, no migration.** A Neon transaction first takes `pg_advisory_xact_lock(hashtext(account_id))`, then conditionally inserts only when no demo exists and no live submission exists, and finally selects the canonical demo. Repeated/concurrent POSTs return the same request.
3. **Fictional data is fixed server-side.** Use `[TEST] 123 Maple Street, Anytown, PA 18301` and `UtilitySheet Test Seller`; set seller email to the caller's verified Stack Auth `primaryEmail`; never accept a request body recipient or identity.
4. **Workspace defaults are real.** Use the active organization, intake link's default Branding Profile/categories/packet configuration, and current plan gating. Fall back to the active default Branding Profile and simple packet defaults.
5. **Creation email is at-most-once.** Only the transaction result marked newly created sends the test seller link. Existing/resumed/completed POSTs never resend it; a send failure leaves the direct resumable link available.
6. **Demo submission is production persistence with isolated effects.** Keep seller-token validation, rate limiting, utility persistence, event logging, packet rendering, and PDF generation. Do not quota-lock or meter demos as usage, schedule referral credit, resolve provider contacts, notify workspace admins, send contact-resolution alerts, or render referral/acquisition CTAs.
7. **Completion delivery is explicit.** Demo submission sends one test-labeled completion email with required PDF attachment to the initiating account email regardless of notification preferences. Email/PDF outcome is written to an existing event log. A failure never rolls back the submitted request and the dashboard continues to expose direct review/download paths.
8. **Demo output stays visibly fictional.** The `[TEST]` address flows through seller, email, web packet, and PDF; seller/web packet also receive explicit test messaging. The generic public `/demo` remains unchanged.
9. **Operational data excludes demos by default.** Customer request lists/stats/attention, weekly summaries, activation outreach, provider memory, Branding Profile usage counts, admin seller-progress/abandonment, and admin latest-request summaries must add `COALESCE(is_demo, FALSE) = FALSE`. Direct token/id lookups remain available for the test flow and review.
10. **Analytics contains only funnel metadata.** Add typed offer-viewed, started, opened/resumed, completed, and post-completion seller-link-action events with `source`/state fields only; never include IDs, tokens, addresses, names, or email.

## Phase 1: Safe server contract and query layer

**Expected files**

- Create `lib/test-drive/types.ts`
- Create `lib/test-drive/service.ts`
- Create `app/api/test-drive/route.ts`
- Modify `lib/neon/queries/requests.ts`
- Modify `lib/neon/queries/event-logs.ts`
- Modify `lib/neon/queries/index.ts`
- Modify `lib/validation/schemas.ts`
- Modify `app/api/requests/route.ts`
- Modify `types/index.ts`
- Add `tests/unit/test-drive-route.test.ts`
- Add `tests/unit/test-drive-request-query.test.ts`
- Update request-route tests affected by removal of client-controlled demos

**Steps**

- [x] Add failing route tests for unauthenticated access, missing verified email, server-derived recipient/fictional data, account isolation, live-submission ineligibility, unfinished resume, completed state, at-most-once invitation send, and failure-safe creation.
- [x] Add failing query tests proving the transaction lock, non-demo submitted eligibility predicate, single demo predicate, account scope, active organization persistence, `is_demo = TRUE`, and non-metered usage behavior.
- [x] Implement `TestDriveState` response types with `eligible`, `ready`, `completed`, and `ineligible` variants plus safe `sellerUrl`, `reviewUrl`, `pdfUrl`, and delivery status fields as appropriate.
- [x] Implement the transactional get-or-create query and latest delivery-event lookup.
- [x] Implement GET/POST `/api/test-drive` using `stackServerApp`, `ensureAccountActivation`, verified `primaryEmail`, current intake/default Branding Profile configuration, rate limiting, fictional constants, and at-most-once invitation email.
- [x] Remove `isDemo` from the general request schema/route and the stale manual-request onboarding branch so client-controlled demo creation can no longer select arbitrary recipients.
- [x] Run focused route/query/request regression tests until green.

**Acceptance criteria**

- Concurrent or repeated starts return one request and send at most one invitation.
- The only stored/sent recipient is the authenticated caller's verified email.
- A live submission makes a not-yet-started account ineligible.
- Monthly usage enforcement for normal requests is unchanged; test creation does not consult or consume the limit.

## Phase 2: Demo-safe seller submission and deliverables

**Expected files**

- Modify `app/api/seller/[token]/route.ts`
- Modify `lib/email/email-service.ts`
- Modify `lib/packet/packet-data.ts`
- Modify `app/packet/[token]/page.tsx`
- Modify `lib/pdf/packet-html.ts` only if explicit PDF labeling is not sufficiently guaranteed by packet data/address labeling
- Modify `app/s/[token]/page.tsx`
- Modify `components/seller-form/SellerWizard.tsx`
- Add/update focused seller-submission, email/PDF, packet-data, packet-page, and seller-flow tests

**Steps**

- [x] Add failing tests that a demo cannot be overage-locked, cannot schedule referral credit, cannot resolve contacts, cannot notify admins, cannot send contact-resolution messages, cannot include referral footers/program CTAs, and only sends completion to the owner email with a required production PDF attempt.
- [x] Add failing tests that repeat POST after demo submission is idempotent and does not resend completion.
- [x] Return `is_demo` from seller GET and render a real-flow test banner without using the generic fake `/demo` bypass.
- [x] Branch seller submission on `request.is_demo`: preserve core writes/events, skip external side effects, force owner-only completion delivery, and persist `test_drive_delivery_succeeded` or `test_drive_delivery_failed` after the saved submission.
- [x] Extend completion email results with attachment outcome and add test-specific subject/body/link treatment; preserve existing defaults for normal submissions.
- [x] Add `meta.is_demo` to packet data, null its referral code, hide transaction-referral CTA for demos, and render explicit test context on the web packet. Keep the production PDF renderer and branded packet data.
- [x] Run focused seller/email/PDF/packet regressions until green.

**Acceptance criteria**

- Demo persistence and PDF rendering use production paths, while every unrelated notification/acquisition/referral branch is off.
- A send or PDF failure leaves the request submitted and directly reviewable.
- Normal seller submissions retain current recipients, preferences, contact resolution, referral behavior, and content.

## Phase 3: Shared onboarding/dashboard experience and analytics

**Expected files**

- Create `components/test-drive/TestDriveCard.tsx`
- Modify `app/onboarding/page.tsx`
- Modify `app/dashboard/page.tsx`
- Modify `lib/analytics/events.ts`
- Add `tests/unit/test-drive-card.test.tsx`
- Update `tests/unit/onboarding-branding.test.tsx`
- Update `tests/unit/dashboard-reusable-link.test.tsx`

**Steps**

- [x] Add failing component/page tests for loading, eligible, creating, ready/resume, completed/review, delivery-failed, ineligible, and recoverable-error states.
- [x] Implement the shared card with accessible status announcements, minimum touch targets, safe new-tab behavior, retry state loading, and responsive no-overflow layout.
- [x] Place it below the primary reusable-link action on onboarding and in the first-run dashboard hierarchy; preserve the reusable link as the primary workflow.
- [x] After completion, provide review/PDF actions and a next-step action to copy the reusable seller link for a listing email/checklist/template.
- [x] Add typed analytics: `test_drive_offer_viewed`, `test_drive_started`, `test_drive_opened`, `test_drive_completed`, and `test_drive_seller_link_copied`, limited to non-sensitive source/state properties.
- [x] Run focused component/page/analytics tests until green.

**Acceptance criteria**

- Both surfaces expose the same resumable state and remain usable at approximately 390px, 768px, and 1440px.
- The test is secondary, optional, clearly fictional, and leads back to the reusable seller link.
- Analytics types cannot accept request identity, property, token, or recipient payloads.

## Phase 4: Operational/reporting exclusions

**Expected files**

- Modify `lib/neon/queries/requests.ts`
- Modify `lib/neon/queries/activation-outreach.ts`
- Modify `lib/neon/queries/provider-memory.ts`
- Modify `lib/neon/queries/brand-profiles.ts`
- Modify `lib/admin/index.ts`
- Modify `app/(admin)/admin/abandonment/page.tsx`
- Add/update focused query and source-guard tests

**Steps**

- [x] Add failing SQL/source tests for request list/count parity, dashboard/weekly stats, Needs Attention, activation outreach, provider memory, Branding Profile usage, admin latest requests, and seller-progress/abandonment.
- [x] Add `COALESCE(is_demo, FALSE) = FALSE` to each operational/reporting scope while leaving direct authenticated/capability lookups intact.
- [x] Confirm already-correct activation, habitual-use, testimonial, referral-credit, and referral-loop SQL remains protected by regression tests.

**Acceptance criteria**

- A demo cannot appear as normal work, overdue work, recent submission, abandonment, provider memory, profile usage, activation, habit, proof, or referral value.
- Non-demo records produce the same results as before.

## Phase 5: End-to-end validation and handoff

- [x] Run focused Vitest while implementing.
- [x] Run relevant request, seller-submission, email/PDF, notification, referral, activation, dashboard, onboarding, packet, and reporting regressions.
- [x] Run changed-file ESLint.
- [x] Run `npm exec tsc -- --noEmit`.
- [x] Run `npm run build`.
- [x] Run safe local desktop/mobile browser QA at approximately 390px, 768px, and 1440px without real email or shared production data. Add a focused Playwright journey only if the local auth/email fixtures make it reliable.
- [x] Run `git diff --check`.
- [x] Inspect every new file directly for secrets, tokens, credentials, private data, and accidental real recipient/property values.
- [x] Mark this plan completed and update `.ai/CURRENT.md` with exact results, limitations, and required versus optional follow-up.

## Completion evidence

- Full Vitest: 119 files passed after one timing-sensitive new assertion was made deterministic.
- Final focused safety/regression set: 7 files, 38 tests passed.
- Changed-file ESLint: 0 errors; 12 pre-existing warnings in touched packet/seller components.
- TypeScript: `npm exec tsc -- --noEmit` passed.
- Production build: `npm run build` passed with `/api/test-drive` included.
- Browser QA: signed-in onboarding and dashboard card placement passed at 390px, 768px, and 1440px with no horizontal overflow or console errors. The available account was correctly ineligible because it already has real submissions; no test record or email was created.
- Security: `npm run security:scan` and direct inspection of every new file passed.
- No migration, production write, production email, deployment, commit, or push was performed.

## Definition of done

- One eligible authenticated account can safely start or resume exactly one branded test and complete the real seller/PDF pipeline.
- Only the initiating verified account email receives test messages.
- Completion remains reviewable after email/PDF failure.
- Demos have no ordinary quota, operational, activation, retention, testimonial, abandonment, provider-memory, notification-fan-out, acquisition, or referral effects.
- No schema migration, production write, deployment, commit, or push is required for the implementation itself.
