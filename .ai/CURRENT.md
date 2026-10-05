# Current task: Marketing content audit against recently shipped features

- Date: 2026-10-05. Owner: Claude Code (Opus 5.5). Branch: main. Status: completed; committed and pushed to main with owner authorization (see git log for the marketing-copy commit). Copy-only change, no formal plan.
- Startup correction: the previous handoff said the manual-only workflow change was uncommitted. It is committed as `20c4ceb`; the tree was clean on entry.
- Scope: compare public marketing copy with features shipped since late August (saved seller forms, per-request HOA/meter settings, HOA question group and its switch, submission-based Free metering, submitted-sheet editing improvements) and correct or extend it.

## Changes

- `lib/marketing-content.ts`: three new FAQs (saved forms, choosing seller questions, HOA details); reusable-link, editing, and free-limit FAQs updated; three new feature highlights; pricing tier feature lines reworded. Feeds FAQ and SoftwareApplication JSON-LD.
- `components/landing/PricingSection.tsx`: removed the stale "rolling out to pilot accounts" footnote (saved forms went to all users 2026-10-02); "3 live files" became "3 submitted sheets"; "per creator/workspace" wording simplified; HOA line added to Starter.
- `app/(marketing)/pricing/page.tsx`: hero, metadata, and an upgrade reason no longer describe "unlimited requests" as the paid difference (Free creation is unmetered since `894e025`; the limit is on submissions).
- `components/landing/HeroSection.tsx`, `about/page.tsx`, `from-a-closing/page.tsx`: same "submitted sheets" wording.
- `components/landing/MarketingStory.tsx`: fifth homepage capability for saved forms. `ForTcsSection.tsx`: HOA/saved forms mention; badge "Simple or advanced" became "Sheet or packet".
- `features/page.tsx` (metadata; dropped `last:md:col-span-2` because the list is now even), `how-it-works/page.tsx` (two items), `seller-utility-information-form/page.tsx` (eyebrow "Search Intent" became "Seller form"; HOA mention), `real-estate-closing-utility-checklist/page.tsx` (HOA checklist item).
- `tests/saved-seller-forms.spec.ts`: three pricing-page text assertions repointed to the new strings.

## Validation

- `npm exec tsc -- --noEmit`: clean. ESLint on all changed files: clean. `git diff --check`: clean.
- Vitest `from-a-closing-page` and `tc-utility-handoff-kit`: 6/6 passed.
- Not run: Playwright (including the edited `saved-seller-forms.spec.ts` pricing assertions), full Vitest, production build, and any browser/visual check of the homepage capability list, features grid, or pricing cards.

## Open items for the owner (not changed)

1. "Org-wide packet defaults" (Teams tier, both `PricingSection.tsx` and `marketing-content.ts`) and "shared defaults" (pricing page, Teams description): no organization-level packet default was found; saved forms are creator-owned with no team-wide editing. Branding Profiles are workspace-scoped. Confirm or reword.
2. The FAQ clause "seller and public links stay read-only after submission" was removed because `POST /api/seller/[token]` still only short-circuits submitted demo requests (first reported 2026-09-16). The same claim remains in the March entry of `lib/product-updates.ts` and the unused `components/landing/FeatureSection.tsx`. Enforce it or leave the claim out.
3. In-app upgrade copy still says "Unlimited requests" (`app/dashboard/settings/page.tsx:1147`, `requests/new/page.tsx:1287`, `requests/[id]/page.tsx:247`). Out of marketing scope; same inaccuracy.
4. Product updates: owner confirmed on 2026-10-05 that the HOA update is published. Nothing is drafted for saved forms or submission-based metering.
5. Homepage walkthrough video and the three How It Works screenshots predate saved forms and the HOA questions.
6. `app/opengraph-image.tsx` and `app/demo/page.tsx` were reviewed and are accurate.

## Next action

Optional: run `npm run test:e2e:desktop` (or the saved-forms and marketing-mobile specs) and look at `/`, `/features`, and `/pricing` on production after the automatic deploy. Owner decisions on open items 1 to 3 and 5 remain. No required work remains; no concurrent editing known.
