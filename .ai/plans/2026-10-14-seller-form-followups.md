# Seller form follow-ups: default brand color, pinned phone button, desktop Review, copy

- Date: 2026-10-14. Agent: Claude Code. Branch: `main` (uncommitted). Status: **Completed and validated (2026-10-14). Owner authorized commit, push and the migration: `migrations-brand-profile-default-color.sql` applied to the `.env.local` database (host SHA-256 prefix `79d6a988e446`) in one transaction; catalog shows defaults `#23588a`/`#0b4072`; 162 rows, 71 emerald primaries and a fingerprint of every stored color unchanged. No required work remains.**
- Origin: owner decisions in the "Outcome" of `.ai/plans/2026-10-14-seller-form-device-ux.md` (committed as `68fbf38`).
- Preserve: everything listed in that plan's "Preserve" line, plus the `--brand-accent-fill/-contrast/-ink` contrast variables. No change to what sellers are asked or to stored values.
- No commit, push, deploy, migration run or data write without separate authorization.

## Verified facts (before implementation)

1. **Default brand color.** `DEFAULT_BRAND_COLOR = '#10b981'` in `lib/branding/deliverable.ts` feeds `resolveBrandColor` (seller form, web packet), `lib/pdf/packet-html.ts` and `lib/branding/preview-data.ts`. Separate hard-coded copies: `lib/neon/queries/brand-profiles.ts` insert, `app/api/branding/route.ts` (auto-created profile), `lib/activation/ensure-account-activation.ts`, `app/api/branding/test-email/route.ts`, `lib/email/email-service.ts` (seller request and reminder emails), `app/onboarding/page.tsx`, `components/branding/BrandProfileForm.tsx`, `schema.sql` column defaults, `lib/validation/schemas.ts` example text.
   - The branded seller email uses `secondary_color` (default `#059669`, emerald-600) for its header gradient end and its button. Changing only the primary would give new profiles a blue-to-green header and a green button, so the secondary default moves too: `#0b4072`, which is what onboarding already derives from a primary (`adjustHexColor(primary, -24)`).
   - App light `--primary` is `oklch(0.45 0.1 250)` = `#23588a` (7.41:1 with white, so buttons need no darkening). Dark `--primary` (`#679dd4`) is a theme variant; brand profiles store one color and the seller form derives dark-mode text ink from it.
   - Read-only count (one `readOnly` transaction, `transaction_read_only = on`, aggregates only; database host SHA-256 prefix `79d6a988e446`, the `.env.local` database): 162 brand profiles, **71 store `#10b981` as primary** (71 of 145 accounts), 63 store `#059669` as secondary, 57 both, 0 missing a primary. Nothing written. Existing rows are not migrated (owner instruction); stored colors cannot tell "chose emerald" from "kept the default".
   - The app always passes explicit colors on insert, so the `schema.sql` column defaults are a backstop only. A focused migration (`migrations-brand-profile-default-color.sql`, column defaults only, no row changes) is written but **not run**.
   - Out of scope, reported: UtilitySheet product emails (TC completion, referral credit, weekly summary, and two legacy seller templates) hard-code an emerald gradient that is not a brand fallback; `lib/demo-pdf-generator.tsx` (demo only).
2. **Pinned button.** Steps animate with framer-motion transforms, so `position: fixed` inside a step would be positioned relative to the moving step. Use `position: sticky; bottom: 0` on the existing action container below `sm` instead: same DOM place (tab order unchanged), natural position after the last content (never covers it), works inside transformed parents; `main` uses `overflow-x: clip`, which is not a scroll container.
3. **Desktop.** `SellerLayout` sets `max-w-2xl` on both the header row and `main`; a width prop changes both together so the header stays aligned.
4. **Copy.** `WATER_SOURCE_OPTIONS`/`SEWER_TYPE_OPTIONS` labels in `lib/packet/seller-questions.ts` drive the seller tiles, Review, the web packet and the PDF Home Basics rows (`getWaterSourceLabel`/`getSewerTypeLabel`). The dashboard editor (`components/requests/SubmittedSheetEditor.tsx`) has its own list.

## Approach

1. `DEFAULT_BRAND_COLOR = '#23588a'`, new `DEFAULT_BRAND_SECONDARY_COLOR = '#0b4072'`; every hard-coded default above imports them. Onboarding presets gain "Slate blue" first (Emerald stays a choice). Schema defaults mirrored; migration file written, not run. Docs and tests that assume emerald is the default updated.
2. Home Basics (Continue + disabled reason), handoff sections (Back/Continue row + Skip, the group they already form) and Review (Back + Submit) get `max-sm:sticky bottom-0` with a full-bleed background, top border and `env(safe-area-inset-bottom)` padding. While a text input or textarea is focused the bar un-pins (returns to its place after the last question) instead of floating over the iOS keyboard; it is in flow, so nothing shifts. A focus guard scrolls any focused element the pinned bar would cover (WCAG 2.4.11) and `scroll-padding-bottom` follows the bar height. Review scrolls a new submit error or notice into view. No animation added. Provider steps unchanged; `sm`+ classes unchanged.
3. At `lg`: question steps stay `max-w-2xl`; helpers, hints and secondary labels `text-xs` → `text-sm`. Review uses a wider column (header and `main` together) with Home Basics beside Utility Providers and additional details full width.
4. Seller tiles and Review show "Paid by HOA" through a seller-form label on the option (`formLabel`); `label` ("Included in HOA / Condo Fee") stays for the packet and PDF; the dashboard editor keeps its own wording. Water/sewer `grid-cols-2 sm:grid-cols-4`. Test banner "Test mode: use made-up answers." on every size.

## Acceptance criteria

- New profiles, onboarding, PDF/packet/email fallbacks and previews use `#23588a`/`#0b4072`; seller form default passes AA without darkening; no data written.
- Phones (< 640px): primary action visible at the bottom on Home Basics, handoff sections and Review at every scroll position; never covers the focused element or the last content; un-pinned while typing; tab order, scroll reset, header clearance unchanged. 640px+ unchanged.
- `lg`+: Review two columns, header edges aligned with the content; question steps unchanged width.
- Water/sewer labels one line at `sm`+ (four columns), 2x2 on phones; banner one line with Exit test on every size.
- No horizontal overflow, runtime errors or unexpected requests; existing seller tests pass.

## Validation plan

Scratch real-page harness (outside the repo) at 320x568, 390x664, 844x390, 568x320, 768x1024, 1280x720, 1920x1080, light and dark, before and after. New Playwright regressions in the isolated config. Focused unit tests, complete Vitest, isolated Playwright, Next dev-server seller specs on three projects, branding/PDF/packet tests, TypeScript, ESLint on changed files, security scan, `git diff --check`.

## Outcome (2026-10-14)

Implemented as approached, with these deviations (each found while measuring or testing):
- **Secondary default moved too** (`#059669` to `#0b4072`): the branded seller email draws its gradient end and button from it, so emerald would have remained there for new profiles.
- **Review shows "Paid by HOA"** as well as the tiles: it is part of the seller form and should match what the seller tapped. The packet, PDF and the dashboard editor keep "Included in HOA / Condo Fee". Implemented as `formLabel` on the two options with `getWaterSourceFormLabel`/`getSewerTypeFormLabel`; the stored value `hoa`, the hint and the HOA No reconciliation are unchanged.
- **Pinned only on phone screens taller than 500px** (new `pinbar` variant in `app/globals.css`). On a 568x320 landscape phone the handoff bar took 123 of 320px (38%). The 844x390 landscape phone is 640px+ wide and was already unpinned, so both landscape phones now behave the same. One variant to change if the owner prefers pinning there too.
- **"Hide while typing" is an un-pin**: the bar returns to its place after the last question (it is in flow, so nothing shifts) instead of disappearing.
- **Re-pins only after a press finishes.** The existing `seller-home-basics-mobile` spec caught a lost tap on Mobile Safari: tapping a dues chip right after typing blurred the field on mousedown, the bar re-pinned over the chip and the mouseup landed on the bar.
- **Scroll padding owned by the newest bar.** Review is replaced by the sending screen and remounted; with reduced motion the old copy's cleanup cleared the new copy's `scroll-padding-bottom`.
- **Submit errors and notices are scrolled into view** whenever Review shows one, including after the sending screen. This also fixes a pre-existing case on every screen size where a failed send left the error below the fold. On arrival from another step, SellerLayout's scroll reset (a parent effect, so it runs after) keeps the page at the top.
- **Review width via a custom property** (`--seller-column` on the layout root, static `lg:max-w-[var(--seller-column)]` classes): Playwright WebKit kept the 672px width when a step change added `lg:max-w-5xl` to the existing `main`/header elements (re-setting the class fixed it; other responsive class swaps restyled normally).
- **Water/sewer tile hints stay `text-xs` at `lg`**: at `text-sm` the "provider name" hint wrapped to three lines in the four-column tiles. Other helpers, summaries, Review labels/chips/Edit links, handoff field labels and provider helpers are `lg:text-sm`; only the uppercase Required tags and the Optional divider remain at 12px.
- **Utility Providers heading** is as tall as the Home Basics Edit button at `lg`, so the side-by-side headings line up.
- **Onboarding presets**: "Slate blue" (the default) replaces "Blue" as the first of four swatches; Emerald, Amber and Slate remain.

Files: `lib/branding/deliverable.ts` (`DEFAULT_BRAND_COLOR` `#23588a`, new `DEFAULT_BRAND_SECONDARY_COLOR`), `lib/neon/queries/brand-profiles.ts`, `app/api/branding/route.ts`, `app/api/branding/test-email/route.ts`, `lib/activation/ensure-account-activation.ts`, `lib/email/email-service.ts` (seller request/reminder fallbacks only), `app/onboarding/page.tsx`, `components/branding/BrandProfileForm.tsx`, `lib/validation/schemas.ts` (example text), `schema.sql`, new `migrations-brand-profile-default-color.sql` (column defaults only, **not run**), `docs/pdf-system-reference.md`, `docs/branding-profile-pdf-redesign-handoff.md`; `app/globals.css` (`pinbar` variant), new `components/seller-form/pinned-actions.ts`, `SellerLayout.tsx` (`wide`, banner), `SellerWizard.tsx` (passes `wide` on Review; comment), `steps/HomeBasicsStep.tsx`, `steps/AdvancedDetailsStep.tsx`, `steps/ReviewStep.tsx`, `steps/UtilityStep.tsx` and `steps/WelcomeStep.tsx` (`lg:text-sm` only), `lib/packet/seller-questions.ts`.

PDF check: the shared preview fixture rendered through `buildPacketPdfHtml` and Chromium `page.pdf()` with the production page settings (Simple and Advanced) uses `#23588a` and no `#10b981`; the Simple page image was inspected (section bars, initials tile and provider phones in slate blue; layout unchanged). Accent provider-phone text goes from 2.5:1 (emerald) to 7.4:1.

### Measurements (scratch real-page harness, synthetic data, settled viewport screenshots, light and dark)

Advanced form, HOA Yes, all nine utilities, default brand (no stored color). "On" = fully on screen below the header at the top of the step; the number is the button's bottom in screen heights.

| Viewport | Home Basics Continue | Handoff Continue | Review Submit | Water/sewer labels | Test banner |
| --- | --- | --- | --- | --- | --- |
| 320x568 WebKit | off, 2.30 → **on**, pinned 92px | off, 1.41 → **on**, pinned 123px | off, 3.02 → **on**, pinned 71px | 2 lines → 1 line (2 col), row 100 → 80px | 2 lines → 1 |
| 390x664 WebKit | off, 1.83 → **on**, 92px | off, 1.20 → **on**, 123px | off, 2.58 → **on**, 71px | 2 lines → 1 line, row 84 → 80px | 1 line |
| 844x390 WebKit | off, 3.35 → off, 2.98 (not pinned) | unchanged | unchanged | 1 line, 2 → 4 col, row 75 → 90px | 1 line |
| 568x320 WebKit | unchanged, not pinned | unchanged | unchanged | 1 line (2 col) | 1 line |
| 768x1024 Chromium | off, 1.34 → off, 1.20 | unchanged | unchanged | 1 line, 2 → 4 col, row 76 → 92px | 1 line |
| 1280x720 Chromium | off, 1.90 → off, 1.72 | unchanged | off, 2.66 → off, 2.22 (two columns) | 1 line, 4 col | 1 line |
| 1920x1080 Chromium | off, 1.27 → off, 1.15 | unchanged | off, 1.77 → off, 1.48 (two columns) | 1 line, 4 col | 1 line |

- Review at 1280/1920: column 672 → 1024px; Home Basics and Utility Providers cards 484px side by side, additional details 992px full width; header content edges equal the content edges (144/1136 at 1280, 464/1456 at 1920). Question steps stay 672px.
- Phones: with a text field focused the bar is un-pinned and never overlaps the field; at the bottom of each page the last content ends above the bar; a focused control under the bar is scrolled clear of it; tab order unchanged (last optional control, then Continue).
- 12px text at `lg`: Home Basics 12 elements → 3 (Required tags, Optional divider); Review 9 → 0.
- Every viewport, light and dark: no horizontal overflow, runtime errors or unexpected requests; each journey submits once. Contrast: the only text under AA is the disabled Continue (3.13:1), which WCAG exempts.

### Validation (Node 20.19.0, Upstash variables cleared, synthetic data only)

- Read-only brand-color count as recorded above. No other database access; no AI, email or data writes.
- Complete Vitest: 254 files passed / 1 skipped; 2,214 tests passed / 13 skipped / 0 failed. New `tests/unit/seller-pinned-actions.test.tsx` (7); updated `brand-accent-contrast`, `home-basics-labels`, `seller-wizard-hoa-flow`, `seller-wizard-required-basics-trash-cable`. A first complete run had 10 failures because JSDOM has no `scrollIntoView` (now an optional call).
- Isolated Playwright (`tests/telemetry.playwright.config.ts`, three projects): 87 passed, including new `tests/seller-pinned-actions.spec.ts` (12 tests × 3: pinned Home Basics on two phones with focus, cover, keyboard and scroll-reset checks; handoff and Review with a failed send and retry under reduced motion; tablet and short screen unpinned; desktop Review layout and header alignment at 1280 and 1920; tile wrapping at five widths) and product-default/emerald contrast cases in `seller-layout-devices.spec.ts`.
- Next dev-server Playwright (three projects): `seller-wizard-journey`, `seller-wizard-review-edit`, `seller-reopen`, `test-drive-journey`, `saved-seller-forms` (HOA preview label updated), `maintenance`: 116 passed, 1 skipped (existing desktop skip). Dev server stopped.
- TypeScript passed; ESLint 0 errors on changed files (8 existing warnings: `<img>` and untouched SellerWizard hook lines); `security:scan` passed; `git diff --check` passed; new files checked for secret patterns.
- Not run: `seller-flow` and `intake-mobile` specs (unmocked calls against the dev server), `packet-responsive.spec.ts` (packet unchanged), production build, physical devices, real on-screen keyboards, VoiceOver/TalkBack.

### Owner decisions and follow-ups (not done)

- `migrations-brand-profile-default-color.sql`: applied 2026-10-14 with owner authorization (see Status).
- The 71 existing profiles that store emerald keep it. Moving them would be a data migration, and stored colors cannot tell "chose emerald" from "kept the default".
- UtilitySheet's own emails (completion, referral credit, weekly summary, two legacy seller templates) hard-code an emerald header and button, and `lib/demo-pdf-generator.tsx` uses emerald. They are not brand fallbacks, so they were left as they were.
- Pinning on landscape phones (currently off under 500px tall).

## Coordination

`telemetry-slice-8` (Codex, completed and pushed to its own branch, not merged into main) also changes `SellerWizard.tsx` and `UtilityStep.tsx`. This work keeps edits to those two files small (`SellerWizard.tsx`: one `wide` prop line and a comment; `UtilityStep.tsx`: eight `lg:text-sm` class additions); whoever merges Slice 8 into main must reconcile them.
