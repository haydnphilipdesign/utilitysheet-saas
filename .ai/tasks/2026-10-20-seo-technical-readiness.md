---
status: active
owner: claude
updated: 2026-10-20 18:00
scope: app/robots.ts, app/sitemap.ts, app/opengraph-image.tsx, app/og, app/auth, lib/seo, next.config.ts, app/(marketing), components/norma-suite-panel.tsx, components/marketing, docs/seo-playbook.md, docs/marketing-design-review.md
---
# SEO technical readiness

## Goal

Make utilitysheet.com technically ready for search (audit items 2-9 plus the
"nice to have" list approved by the user on 2026-10-20), then hand over the
Search Console walkthrough, content plan, and off-site checklist.

Item 1 (apex -> www redirect should be 308, not 307) is a Vercel Domains
setting the user changes; no code.

## Progress

Approved scope:
- Noindex pages stop inheriting `canonical: /` from the root layout.
- robots.txt: stop disallowing capability-token routes (/s, /i, /form, /packet);
  send `X-Robots-Tag: noindex, nofollow` on them and on packet PDFs instead.
- SoftwareApplication: one entity, accurate offers (Pro $9/mo, Teams $7/seat/mo,
  3-seat minimum, Free $0). No ratings or reviews.
- Real sitemap lastmod dates; fallback site URL is www.
- Hero entrance animation no longer starts at opacity 0 (LCP).
- A11y: descriptive footer links, contrast fixes.
- Nice to haves: auth page titles, robots tidy-up, Multimedium creator,
  per-page OG images with the real logo.
- Title/description copy: drafts shown to the user BEFORE committing.

Deferred by user: moving Stack Auth off marketing pages (separate task later).

## Environment

Local production build on port 3123 with placeholder Stack/DB env vars
(NEXT_PUBLIC_APP_URL=https://www.utilitysheet.com). No hosted services touched.

## Validation

Not run yet.

## Next

Implement the technical commits.
