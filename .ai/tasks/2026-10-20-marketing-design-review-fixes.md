---
status: blocked
owner: claude
updated: 2026-10-20 19:45
scope: app/(marketing), app/demo, components/marketing, components/landing, components/norma-suite-panel.tsx, lib/seo/og-pages.ts, app/sitemap.ts, docs/marketing-design-review.md
---
# Marketing design review fixes

## Goal

Work through the 18 items in `docs/marketing-design-review.md`. Visual/CSS/layout
fixes ship with before/after screenshots. Copy changes (headlines, CTA labels,
body copy) are drafted with before/after and wait for the owner's approval
before they are committed. Lint (0 errors) and `npm run build` pass before every
commit.

Builds on the SEO work (task `2026-10-20-seo-technical-readiness.md`, which
was waiting on the owner to pick design-review items; the owner assigned all of
them here). The owner merged `claude/gracious-cerf-nfkdld` into `main`
(19de111); this branch (`claude/upbeat-meitner-yco28c`) starts from that
commit.

Owner rules: no invented proof; no claims the code doesn't support; keep
Lighthouse a11y/SEO at 100; if an H1 changes, update `lib/seo/og-pages.ts` and
bump that page's `lastModified` in `app/sitemap.ts`; keep `createPageMetadata`
titles/descriptions; keep internal links (restyle them).

## Progress

Committed on this branch (no wording changes in any of them):
- 6d7a8ba item 1: subpage hero shapes inside the container, shown >= 1280px only.
- bbdd8c8 item 2 (layout): marketing header/footer extracted to
  `components/marketing/marketing-chrome.tsx`; /demo address step uses them and
  the site styles (`app/demo/demo.css`). The seller wizard runs full screen
  (its own fixed header used to cover the old demo header).
- 3c3e740 item 3 (layout) + visual half of 12/13/14: companion pages use
  `MarketingPageHero art=` (`components/marketing/hero-art.tsx`, existing
  product mockups), `MarketingPointsSection`, `MarketingStepRow`,
  `MarketingRelatedLinks` (all in `components/marketing/page-shell.tsx`).
  Sitemap lastmod bumped for changed pages.
- 46d3fcf items 8, 11a, 15, 16: FAQ is a plain grouped server-rendered list;
  Free "UtilitySheet branding" shown as a limit; home workflow paragraph under
  its H2; home steps strip drops icons.
- e630f68 footer column titles h2 (fixes /demo heading order).

Waiting on the owner (drafts D1-D13 on the review page,
https://claude.ai/artifact/3Y8mNEgKtZ6Fzhjk2QFFUC): D1 Norma naming (item 4),
D2 demo labels, D3 CTA vocabulary (10), D4 arrows (9), D5 ForTcsSection
replacement (3), D6 hero trios (6), D7 "Keep reading" row (7, 14), D8
headlines (5), D9 pricing details (11b/c), D10 from-a-closing (12), D11 agents
filler (13), D12 home H1 (17), D13 teams caption (18).

Notes for whoever applies the drafts:
- H1 changes (D2 casing only, D8 FAQ, D12 option B) need `lib/seo/og-pages.ts`
  and `app/sitemap.ts` updates.
- `tests/unit/norma-suite-panel.test.tsx` pins "Part of Norma" and "Explore the
  rest of the suite"; `tests/unit/from-a-closing-page.test.tsx` pins "Create
  your free seller link"; `tests/marketing-mobile.spec.ts` pins "Start Free
  instead" (case-insensitive) and the home H1.
- ForTcsSection (`components/landing/ForTcsSection.tsx`) is still rendered on
  the TC page until D5 is approved; it is the last user of framer-motion
  whileInView on companion pages.

## Environment

Local production build served by `next start` on port 3123 with placeholder
Stack/DB env vars (no hosted services). Screenshots via Playwright using
`/opt/pw-browsers/chromium`, written to the session scratchpad, not the repo.

## Validation

Run at e630f68 (Node 22 locally; CI uses Node 20):
- `npm run lint`: 0 errors, 19 pre-existing warnings.
- `npm exec tsc -- --noEmit`: pass.
- `npm run build`: pass (run before each commit).
- `npm test -- --run tests/unit/from-a-closing-page.test.tsx
  tests/unit/norma-suite-panel.test.tsx tests/unit/seo
  tests/unit/marketing-teams-claims.test.ts`: all pass. Full suite not rerun.
- Lighthouse 12.6.1 mobile, production build: accessibility/SEO 100/100 on /,
  /pricing, /faq, /demo, TC, agents, seller form, checklist, kit, template.
  /from-a-closing 100/92: dynamic route, Next 16 streams the meta description
  after </head> for browsers (Bingbot gets it in head). Pre-existing; fix would
  be site-wide `htmlLimitedBots` in next.config, left for the owner.
- Before/after full-page screenshots (1440px, iPhone 13) for 11 pages on the
  review page.

## Next

Apply the owner's answers to D1-D13 as small commits (lint + build each),
re-shoot the affected pages, and update the review page.
