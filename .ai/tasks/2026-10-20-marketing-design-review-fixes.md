---
status: active
owner: claude
updated: 2026-10-20 21:00
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

Not started.

## Environment

Local production build served by `next start` on port 3123 with placeholder
Stack/DB env vars (no hosted services). Screenshots via Playwright using
`/opt/pw-browsers/chromium`, written to the session scratchpad, not the repo.

## Validation

Not run yet.

## Next

Item 1 (subpage hero geometry).
