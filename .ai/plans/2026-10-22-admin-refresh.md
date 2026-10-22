# Plan: Admin refresh

## Status
Completed

## Objective and verified facts
Admin overview and lists use server-rendered data. Next router.refresh merges fresh server output while preserving unaffected client state and scroll. Triage and Feedback have inline editors; other action controls use dialogs.

## Approach
Add a shared toolbar in the admin content area, keyed by pathname and query. Poll overview, operations, requests and abandonment every 30s; feedback every 60s. Refresh users, organizations, growth, telemetry and audit logs on focus only. Other/detail pages stay manual. All pages get a manual button and refresh status. Skip hidden/offline, overlapping requests, dialogs, explicit edit blockers and unfinished native form edits. Preserve the current URL and page state through router.refresh.

## Scope and impact
Shared admin layout, new refresh component, explicit inline editor markers, focused tests and ADMIN.md. No schema, API, auth, production or deployment changes. Existing queries execute more frequently only while the page is visible.

## Risks and acceptance criteria
No timer leaks on navigation; deduplicate focus/visibility events. Never refresh an open inline editor or dialog. Native filters with unapplied values block refresh even after blur. Manual pages never poll. Completion status follows the React refresh transition, not timer dispatch. Existing server authorization stays intact.

## Validation
Focused scheduling, visibility, focus, editor, filter and cleanup tests; existing admin layout/feedback/triage tests; lint and typecheck.

## Outcome
Implemented as planned, with explicit timestamp rather than a continuously changing relative clock. 55 focused tests pass, TypeScript passes, changed-file ESLint passes. Broad lint was stopped without results. See the task record for exact commands and limits. No deployment or live database access.
