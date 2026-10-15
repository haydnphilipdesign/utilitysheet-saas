---
id: diffui-marketing-redesign
status: completed
updated: 2026-10-15T17:30:01.9762202Z
---
# Task: diffui-marketing-redesign

<!-- coordination:generated:start -->
## Current handoff

- Status: completed
- Owner/session: Codex / codex-diffui-20261015
- Updated (UTC): 2026-10-15T17:30:01.9762202Z
- Branch: main
- Worktree: C:\Users\haydn\Documents\norma_suite\utility-sheet
- Base commit: fc23e4c08068b720315fc06a50a0cb3d25f4fa1f
- Plan: .ai/plans/diffui-marketing-redesign.md
- Files/directories: app/(marketing)/layout.tsx, app/(marketing)/marketing.css, components/landing/herosection.tsx, components/landing/marketingstory.tsx, components/marketing/marketing-header.tsx, public/landing/diffui/hero-handoff.webp, tests/marketing-mobile.spec.ts, design-qa.md
- Shared resources: marketing-design, port-3150
- Integration owner: Haydn
- Environment/isolation: Local Next.js preview on 3150 (Node 22.22.2); production build Node 20.18.0. Synthetic fixtures and disposable in-memory PGlite only; no hosted DB mutations, messages, commits, push or deployment.
- Integration commit: b69bbcd6e5ac990645d00c7688be325d1cd13227
- Release reference: 
- Ownership relinquishment: 
- Outcome before relinquishment: 
- Blockers: 

## Summary

Authorized homepage commit/push complete at b69bbcd; lint/type/security and separated build/browser checks passed. Print PDF work safely held; unrelated work preserved.

## Next concrete action

None for homepage commit/push. Resume editorial-pdf-layout-held only on user request; no hosted deployment claim.

## Validation evidence (reported, not executed by this helper)

- passed: `Post-commit scoped ESLint, tsc --noEmit, npm run security:scan, git diff --check and scoped git diff --exit-code HEAD`; required=True; environment=Node 22.22.2; commit b69bbcd; independent local outputs; no hosted mutations; commit=b69bbcd6e5ac990645d00c7688be325d1cd13227; checked=10/15/2026 17:30:00; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=app/(marketing)/layout.tsx, app/(marketing)/marketing.css, components/landing/herosection.tsx, components/landing/marketingstory.tsx, components/marketing/marketing-header.tsx, design-qa.md, package-lock.json, package.json, public/landing/diffui/hero-handoff.webp, tests/marketing-mobile.spec.ts. All passed after commit. Exact eight-file homepage scope matches checked working tree. Separated-tree production build previously passed under Node 20.18.0, log .qa-artifacts/diffui/build-homepage-only.log. Interactive mobile/desktop recheck passed after separating PDF work. Existing full-suite admin failure remains historical/out of scope; CLI Playwright not run.
- passed: `git push origin main; git ls-remote --heads origin main; git rev-list --left-right --count HEAD...origin/main; git stash list -1`; required=True; environment=Git origin configured GitHub repository; authorized homepage-only push; commit=b69bbcd6e5ac990645d00c7688be325d1cd13227; checked=10/15/2026 17:30:00; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=app/(marketing)/layout.tsx, app/(marketing)/marketing.css, components/landing/herosection.tsx, components/landing/marketingstory.tsx, components/marketing/marketing-header.tsx, design-qa.md, public/landing/diffui/hero-handoff.webp, tests/marketing-mobile.spec.ts. Push succeeded. origin/main and HEAD both b69bbcd6e5ac990645d00c7688be325d1cd13227, divergence 0/0. Deferred PDF stash bf43bcd6215f952a196031adaa624d97fe4df0ff retained locally; no PDF paths in commit.
<!-- coordination:generated:end -->

## Scope, acceptance criteria, assumptions, and recovery notes

### Latest user direction (2026-10-15): homepage-only commit and push

Completed: commit `b69bbcd6e5ac990645d00c7688be325d1cd13227` contains exactly eight homepage/marketing files, including the WebP and QA report. `git push origin main` succeeded; `git ls-remote --heads origin main` matched HEAD and local/remote divergence was 0/0. The separated tree passed scoped ESLint, TypeScript, Node 20.18.0 production build, security scan and whitespace checks. Browser recheck confirmed mobile/desktop, loaded artwork, CTA, menu/Escape, no overflow, and zero errors. No hosted deployment result is claimed. No migration is required. PDF stash and unrelated coordination rollout/scratch changes remain local and uncommitted.

Actual print PDF redesign is on hold. All 23 PDF/branding/schema/migration/test changes were preserved in named local stash `bf43bcd6215f952a196031adaa624d97fe4df0ff`, owned by `editorial-pdf-layout-held`. The homepage paper illustration remains. Current homepage scope requires no migration and leaves production PDF behavior unchanged. User authorized committing and pushing this homepage change on the existing branch. Preserve unrelated coordination rollout changes unstaged. The material below is historical combined-task context, superseded where it implies releasing the PDF experiment.

Approved scope: selected second Diffui marketing design, homepage paper preview, and actual PDF layout as an option retaining the current layout. Implementation is local and uncommitted; no deployment, hosted migration, production-data mutation, or messages authorized/performed.

Delivered cream/navy/coral marketing treatment, generated local WebP phone/paper hero, actual brand logo, responsive navigation and three-step strip, existing analytics/routes and lower-page product content. Editorial is a paid Branding Profile PDF Content option. Classic remains default. Both use the authoritative HTML/Chromium PDF builder with existing content, safe assets, normalization and gating. Create/update/duplicate persistence, optional type/schema, focused migration and schema snapshot are included.

Evidence: `design-qa.md` is the authoritative local visual report, including normalized side-by-side captures and resolved hero-height/contrast findings. Ignored `.qa-artifacts/diffui/` holds browser screenshots, final comparison, synthetic PDFs, render fixtures, and selected logs. Do not commit these generated artifacts. Preview remains http://localhost:3150/ (local independent build/dependencies).

Verification: 122 focused tests passed across renderer, plan gating, form preview/selection/save, schemas, routes, partial update, duplication, and disposable PGlite storage migration. Scoped ESLint, TypeScript, Node 20.18.0 production build, security scan, direct new-source inspection, and diff whitespace checks passed. Classic Simple/Advanced output matched prior HEAD renderer after whitespace normalization and identical metadata. Editorial synthetic production renders inspected at 1, 2, and 9 pages; text selectable, repeated headings and footer numbering intact. Browser at 1440/820/390/320 CSS widths checked overflow, navigation, CTA destinations, mobile menu/Escape, FAQ, sticky CTA/dismiss, and zero final page console errors.

Limitations: full suite had 253 passing files, one failing file, one skipped; 2233 passing tests, one failing, 13 skipped. Failure is untouched `tests/unit/admin-operations-ui.test.tsx:320` (no-open-service-issues assertion), also reproduced alone. No pristine baseline run was made. Vitest uses Node 22.22.2; locally available early Node 20.18.0 fails to bootstrap installed Vite/Vitest. Production build passed under Node 20.18.0. CLI Playwright suite and authenticated hosted save/download were not run; interactive browser checks, mocked form/API checks, isolated storage checks, and actual synthetic PDF generation provide local evidence.

Release dependency: explicitly authorize/apply `migrations-brand-profile-pdf-layout.sql` BEFORE application deployment, then verify authenticated branding save/preview/actual download on the migrated environment. No live database action has occurred. User review/integration/release remain next; no commits or push created. Existing unrelated coordination-kit changes and scratch file preserved.
