---
status: active
owner: claude
updated: 2026-10-20 19:45
scope: app/(marketing)/guides, app/(marketing)/utility-sheet-template, app/(marketing)/utility-sheet-for-transaction-coordinators, components/landing/ForTcsSection.tsx, app/sitemap.ts, lib/seo/og-pages.ts, app/(marketing)/layout.tsx (footer links only), lib/marketing-content.ts (FAQ entries only), docs/seo-playbook.md, tests/unit/seo-*
---
# SEO content plan (playbook section 6, items B–E and billing FAQ)

## Goal

Build the open items in section 6 of `docs/seo-playbook.md`, one page at a
time, each approved by the owner as outline + copy first, then as desktop and
mobile screenshots, before it is pushed. Branch: `claude/exciting-mayer-5vb4nw`.

Owner decisions (2026-10-20):
- Order: B (seller guide) first.
- D becomes a "What is a utility sheet?" section on `/utility-sheet-template`,
  not a separate page.
- C (TC page) is redesigned in this task, including replacing
  `components/landing/ForTcsSection.tsx`. The design-review session should
  leave that page and component alone. Changes stay in the page file and its
  own stylesheet; shared components are not edited here.

## Progress

- B: copy approved 2026-10-20. Built at
  `/guides/transfer-utilities-when-selling-a-house` (`page.tsx` + scoped
  `guide.css`, `stg-` prefix). Wired into sitemap, `og-pages.ts`, footer
  ("Seller Utilities Guide" under Use Cases), template page and checklist
  page cross-links, and the playbook indexing table. Committed locally;
  NOT pushed until the owner approves the screenshots. Post-approval copy
  tweak: "one less question…" became "It also saves your agent a follow-up
  call." (design-review pattern). Uses shared `MarketingCtaBand` unchanged.
- C, D, E, billing FAQ: not started.

## Environment

Local production build on port 3123 with placeholder Stack/DB env vars (no
real values) and NEXT_PUBLIC_APP_URL=https://www.utilitysheet.com. No hosted
services touched.

## Validation

B (2026-10-20):
- `npm run lint`: 0 errors, 19 pre-existing warnings.
- `npm exec tsc -- --noEmit`: pass.
- `npm run build`: pass.
- `npm test -- --run tests/unit/seo-`: 3 files, 10 tests pass.
- Lighthouse 12.6.1 (local, mobile): accessibility 100, SEO 100,
  performance 86.
- Playwright screenshots at 1440px and iPhone 13: no horizontal overflow.

## Next

Owner reviews B screenshots; on approval push, then start D (template page section).
