# Features marketing page and companion polish

Authorized: choose/adapt four supplied Diffui references for Features, match the recently updated marketing pages, and fix anything worth improving on Home, Pricing, How It Works, FAQ and Features. No commit, push, deployment or live data action authorized.

Ownership: started by Codex (codex-features-20261015); user stopped Codex mid-implementation and handed the task to Claude (claude-features-20261015) on 2026-10-15. Codex's partial files were reviewed and replaced.

## Direction chosen

- Hero: option 2 split layout. Illustrated seller form in a browser frame with floating "On this sheet" checklist and "Seller submitted" cards, over the brand quarter-circle geometry.
- Every-plan essentials: option 1 illustrated cards (six, numbered), each with a legible product mockup in a fixed-height stage so rows align.
- Pro + Teams: option 2 style split rows for Branding, Editing after submission, Property Handoff Packet.
- Teams: navy band reusing the homepage testimonial navy.
- Diffui's blue palette was not adopted; everything uses the existing cream, navy, sea-glass and coral tokens and Figtree.
- Options 3 and 4 (step strips) were not used because How It Works already owns that story.

## Shared changes

- `components/marketing/product-mockups.tsx` + `.css`: static, aria-hidden, synthetic illustrations (min 11px type). Used by Features and How It Works.
- How It Works timeline: replaced three unreadable dashboard screenshots (one dark) with the mockups; tablet stacks steps into wide cards.
- `MarketingHelpStrip` takes `links`; FAQ and How It Works no longer link to themselves.
- `MarketingSection` now uses `marketing-container` (aligned with header on every route that uses it).
- CTA band buttons sentence case. Footer aligned to `marketing-container`.
- Pricing/HIW note lists and redundant "Related pages" pills replaced by `.marketing-note-grid` and the help strip. FAQ's duplicate "Not sure where to go next?" removed.
- Homepage pricing and FAQ restyled to match Pricing/FAQ pages (test IDs, tracking, and all FAQ answers preserved; FAQ answers now stay in the DOM via native details).

## Accuracy notes

Teams copy follows `tests/unit/marketing-teams-claims.test.ts`: shared requests and Branding Profiles, seller forms per member. Roles shown are Admin/Member (from `lib/neon/queries/organizations.ts`). Branding on the seller form verified in `components/seller-form/SellerLayout.tsx`.

## Outcome

Implemented and verified locally; evidence in the task record. Awaiting user review. Commit/push/deploy need explicit authorization.

Follow-up candidates (not done): the TC, agent, checklist and seller-form SEO pages still use the older inner hero and "Related pages" pill rows.
