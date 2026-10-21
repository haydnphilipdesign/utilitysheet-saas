---
status: ready
owner: claude
updated: 2026-10-20 20:00
scope: app/robots.ts, app/sitemap.ts, app/og, app/auth, app/layout.tsx, lib/seo, next.config.ts, app/(marketing), components/norma-suite-panel.tsx, components/landing/ForTcsSection.tsx, docs/seo-playbook.md, docs/marketing-design-review.md
---
# SEO technical readiness

## Goal

Make utilitysheet.com technically ready for search (audit items 2-9 plus the
"nice to have" list approved by the user on 2026-10-20), then hand over the
Search Console walkthrough, content plan, and off-site checklist
(`docs/seo-playbook.md`) and a marketing design review
(`docs/marketing-design-review.md`).

Item 1 (apex -> www redirect is 307, should be 308) is a Vercel Domains
setting the user changes; no code.

## Progress

Done on branch `claude/gracious-cerf-nfkdld`:
- Capability-link routes (/s, /i, /form, /packet, /invite) are crawlable and
  send `X-Robots-Tag: noindex, nofollow`; signed-in/admin/api routes are
  disallowed and send the same header. Shared list: `lib/seo/private-routes.ts`.
- Root layout no longer gives every page canonical `/`.
- Sitemap has real per-page lastmod dates (bump them when page content
  changes); fallback site URL is www.
- One SoftwareApplication entity (home + pricing) with accurate offers;
  FAQPage only on /faq. No ratings/reviews.
- Hero entrance animation no longer starts at opacity 0.
- A11y: contrast, footer link names, ForTcsSection heading order.
- Auth pages have their own titles.
- Per-page OG images at `/og/[page]` (static, Figtree OFL fonts in
  `lib/seo/og-fonts`); headlines mirror each page's H1 in `lib/seo/og-pages.ts`.
- Pre-existing lint error in `components/admin/EventLogTable.tsx` fixed
  (`any` -> `unknown`).

- Approved title/description copy applied (`absoluteTitle` option on
  `createPageMetadata` for the home page).
- Content plan item A: `/utility-sheet-template` page plus a build-time
  printable PDF at `/templates/utility-info-sheet.pdf`
  (`lib/templates/utility-sheet-template.ts`, `app/templates/[file]/route.ts`;
  the route uses a `[file]` segment because `*.pdf` is gitignored). Approved
  by the user.
- User changed the apex redirect to 308 in Vercel; verified live.

Handed off to separate sessions (task cards): marketing design review
(`docs/marketing-design-review.md`), remaining content plan items B–E, and
the pre-existing admin Operations test failure.

Deferred by user: moving Stack Auth off marketing pages (JS weight is the
remaining LCP/TBT cost on the home page).
Picked up 2026-10-21 in [marketing-without-stack](2026-10-21-marketing-without-stack.md).

## Environment

Local production build on port 3123 with placeholder Stack/DB env vars and
NEXT_PUBLIC_APP_URL=https://www.utilitysheet.com. No hosted services touched.

## Validation

- `npx eslint`: 0 errors, 19 pre-existing warnings.
- `npm exec tsc -- --noEmit`: pass.
- `npm run build`: pass.
- `npm test -- --run`: 257 files pass; 2 fail identically on main
  (`seller-form-base-links-storage` needs `git show ccd4eda` absent from the
  shallow clone; `admin-operations-ui` "distinguishes no observations yet"
  fails on main too).
- New tests: `tests/unit/seo-crawl-rules.test.ts`,
  `seo-structured-data.test.ts`, `seo-og-images.test.ts` pass.
- Rendered HTML of all 16 public pages checked: one H1, lang, self canonical,
  per-page og:image, JSON-LD as intended. Private routes checked for
  X-Robots-Tag + meta noindex and no canonical.
- Lighthouse (local, mobile): accessibility and SEO 100 on home/TC/kit;
  home LCP 5.4s -> 4.1-5.1s (remaining delay is JS execution).
- `npm run security:scan`: pass.

## Next

User merges the branch. After deploy: fetch live /robots.txt, /sitemap.xml,
/og/home, /templates/utility-info-sheet.pdf, and a private route's headers;
then the user submits the sitemap and requests indexing per
`docs/seo-playbook.md`.
