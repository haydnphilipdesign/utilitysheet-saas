# Dashboard Home Refinement Plan

## Status

Paused as of 2026-07-17. Phases 1 through 3 and all code-level validation are complete. Authenticated browser QA is waiting for a user-authenticated localhost session; no auth bypass or impersonation session was created.

## Objective

Refine `/dashboard` into a professional, action-oriented home page that prioritizes the reusable seller-link workflow, requests needing attention, and recently submitted work without inventing new backend behavior.

## Verified Foundation

- The completed Requests workspace is present in commit `1bf3819` and documented in `.ai/plans/2026-07-17-requests-workspace.md`.
- `/api/requests` supports server-side `status=needs_attention` and `status=submitted` filters, deterministic sorting, limits, and authenticated account/organization scoping.
- `/dashboard/requests` owns the canonical filtered workspace and accepts those same URL parameters.
- Settings already contains the reusable-link slug editor and uses the existing `/api/intake-link` API, so dashboard slug editing can be replaced by a Settings link.
- `/api/account` already returns monthly `usage`; finite limits can be shown as account context without fabricating data.
- No schema, migration, new lifecycle definition, reminder automation, analytics system, or production action is required.

## Phase 1: Repository and Product Verification

- Confirm the Requests pagination/filtering work and current coordination state.
- Inspect the existing dashboard, share actions, Settings slug editor, request action component, feedback trigger, tests, and reference screenshot.
- Preserve the clean working tree and the existing ahead commit; do not rewrite or revert its contents.

Acceptance criteria:

- Canonical request filters and existing Settings/API destinations are identified from current code.
- No unsupported product or security assumption is needed before implementation.

## Phase 2: Action-Oriented Dashboard Structure

- Replace the oversized reusable-link card with a compact share bar exposing Copy, SMS, Email, and Open actions.
- Keep concise first-run guidance visible for incomplete onboarding; move ongoing guidance into a compact disclosure.
- Replace dashboard slug editing and upgrade merchandising with a link to the existing reusable-link Settings section.
- Remove the page-level desktop New Request button while preserving the shell desktop CTA, tablet icon, and mobile menu action.
- Fetch small canonical Needs Attention and Submitted lists from `/api/requests` and place them immediately below the share workflow.
- Render clear row navigation and reuse existing request actions for copy, reminder, review, packet, PDF, and edit behavior.
- Replace inventory metrics with at most three compact links: Waiting on seller, Ready to review, and Needs attention.
- Show finite monthly usage remaining as subdued account context.
- Move referral and product updates below active work.

Acceptance criteria:

- Share actions are visible without dominating the page.
- Attention and recent work appear before promotion.
- Metric links navigate to correctly filtered Requests views.
- Only the shell provides the prominent desktop New Request CTA.
- Essential actions remain reachable on mobile.

## Phase 3: States, Accessibility, and Focused Tests

- Add deliberate loading, aggregate error, first-run, no-attention, and no-submission states.
- Update the dashboard skeleton to match the new layout.
- Give the mobile Feedback trigger an explicit accessible name and appropriate touch target.
- Add focused tests for canonical fetch parameters, section order, metric destinations, Settings slug destination, first-run/help behavior, row actions, CTA deduplication, usage context, and feedback naming.

Acceptance criteria:

- Loading, empty, error, and first-run states are intentional and actionable.
- Keyboard focus, accessible names, contrast, wrapping, and touch targets are reasonable.
- Tests prove that dashboard UI does not imply new backend capabilities.

## Phase 4: Validation and Handoff

- Run focused dashboard and Requests tests first.
- Run task-scoped ESLint, full TypeScript validation, full lint with any unrelated baseline isolated, and a production build.
- Use the available Browser workflow for authenticated, non-mutating QA at approximately 390px, 768px, and 1440px.
- Compare the final render against the reference screenshot and record intentional hierarchy changes.
- Review the diff, mark this plan completed, and update `.ai/CURRENT.md` with exact validation and remaining risk.

Acceptance criteria:

- The dashboard works without horizontal overflow or clipped actions at all requested widths.
- Browser identity, console health, framework-overlay absence, visible hierarchy, and at least one safe interaction are verified.
- No commit, push, deploy, migration, production-data change, reminder send, email send, or other live mutation occurs.

Current validation result:

- Focused dashboard/Requests/Settings tests pass: 5 files and 17 tests.
- Task-scoped ESLint passes.
- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Full `npm run lint` remains blocked only by six pre-existing unrelated `no-explicit-any` errors documented in `.ai/CURRENT.md`.
- Browser QA attempted the in-app browser and Chrome. The in-app browser redirected to `/auth/login`; Chrome control did not establish a usable local tab. The repository explicitly gates impersonation, so browser QA is paused until the user signs into `http://localhost:3005` and asks the agent to resume.

## Expected Files

- `app/dashboard/page.tsx`
- `app/dashboard/layout-content.tsx`
- `components/dashboard/reusable-link-actions.tsx`
- `components/feedback-dialog.tsx`
- `components/ui/dashboard-skeleton.tsx`
- `tests/unit/dashboard-reusable-link.test.tsx`
- Additional focused dashboard test files only if clearer than extending the existing test
- `.ai/CURRENT.md`
- `.ai/plans/2026-07-17-dashboard-home-refinement.md`

## Risks and Constraints

- Needs Attention must remain the implemented canonical three-day sent-request filter; do not broaden its meaning.
- “Recently submitted” is a small `status=submitted` list sorted by existing last-activity ordering, not a new persisted lifecycle state.
- Usage context must be hidden when the returned limit is effectively unlimited or missing.
- Existing billing, authorization, locked-row, plan-gating, and token behavior must remain unchanged.
- Browser QA must avoid reminder, download, external email, delete, checkout, and other mutating or externally consequential actions.
