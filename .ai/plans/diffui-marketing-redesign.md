# Diffui marketing redesign and optional PDF layout

## Current direction — supersedes the original combined release scope

Homepage-only integration outcome: committed and pushed `b69bbcd6e5ac990645d00c7688be325d1cd13227` to `origin/main`; remote branch hash verified equal to HEAD. Eight marketing files only. PDF work remains in the separate stash below; no schema or migration changes shipped. Post-separation lint/type/build/security and browser checks passed. Hosted deployment verification was not requested/performed.

On 2026-10-15 the user explicitly requested holding the actual print PDF redesign while committing and pushing the homepage redesign. The homepage hero paper illustration stays. All 23 PDF/branding/schema/migration/test changes have been saved separately in local stash `bf43bcd6215f952a196031adaa624d97fe4df0ff`, named `UtilitySheet: hold optional Editorial PDF layout; homepage excluded (2026-10-15)`. Recovery is owned by task `editorial-pdf-layout-held`; do not apply it until the user resumes that work. Its original QA is retained in ignored `.qa-artifacts/diffui/design-qa-before-pdf-hold.md`.

Current integration includes only marketing layout/CSS, HeroSection, MarketingStory, marketing header, hero WebP, marketing mobile expectations, and the scope-corrected QA report. No PDF change or migration is needed for this homepage commit. Unrelated coordination rollout changes remain unstaged. Validate the separated tree, commit the exact homepage files, push current `main` to `origin/main`, and verify the remote commit. The following sections retain historical design/verification context for the original combined task.

Approved: selected second supplied Diffui design, plus actual PDF as an option so existing users retain their layout. Owner: Codex / codex-diffui-20261015. Base: fc23e4c, main. No commit, deployment, live migration, messages, or production changes authorized.

## Shape and compatibility

- Marketing: preserve existing routes, SEO, CTA tracking, demo and lower-page product content. Match supplied cream/navy/coral visual with local generated hero asset. Keep actual UtilitySheet logo in navigation.
- Branding Profile owns `pdf_layout: classic | editorial`, optional in TypeScript for older records; SQL default Classic. UI labels Classic (current layout) and Editorial (two-column utilities). Existing profiles and omitted/unknown renderer values remain Classic.
- Save through existing validated, authorized create/update/duplicate routes and domain queries. Layout customization follows paid branding access. Free normalization always resolves to Classic without changing stored choices.
- Production packet normalization and synthetic preview normalization carry the same gated layout into the existing HTML builder. No separate screenshot PDF or renderer. Shared normalization, section content, escaping, safe assets, filenames, running chrome and plan rules stay authoritative.
- Editorial introduces a compact masthead/property header, paired utility cells with library icons, thin rules and tinted meter/trash detail blocks. Shared HOA/advanced/buyer sections remain in canonical order. Tables repeat headings and pair rows remain atomic; sections may paginate.
- Focused migration and schema snapshot only; migration must be approved and applied before deploying application code. Never run against hosted DB in this task.

## Acceptance and proof

1. Desktop reference comparison and mobile/tablet review; signup/demo links, nav, mobile menu, FAQ and sticky CTA work without overflow.
2. Classic render unchanged when layout omitted; Editorial retains every utility/contact/meter/trash/HOA/advanced/buyer field and escaping.
3. Layout survives validated save/duplicate mappings, partial updates preserve it, and Free gating applies both in live and preview normalization.
4. Render synthetic Classic, Editorial Simple, Advanced, and long-value/stress fixtures through production Chromium. Inspect pages, pagination, selectable text and headers/footers.
5. Relevant unit tests, lint, typecheck, full unit suite and production build, scaled to changes. Record actual environment/runtime and failures honestly.

## Status

Implemented locally and ready for review/integration; no commit or release performed. Local preview stays open at http://localhost:3150/. Source and rendered comparison passed after fixing hero height and button contrast; see `design-qa.md` for paths, state, normalization, iteration history, and limitations.

122 focused tests passed, scoped ESLint and TypeScript passed, and production build passed on Node 20.18.0. Vitest ran on installed Node 22.22.2 because local early Node 20.18.0 cannot bootstrap the installed Vite/Vitest dependency combination. Full suite returned one untouched admin-operations empty-state assertion failure, reproduced in isolation (253 files passed, one failed, one skipped; 2233 tests passed, one failed, 13 skipped). No pristine baseline run was made. No source changes were made to that admin page or test.

Browser checked desktop/tablet/390px/320px, navigation, signup/demo destinations, mobile menu/Escape, FAQ, sticky CTA/dismiss, overflow, and final page console (zero errors). CLI Playwright suite was not run. Synthetic production PDF renders inspected: Editorial Simple 1 page, Advanced 2, long-content stress 9; Classic renderer output matches prior HEAD after whitespace normalization, with identical output metadata. Migration defaults and constraint verified twice in disposable PGlite. No hosted database or authenticated production save was exercised.

Required before release: review local implementation, explicitly authorize/apply `migrations-brand-profile-pdf-layout.sql` before application deployment, then verify authenticated save/download against the migrated deployment. Classic stays default; Editorial follows existing paid-branding access. Existing dependencies/build dirs are not linked. Original build URL/token is intentionally not persisted. Existing coordination-kit rollout changes and unrelated scratch file were preserved.
