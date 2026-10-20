---
status: done
owner: claude
updated: 2026-10-20 21:30
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

Owner approved all drafts D1-D13 (D1 option A, D12 option A = keep the home
H1). Applied:
- 21798a2 D1 footer: one "Part of the Norma Suite ↗" link; NormaSuitePanel
  footer variant removed (the dashboard strip is kept, takes no props, and is
  not rendered anywhere in the app today).
- 5aae9a8 D2/D3 labels and sentence case (legal page names unchanged).
- c38ad64 D4 arrows. 032dece D5 TC page (ForTcsSection deleted).
- eaa80ce D6/D7 pricing facts, FAQ trio removed, one "Keep reading" row.
- 3f02f1a D8 headlines (FAQ H1 + og-pages updated). 236ba26 home limited to
  two two-tone headlines.
- 58d7554 D9/D10/D11/D13. 2d4b416 Kit test updated for new markup/label.
- Deviation flagged to owner: D5 reused ForTcsSection copy that implied
  Packet details, multiple saved forms, and post-submission editing on every
  plan; "On Pro and Teams" qualifiers were added.
- Features page still has several two-tone headings; not in the drafts, left
  as designed.

## Environment

Local production build served by `next start` on port 3123 with placeholder
Stack/DB env vars (no hosted services). Screenshots via Playwright using
`/opt/pw-browsers/chromium`, written to the session scratchpad, not the repo.

## Validation

Run at 236ba26 (Node 22 locally; CI uses Node 20):
- `npm run lint`: 0 errors, 19 pre-existing warnings. `tsc --noEmit`: pass.
  `npm run build`: pass before every commit.
- `npm test -- --run`: 2239 passed, 26 skipped, 2 failed: the known
  `admin-operations-ui` and `seller-form-base-links-storage` failures from
  main. (`tc-utility-handoff-kit` failed after 3c3e740 and 5aae9a8; fixed in
  2d4b416.)
- Lighthouse 12.6.1 mobile on the production build: accessibility/SEO 100/100
  on 13 pages (/, features, how-it-works, pricing, faq, about, demo, TC,
  agents, seller form, checklist, kit, template). /from-a-closing 100/92:
  pre-existing streamed metadata on a dynamic route (suggested as a separate
  task).
- Before/after full-page screenshots (1440px, iPhone 13) for 14 pages:
  https://claude.ai/artifact/3Y8mNEgKtZ6Fzhjk2QFFUC

## Next

Done. Merged into main by the owner's request. main had moved (SEO content
plan, 094a2c5) with a rewritten TC page; the merge keeps main's TC page,
moves the two new guide links into the shared footer
(`components/marketing/marketing-chrome.tsx`), keeps the guide links on the
checklist and from-a-closing pages (MarketingPointsSection gained a
`children` slot), and combines the sitemap entries. Merged tree: lint 0
errors, tsc and build pass, unit tests pass except the two known failures.
