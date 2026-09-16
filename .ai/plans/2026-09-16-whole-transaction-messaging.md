# Plan: whole-transaction messaging (listing intake through closing)

- Date: 2026-09-16. Agent: Claude Code. Status: **Completed** 2026-09-16. Uncommitted.
- Authorization: local copy/markup changes only. No commit, push, deploy, real email, or production data change.
- Scope: messaging only. No new settings, selectors, reminders, reconfirmation, or feature work.

## Goal

Keep UtilitySheet focused on seller utility details and a buyer-ready handoff, but show that
collection can happen at listing intake, under contract, or as closing approaches.
Closing is the outcome, not necessarily the collection date.

## Verified facts (current code)

- Reusable link `/i/[slug]`: the seller enters the address, and `app/api/intake/[slug]/start` creates a new request. One link works across properties.
- Paid editing: `can_edit_submitted_sheet = isPaid && status === 'submitted'` (`app/api/requests/*`). Dashboard editing is Pro/Teams only.
- Read-only claim: existing copy (FAQ, `lib/product-updates.ts`) says seller links stay read-only after submission. **The server doesn't enforce this.** `POST /api/seller/[token]` only short-circuits submitted *demo* requests. A real submitted `/s/[token]` still loads, and resubmitting replaces the entries. This task adds no new read-only or reopen claims. The gap is reported as a follow-up (not fixed here, out of scope).
- The Property Handoff Packet includes time-sensitive fields (garage code, keys/remotes "at closing") in `lib/packet/modules.ts`.
- Seller-facing default templates (`lib/message-templates/defaults.ts`) are already stage-neutral. No change.
- `TestDriveCard.tsx` already says "listing email, text template, or transaction checklist". It's owned by the uncommitted dialog task, so it is not edited.
- Rendered homepage sections: Hero, MarketingWorkflow, MarketingCapabilities, SocialProofBar, MarketingAudience, Pricing, FAQ, FinalCta. `ArtifactPreviewBand`, `AudienceSection`, and `BeforeAfterSection` are unused and not edited.

## Changes

1. `components/landing/HeroSection.tsx`: new eyebrow, H1, and description that make early collection visible. The closing benefit stays.
2. `components/landing/MarketingStory.tsx`:
   - A compact "When to send it" row with three scenarios in the workflow section.
   - Capability 03 notes that early details may need review before handoff.
   - Capability 04 flags time-sensitive access details.
   - The audience band reads "listing to closing".
3. `app/(marketing)/marketing.css`: minimal styles for the scenario row (desktop and mobile).
4. `lib/marketing-content.ts`:
   - The "Who is it for" and "one link" FAQ answers are updated.
   - New FAQ: "When should I send the seller link?"
   - Workflow step 01 copy is updated.
5. `app/(marketing)/tc-utility-handoff-kit/page.tsx`:
   - Three email templates: listing welcome, listing-side closing prep, and buyer-side forward via the listing agent.
   - The checklist and metadata are updated.
   - The text template stays.
6. `app/(marketing)/how-it-works/page.tsx`, `utility-sheet-for-transaction-coordinators/page.tsx`, `utility-sheet-for-real-estate-agents/page.tsx`: targeted copy updates.
7. `app/dashboard/page.tsx`: the "How the reusable link works" accordion gains two "where to put it" lines.
8. Homepage meta description: mention listing intake while keeping the closing title.

## Acceptance criteria

- Early collection is visible in the homepage hero.
- The three scenarios appear once on the homepage and as templates in the kit.
- Buyer-side copy asks the listing agent to forward the link, not to answer.
- No claims about reopening, reconfirmation, time savings, or evidence.
- Closing-related search intent is kept in titles.
- Layout is intact on desktop and mobile.

## Validation

- Focused Vitest (kit page, FAQ/marketing tests).
- ESLint on changed files and `tsc`.
- Screenshots of the homepage at desktop and mobile widths, plus the kit page.

## Outcome

Implemented as planned, with these deviations:

- Added `components/marketing/copy-template-button.tsx`, a small client Copy button with an inline "Copied" state and no toast dependency, so each kit email can be copied.
- Updated `tests/unit/tc-utility-handoff-kit.test.tsx`. Two templates now share the seller greeting, so the old single-match assertion would fail. A new test covers all three emails and the buyer-side wording.
- Not changed:
  - Seller-facing default message templates (already stage-neutral).
  - `TestDriveCard.tsx` (owned by the dialog task; it already mentions a listing email).
  - Unused landing components.
  - The homepage `<title>` (keeps closing search intent).

Validation:

- Vitest: 6 related files, 22/22 passed.
- ESLint on changed files: clean.
- `tsc --noEmit`: only 2 errors, both in stale generated `.next/**/validator.ts` for `app/api/account/closure-readiness/route.ts`, which the concurrent account-closure session deleted. There are no errors in this task's files.
- `npm run security:scan`: passed.
- Playwright screenshots on a temporary `next dev -p 3107` (since stopped): homepage hero and scenario row, and the kit templates, at 1440px, 900px, and Pixel 7. Layout is intact, with 0px horizontal overflow on all of them.
- Full Playwright and build not run (copy/markup-only change; concurrent session has in-flight changes).

Follow-up, not in scope (reported to the owner):

- The existing claim "seller links stay read-only after submission" is not enforced server-side for non-demo requests. `POST /api/seller/[token]` accepts a resubmission and replaces the entries, and the `/s/[token]` page loads regardless of status. Either enforce it or soften the FAQ and `lib/product-updates.ts` copy.

Optional hypotheses to validate (not built):

- Whether early (listing-intake) collection actually gets used.
- Whether early data needs a review step.
