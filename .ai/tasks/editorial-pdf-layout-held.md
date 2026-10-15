---
id: editorial-pdf-layout-held
status: paused
updated: 2026-10-15T17:27:22.0618345Z
---
# Task: editorial-pdf-layout-held

<!-- coordination:generated:start -->
## Current handoff

- Status: paused
- Owner/session: Codex / codex-diffui-20261015
- Updated (UTC): 2026-10-15T17:27:22.0618345Z
- Branch: main
- Worktree: C:\Users\haydn\Documents\norma_suite\utility-sheet
- Base commit: fc23e4c08068b720315fc06a50a0cb3d25f4fa1f
- Plan: 
- Files/directories: app/api/branding/[id]/duplicate/route.ts, app/api/branding/[id]/route.ts, app/api/branding/route.ts, components/branding/brandprofileform.tsx, docs/pdf-system-reference.md, lib/branding/preview-data.ts, lib/neon/queries/brand-profiles.ts, lib/packet/packet-data.ts, lib/pdf/packet-html.ts, lib/pdf/utility-icons.ts, lib/validation/schemas.ts, schema.sql, migrations-brand-profile-pdf-layout.sql, tests/unit/brand-profile-form.test.tsx, tests/unit/brand-profiles-update-query.test.ts, tests/unit/branding-duplicate-route.test.ts, tests/unit/branding-preview-data.test.ts, tests/unit/branding-schema.test.ts, tests/unit/packet-data.test.ts, tests/unit/packet-html.test.ts, tests/unit/branding-layout-routes.test.ts, tests/unit/branding-layout-storage.test.ts, types/index.ts
- Shared resources: brand-profile-pdf-layout, brand-profiles-column-layout-migration
- Integration owner: Haydn
- Environment/isolation: User explicitly put print PDF on hold. Preserve local changes only; no migration, deployment or live data changes.
- Integration commit: 
- Release reference: 
- Ownership relinquishment: 
- Outcome before relinquishment: 
- Blockers: 

## Summary

Print PDF redesign explicitly held by user. All 23 changes preserved in named local stash bf43bcd6215f952a196031adaa624d97fe4df0ff; excluded from homepage commit.

## Next concrete action

Resume only on user request. Inspect/apply preserved stash by hash, revalidate with current code, and obtain separate authorization before any migration.

## Validation evidence (reported, not executed by this helper)

No validation recorded. Do not infer that tests passed.
<!-- coordination:generated:end -->

## Scope, acceptance criteria, assumptions, and recovery notes

User explicitly deferred actual print-PDF design on 2026-10-15. The homepage illustration remains in separately committed homepage redesign `b69bbcd6e5ac990645d00c7688be325d1cd13227` (pushed to origin/main).

All 23 PDF/branding/schema/migration/test changes are preserved in local stash `bf43bcd6215f952a196031adaa624d97fe4df0ff`, named `UtilitySheet: hold optional Editorial PDF layout; homepage excluded (2026-10-15)`. Base: `fc23e4c08068b720315fc06a50a0cb3d25f4fa1f`. `git stash show --stat --include-untracked` confirmed only intended PDF paths, and working tree has none of those modifications. This stash has NOT been pushed. The original QA report, sample renders and per-file SHA256 manifest remain in ignored `.qa-artifacts/diffui/` (see `design-qa-before-pdf-hold.md`, `pdf-hold-manifest.json`, `pdf-hold-paths.json`).

When the user resumes this task, inspect the stash and current code, then use `git stash apply bf43bcd6215f952a196031adaa624d97fe4df0ff` rather than relying on a changing stash index. Preserve the stash until restoration is verified. Revalidate routes, storage, plan gating, classic compatibility, and pagination against current code. An unapplied optional layout migration is part of the held changes; explicit authorization is still required before any live migration. No deployment or production data changes were made for this PDF work. No further work while paused.

Add durable detail here; the helper preserves text outside its generated block.
