# Marketing site design review

Reviewed 2026-10-20 from full-page screenshots of every public page at
1440px desktop and iPhone 13 width, on a local production build. Focus:
anything that looks sloppy, templated, inconsistent, or off-brand. Nothing in
this list has been changed yet unless marked **Fixed**.

## Status (2026-10-20)

**Fixed:** all 18 items, on branch `claude/upbeat-meitner-yco28c`. Wording changes
were approved by the owner as drafts D1-D13 before they were committed.

| Item | Fix | Commit |
| --- | --- | --- |
| 1 | Hero shapes stay inside the container; shown from 1280px up | 6d7a8ba |
| 2 | Demo uses the marketing header, footer, card, and button; sentence-case labels | bbdd8c8, 5aae9a8 |
| 3 | Companion pages on the redesigned hero and sections; ForTcsSection removed | 3c3e740, 032dece |
| 4 | Footer panel replaced by one "Part of the Norma Suite" link | 21798a2 |
| 5 | "One less…" kept only in the TC H1; other slogans rewritten; home limited to two two-tone headlines | 3f02f1a, 236ba26 |
| 6 | Pricing hero shows concrete facts; FAQ hero trio removed | eaa80ce |
| 7, 14 | One "Keep reading" link row replaces the help strip and "Related pages" | eaa80ce |
| 8 | FAQ is a plain grouped list | 46d3fcf |
| 9 | Internal links use →; ↗ only on the external Norma link | c38ad64 |
| 10 | "Start free" / "Create your free seller link" / "Start Pro", sentence case | 5aae9a8 |
| 11 | Free limit shown with a minus; "/seat/month"; stray table label removed | 46d3fcf, 58d7554 |
| 12 | Duplicate line replaced; primary/outline buttons | 3c3e740, 58d7554 |
| 13 | Filler point and intro removed; list layout (no orphan) | 3c3e740, 58d7554 |
| 15, 16 | Home paragraph under its headline; steps without duplicate icons | 46d3fcf |
| 17 | Owner kept the home H1 (copy decision) | — |
| 18 | Teams mockup captioned as an illustrative preview | 58d7554 |

Severity: **High** = visibly broken or clearly off-brand. **Medium** =
templated or "AI-slop" patterns that lower trust. **Low** = polish.

## High

1. **Decorative shapes collide with text on mobile.** On the Pricing and FAQ
   heroes, the corner geometry (quarter circles, rings, triangle) sits behind
   the intro paragraph on phones. On desktop the same shapes are clipped by
   the right edge of the viewport, which reads as accidental.
   *Where:* `components/marketing/marketing-subpage.tsx` hero.
   *Fix:* hide the shapes below `md`, and keep them inside the container on
   desktop.

2. **The demo page looks like a different product.** Green "Get Started"
   button, slate gradient "Start Demo" button, Title Case headings, a "Demo
   Mode" pill, and no marketing footer. Everything else uses navy, the
   red-orange primary button, sentence case, and "Start free".
   *Where:* `app/demo/layout.tsx`, `app/demo/page.tsx`.
   *Fix:* reuse the marketing header and button styles; rename "Get Started"
   to "Start free".

3. **Companion pages are a generation behind the redesigned pages.** Home,
   Features, and Pricing were redesigned; the TC, Agents, Seller form,
   Checklist, Kit, and From-a-closing pages still use the older shell:
   - the right half of the hero is empty
   - eyebrows are tiny Title Case ("Use Case", "Checklist") while the rest of
     the site uses spaced uppercase
   - generic three-card rows

   The TC page also embeds `ForTcsSection`, a leftover template block with:
   - a pill badge
   - a red "SOUND FAMILIAR?" pain-point box
   - colored chips ("Reusable on every file", "Sheet or packet")
   - a dark-slate Title Case "Create My Seller Link" button

   None of it matches the site.
   *Where:* `components/marketing/page-shell.tsx`,
   `components/landing/ForTcsSection.tsx`, the six page files.
   *Fix:* move these pages onto the redesigned hero and section components.
   Drop `ForTcsSection` in favor of the newer capability-list style.

4. **The footer promotes another brand on every page.** The "Part of Norma"
   panel takes up a large block above the footer bottom on every page. It:
   - calls the product **"UtilitySheet by Norma"**, which conflicts with
     UtilitySheet keeping its own brand
   - advertises NormaTC as "Private beta soon"
   - is followed by a second line, "Part of the Norma ecosystem ·
     normatc.com"

   The naming also varies: "suite", "ecosystem", "Norma".
   *Where:* `components/norma-suite-panel.tsx` (footer variant),
   `app/(marketing)/layout.tsx` (around line 108).
   *Fix:* replace both with one quiet line, e.g. "Part of the Norma Suite →",
   and settle on one name for the family.

## Medium (templated / AI-slop patterns)

5. **The same headline formula everywhere.** Nearly every H1 and H2 uses the
   navy-then-teal split. Section titles lean on paired slogans:
   - "One less thing to chase. One better way to hand it off."
   - "A minute here. One less thing on your list."
   - "A little less chasing. A lot more peace of mind."
   - "Got questions? We've got answers."
   - "Start free. Upgrade when it sticks."

   "One less …" appears at least five times across pages. Each line is fine
   alone; together they read as generated. Keep the two-tone treatment for one
   or two headlines per page and vary the rhythm.

6. **Generic benefit trios in heroes.** Pricing ("Less back-and-forth /
   Details you can review / A thoughtful buyer handoff") and FAQ ("Quick
   answers / Clear information / A smoother handoff") each have three
   icon-in-mint-circle items that say nothing specific. Replace them with
   something concrete (e.g. on Pricing: "3 free sheets a month · No card ·
   Cancel anytime", if billing supports that last one) or remove them.
   *Where:* `components/marketing/marketing-subpage.tsx`.

7. **The same "next steps" strip is repeated.** "See everything it does /
   Start with a real walkthrough / A few more questions?" appears in some
   variation on Features, How it works, Pricing, and FAQ.

8. **The FAQ page is over-built for 15 questions.** It has:
   - a search box with a Ctrl/⌘K hint
   - a category sidebar, where "Plans & billing" has a single question
   - a "Sort by: Recommended" dropdown

   A plain grouped list would be clearer. The missing billing questions are a
   content gap.
   *Where:* `components/marketing/faq-list.tsx`.

9. **Arrow icons mean two things.** "↗" (the usual external-link icon) is
   used for internal links: "Try the demo ↗", "Explore all features ↗", "Copy
   an email for each ↗", "See how it works ↗". Other CTAs use "→". Use "→" for
   internal links and "↗" only for other sites.
   *Where:* `ArrowUpRight` in `components/landing/MarketingStory.tsx`,
   `components/marketing/page-shell.tsx`, `app/(marketing)/about/page.tsx`.

10. **CTA labels and casing vary.**
    - "Start free" and "Start Free" (footer)
    - "Get Started" (demo)
    - "Create My Seller Link" (TC page)
    - "Create your free seller link" (From a closing)
    - "Get your seller link" (How it works)
    - "Start Pro" (home pricing) vs "Choose Pro" (pricing page)
    - "Sign In" (nav)

    Pick one primary label ("Start free") and use sentence case throughout.

11. **Pricing details that look careless.**
    - "UtilitySheet branding on shared links" is listed with a ✓ as a Free
      *feature*. It's a limitation.
      *Where:* `components/landing/PricingSection.tsx:28`.
    - "/month" (Pro) vs "/seat/mo" (Teams) on the home cards.
    - A stray "Ready for your next file?" label in the bottom-left cell of the
      comparison table.
      *Where:* `components/marketing/pricing-comparison.tsx:145`.

12. **The From-a-closing page repeats itself.** "Sellers need no account, no
    app, and no research" and "Sellers can complete the guided form on their
    phone without an account" sit next to each other. Its buttons are small
    navy buttons instead of the site's primary style.
    *Where:* `app/(marketing)/from-a-closing/page.tsx:155`.

13. **The Agents page has filler.** "What agents usually care about most" is
    five plain text boxes with an orphan in the last row, including vague
    lines like "The workflow helps the transaction feel more organized and
    less reactive."
    *Where:* `app/(marketing)/utility-sheet-for-real-estate-agents/page.tsx:82`.

14. **"Related pages" blocks read as SEO scaffolding.** These are pill-button
    rows with intros like "These pages are useful if you are comparing
    plans…". Internal links are good. Work them into the copy or use a
    designed "Keep reading" row instead.

## Low

15. Home, "From 'who's your provider?' to ready to share": the supporting
    paragraph floats alone at the far right, disconnected from the headline.
16. The home steps strip shows both a numbered circle *and* an icon for each
    step. One is enough.
17. The home H1 ("The utility handoff, finally organized") doesn't contain
    "utility sheet", the phrase people are most likely to search. A copy
    decision, not a bug.
18. Teams mockup uses made-up names (Jordan Reyes, Sam Patel, Alex Kim)
    without the "Illustrative preview" caption the hero mockups have. Add the
    same caption for consistency.

## Already fixed on this branch

- **Fixed:** the social preview image was a dark slate card with a placeholder
  "US" monogram and outdated copy ("Simple + Advanced modes"). It's now
  on-brand per-page images with the real logo.
- **Fixed:** low-contrast text (capability numbers, footer badges, kit CTA),
  footer "Learn more" links with no accessible name, and a skipped heading
  level on the TC page.
- **Fixed:** the hero no longer fades in from invisible, which delayed the
  largest paint.
