---
id: diffui-marketing-pages
status: relinquished
updated: 2026-10-15T17:46:29.9082589Z
---
# Task: diffui-marketing-pages

<!-- coordination:generated:start -->
## Current handoff

- Status: relinquished
- Owner/session: Codex / codex-marketing-pages-20261015
- Updated (UTC): 2026-10-15T17:46:29.9082589Z
- Branch: main
- Worktree: C:\Users\haydn\Documents\norma_suite\utility-sheet
- Base commit: b69bbcd6e5ac990645d00c7688be325d1cd13227
- Plan: .ai/plans/diffui-marketing-pages.md
- Files/directories: app/(marketing)/pricing/page.tsx, app/(marketing)/faq/page.tsx, app/(marketing)/how-it-works/page.tsx, app/(marketing)/marketing.css, components/marketing/faq-list.tsx, components/marketing/marketing-subpage.tsx, components/marketing/pricing-comparison.tsx, components/marketing/workflow-timeline.tsx, components/marketing/marketing-header.tsx, tests/marketing-pages.spec.ts, .ai/plans/diffui-marketing-pages.md
- Shared resources: marketing-design, port-3150
- Integration owner: Codex
- Environment/isolation: Local-only public marketing preview on port 3150; no database reads/writes intended; existing ignored env not assumed sandbox; node_modules and .next independent directories; no provider calls, messages, commits or deployment authorized.
- Integration commit: 
- Release reference: 
- Ownership relinquishment: Implementation and local QA finished; release cooperative holds while preserving ready-for-integration evidence. User has not authorized commit/push/deploy.
- Outcome before relinquishment: ready-for-integration
- Blockers: 

## Summary

Pricing, searchable FAQ and How It Works implemented and verified locally in existing homepage design. Current product facts preserved. Scoped lint/typecheck, 2 claims tests, Node20 production build, security/whitespace and responsive/interactive Chromium checks pass.

## Next concrete action

Review local pages; use recorded evidence and reverify changes before any later authorized commit/push/deploy.

## Validation evidence (reported, not executed by this helper)

- passed: `Scoped ESLint; npm exec tsc -- --noEmit; marketing-teams-claims Vitest; Node 20.18.0 next build; security:scan; diff --check; Chromium responsive and interactive QA`; required=True; environment=2026-10-15; HEAD b69bbcd; local public Next dev localhost:3150; Node22 static/tests, Node20 production build; independent local outputs; no hosted mutations.; commit=b69bbcd6e5ac990645d00c7688be325d1cd13227; checked=10/15/2026 17:46:17; tree=64a1c1869dd46c2a929547db731b4f0561c1e949882ac355ab69a6233419972e; fingerprint-version=2; paths=.ai/plans/diffui-marketing-pages.md, app/(marketing)/faq/page.tsx, app/(marketing)/how-it-works/page.tsx, app/(marketing)/marketing.css, app/(marketing)/pricing/page.tsx, components/marketing/faq-list.tsx, components/marketing/marketing-header.tsx, components/marketing/marketing-subpage.tsx, components/marketing/page-shell.tsx, components/marketing/pricing-comparison.tsx, components/marketing/workflow-timeline.tsx, lib/marketing-content.ts, package-lock.json, package.json, tests/marketing-pages.spec.ts. Scoped ESLint/typecheck pass; 2 pricing-claims tests pass; production build and security/whitespace checks pass. Desktop/tablet/390/320 all pages/home pass overflow, plan links and workflow image checks. FAQ search/filter/sort/empty/reset/keyboard, menu/Escape and tablet nav pass. Baseline two analytics CSP errors reproduced on home; no new application errors. Full lint stopped scanning large local tree; scoped lint passed. Full suite not run.
<!-- coordination:generated:end -->

## Scope, acceptance criteria, assumptions, and recovery notes

Add durable detail here; the helper preserves text outside its generated block.

## Delivered scope and evidence

Pricing, FAQ and How It Works are implemented locally in the existing homepage design. Plan: `.ai/plans/diffui-marketing-pages.md`. The reserved `tests/marketing-pages.spec.ts` was not created; actual browser verification uses ignored CLI check snippets instead. Existing homepage pricing/workflow components remain unchanged. Only shared header adds FAQ and current-page indication. No other marketing routes redesigned in this task.

2026-10-15, HEAD b69bbcd, Node 22.22.2 static/Vitest and Node 20.18.0 build: scoped ESLint, tsc --noEmit, 2 existing marketing Teams claims tests, production build, security scan, direct new-source secret check and git diff --check passed. Full lint was intentionally stopped after scanning the large local tree for several minutes; scoped lint passed after final formatting. No full unit/e2e suite claim.

Chromium: all three pages plus homepage at 1440/820/390/320 have no overflow; pricing plan destinations match current product; all three workflow images load. FAQ search includes answers, intersects categories and updates counts; sort, accordion keyboard/mouse, shortcut, clear, empty and reset pass. Mobile menu/Escape/navigation and tablet header pass. A harness race against dynamic header hydration was fixed with a visibility wait. Baseline Vercel analytics and Speed Insights CSP errors reproduce on unchanged homepage; no CSP/security policy changed. No new application error observed.

Ignored evidence: `.qa-artifacts/marketing-pages/` (reference/render screenshots, build log and browser-check snippets). No secrets/access URLs retained in source or coordination. No live DB, billing, auth, PDF, migration, commit, push or deploy. Existing coordination changes and paused PDF stash preserved. Local preview localhost:3150 reuses previous server, with separate Next 16 .next/dev output from production build.

Next: user reviews local Pricing/FAQ/How It Works. No required implementation work remains; commit/push/deploy await explicit authorization. Keep other marketing routes for a later requested design pass.
