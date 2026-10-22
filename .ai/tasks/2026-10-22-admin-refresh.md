---
status: done
owner: codex
updated: 2026-10-22
scope: components/admin/AdminRefresh.tsx, components/admin/TriageControls.tsx, components/admin/FeedbackStatusControls.tsx, app/(admin)/layout-content.tsx, tests/unit/admin-refresh.test.tsx, tests/unit/admin-layout-navigation.test.tsx, ADMIN.md
---
# Admin automatic refresh

## Goal
Implement the agreed page-specific refresh behavior without interrupting edits. Plan: ../plans/2026-10-22-admin-refresh.md.

## Progress
Implemented shared route/query-keyed refresh toolbar, page-specific schedules, focus/reconnect refresh, visibility/offline guards, deduplication and in-flight protection. Inline triage/feedback editors explicitly block refresh; dialogs and unfinished native filters are protected. Documented behavior in ADMIN.md. No overlapping active scope found in coordination inventory.

## Environment
Local code and mocked tests only. No database, credentials, live services or deployment.

## Validation
- `npm test -- --run tests/unit/admin-refresh.test.tsx tests/unit/admin-layout-navigation.test.tsx tests/unit/admin-feedback-ui.test.tsx tests/unit/admin-operations-ui.test.tsx`: 54 passed.
- Added pending-transition coverage; `npm test -- --run tests/unit/admin-refresh.test.tsx`: 25 passed (55 total across the four suites).
- `npm exec tsc -- --noEmit`: passed.
- `npm exec eslint -- components/admin/AdminRefresh.tsx components/admin/TriageControls.tsx components/admin/FeedbackStatusControls.tsx 'app/(admin)/layout-content.tsx' tests/unit/admin-refresh.test.tsx tests/unit/admin-layout-navigation.test.tsx`: passed.
- `npm run lint`: stopped after more than two minutes without results; repository-wide lint not verified. Scoped lint above passed.
- `git diff --check`: passed, with existing line-ending normalization warnings.
- No live/authenticated browser or production validation performed. New files inspected directly; no sensitive values included.

## Next
Implementation complete locally. Not committed, pushed or deployed.
