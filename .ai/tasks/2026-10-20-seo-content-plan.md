---
status: active
owner: claude
updated: 2026-10-20 21:50
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
  page cross-links, and the playbook indexing table. Screenshots
  approved and pushed. Post-approval copy
  tweak: "one less question…" became "It also saves your agent a follow-up
  call." (design-review pattern). Uses shared `MarketingCtaBand` unchanged.
- D: copy approved. Built as a "What is a utility sheet?" section right
  after the hero of `/utility-sheet-template` (`basics` list + `ust-basics`
  styles); removed the overlapping "Who should fill it out?" FAQ; added the
  keyword; playbook marks D built. Screenshots approved and pushed.
- C: copy approved. Rewrote `app/(marketing)/utility-sheet-for-transaction-coordinators/page.tsx`
  with a scoped `tc.css` (`tcp-` prefix): Features-style hero with an
  illustrative requests preview, stages with kit emails, checklist-task
  section, "What you get back", the real testimonials (reusing shared
  `.marketing-testimonials` styles; `customerTestimonials` is now exported
  from `components/landing/SocialProofBar.tsx`), TC FAQ, shared CTA band.
  Deleted `components/landing/ForTcsSection.tsx` (only user). OG title and
  sitemap date updated; playbook marks C built. Screenshots approved and
  pushed.
- E: copy approved. Built at `/guides/set-up-utilities-when-buying-a-house`.
  The seller guide's stylesheet moved to `app/(marketing)/guides/guide.css`
  (prefix renamed `stg-` → `guide-`) and is shared by both guides. Wired
  into sitemap, `og-pages.ts`, footer ("Buyer Utilities Guide"), a sentence
  in the seller guide and on `/from-a-closing`, the playbook (row 13, E
  built). Template page section got `id="what-is-a-utility-sheet"` and
  `.ust-section` a scroll margin for the anchor. Committed locally, not
  pushed until the owner approves the screenshots.
- Billing FAQ: not started.

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

D (2026-10-20): lint 0 errors (19 pre-existing warnings); tsc pass; build
pass; `npm test -- --run tests/unit/seo- tests/unit/utility-sheet-template`:
4 files, 13 tests pass; screenshots at 1440px and iPhone 13, no overflow.

C (2026-10-20): lint 0 errors (19 pre-existing warnings); tsc pass; build
pass; Lighthouse (local, mobile) accessibility 100, SEO 100, performance 85;
screenshots at 1440px and iPhone 13, no overflow. Full `npm test -- --run`:
257 files pass; the 2 known failures (`seller-form-base-links-storage`,
`admin-operations-ui`) plus `handoff-evidence-storage` "applies the
migration idempotently", which passes when run alone (slow test under full
suite load; unrelated to these changes).

E (2026-10-20): lint 0 errors (19 pre-existing warnings); tsc pass; build
pass; `npm test -- --run tests/unit/seo- tests/unit/utility-sheet-template`:
4 files, 13 tests pass; screenshots of both guides at 1440px and iPhone 13,
no overflow; Lighthouse (local, mobile) on the buyer guide: accessibility
100, SEO 100, performance 87.

## Next

Owner reviews E screenshots; on approval push, then verify billing behavior in code and draft the billing FAQ entries.
