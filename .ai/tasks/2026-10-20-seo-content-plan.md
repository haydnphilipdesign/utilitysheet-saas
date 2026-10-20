---
status: active
owner: claude
updated: 2026-10-20 19:05
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

- B: outline and copy drafted, waiting on owner approval. Planned URL
  `/guides/transfer-utilities-when-selling-a-house` (not blocked by
  `lib/seo/private-routes.ts`; no middleware).
- C, D, E, billing FAQ: not started.

## Environment

None (local `npm run build` / `next start` for screenshots only).

## Validation

Not run yet.

## Next

Get approval on the B draft, then build it.
