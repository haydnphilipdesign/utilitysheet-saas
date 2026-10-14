# Seller form UX/UI across device classes (compact shared header)

- Date: 2026-10-14. Agent: Claude Code. Branch: `main` (uncommitted). Status: **Completed and validated; committed locally on `main` with owner authorization (2026-10-14); not pushed or deployed. No required work remains.**
- Origin: follow-up from `.ai/plans/2026-10-14-mobile-home-basics.md` (shared header too tall on small screens) plus a full seller-form review on every device class.
- Preserve: `02a5281` scroll reset and header clearance (`tests/seller-wizard-scroll.spec.ts`); `44391b3` Home Basics summary rows and Required tags; required water/sewer and HOA-dependent choices; every configured question and answer; draft restore, reopen, Review edit/catch-up, Back, submission and retry; progress and telemetry; brand theming through `lib/branding/deliverable.ts` CSS variables; keyboard behavior; public token, privacy and rate-limit boundaries. No change to what sellers are asked.

## Method (verified, synthetic only)

Scratch harness outside the repo (session scratchpad `audit/`): esbuild bundle of the real `app/s/[token]/page.tsx` and wizard, compiled `app/globals.css`, synthetic API routes (no Next server, AI, email or database). Journey: Welcome, Home Basics (HOA Yes, public water/sewer, two fuels), every provider step (suggestions, meter, trash days), handoff sections, Review, submit. Viewport screenshots after animations settle; metrics read from the DOM; text contrast computed from rendered colors with translucent backgrounds composited. WebKit for 320x568, 390x844, 390x664 (Safari's visible area), 430x932, 844x390, 568x320; Chromium for 768x1024, 1024x768, 820x1180, 1180x820, 1280x720, 1366x768, 1440x900, 1920x1080, 2560x1440 and 640x450 (a 1280x900 laptop at 200% zoom). Variations: simple/advanced, HOA Yes/No, long address/brand/intro, logo vs initials vs no brand, emerald (default), yellow and navy brands, dark mode, reduced motion, test drive, empty/slow/failed suggestions, search, maintenance, submitted, reopened, submit failure, keyboard.

No runtime errors, unexpected requests or horizontal overflow on any viewport or variation. Journeys submitted once each.

## Findings, ranked (evidence from the harness)

### Clear defects

1. **Header eats short screens.** Fixed header height (share of viewport): 320x568 154px (27%); 390x664 154 (23%); 844x390 landscape 112 (29%); 568x320 landscape 154 (**48%**, under the `sm` breakpoint so it gets the phone layout with the Property box); 640x450 (200% zoom) 113 (25%). With the test-drive banner: 229px on 320x568 (40%) and 179 on 1280x720. On 568x320 only the step title and one row of choices fit; on 844x390 one provider card fits. Cause: brand row with a second subtitle line ("Utility information request"), a separate two-line Property box on phones, a progress label row, generous padding, a three-line test banner.
2. **Brand-color contrast fails WCAG AA throughout.** Default brand `#10b981` (most accounts): white button text 2.54:1 (Get Started, Continue, Submit, Search Providers, initials badge); accent question labels and Edit links 2.43:1; selected tile text 2.22:1. Yellow brand `#facc15`: 1.4-1.5:1. Navy `#1e3a8a` is fine in light mode but its labels and selected tiles drop to 1.9:1 in dark mode. `--brand-accent-contrast` exists in `buildBrandAccentStyle` but is hard-coded white and unused.
3. **Low-contrast secondary text.** Tile hints use `opacity-70` on muted text: 1.77:1 ("We'll ask the provider name next"); `text-muted-foreground/80` step counter and save note 3.79-3.8:1; "Saved" flash `emerald-500` 2.36:1; submit-error Retry 4.09:1.
4. **Desktop/tablet address truncated.** Header property capped at `max-w-[180px]`: "12 Synthetic Street, Faketo..." on every viewport from 768 to 2560 although half the header row is empty. No title/full-text fallback.
5. **Water/sewer tiles wrap at 4 columns.** From 640px up, four ~118-150px tiles: "Included in HOA / Condo Fee" wraps to 3 lines and stretches the whole row to ~108px (all tablet, laptop and desktop sizes).
6. **Screen-reader semantics.** Step headings are `h3` under the header `h1` (no `h2`); step changes are not announced (focus drops to `body`, no live region); progress bar has no `progressbar` role. Keyboard order itself is fine (Tab after Continue lands on the new step's first control).
7. **Touch targets under 44px on phones:** provider Back arrow 32x32 (every provider step), trash/recycling day chips 33px, recycling Yes/No 33px, Change provider/Cancel Search 35px. Tablets (touch) get the desktop `sm:` sizes: day chips 38px, Back 36px.
8. **Paused/submitted screens show a progress row** ("Paused 0%", "Submitted 100%") that means nothing there and costs ~30px.

### Judgment calls (for the owner, not implemented)

- Wider layout on large screens: content is `max-w-2xl` (672px) everywhere, 26% of a 2560px screen; type is 12-14px. A wider column or two-column Review on desktop is a design choice.
- Sticky Continue/Submit bar on phones (Review Submit sits at 3.1 screens on 320x568 with an advanced form).
- The default brand color is emerald, which the app's design system reserves for success states.
- Desktop type scale (`text-xs` labels at 1440+), and the front-loaded progress percentage (Home Basics shows 18%).
- Copy: shorter "Included in HOA / Condo Fee" label; test-drive banner wording.

## Approach (Phase 2)

1. `SellerLayout` header, CSS-only sizing (no scroll-driven collapse, so no jumpy header):
   - Phones: address moves into the brand row's second line (replacing "Utility information request"), with a map-pin icon and screen-reader "Property:" prefix; smaller mark and padding; slim progress row. Full address stays on Welcome and Review/Success copy.
   - Short screens (`max-height: 500px`: landscape phones, heavy zoom): one row (mark, name, address, step/percent) with the progress bar as a thin line on the header's bottom edge.
   - `sm`+: address column up to half the row with `title`; slightly tighter padding.
   - Test-drive banner one line on phones; progress hidden on paused/submitted screens; `role="progressbar"`; polite live region announcing the step; "Saved" in an accessible green.
   - Header height measured before paint (layout effect) so the content padding never jumps.
2. Brand contrast in `lib/branding/deliverable.ts`: keep `--brand-accent` (raw brand color for bars, borders, icons) and add derived, contrast-checked variables: `--brand-accent-fill` (solid fill that carries text; darkened only when white text would fail, or kept with dark text for very light brands), `--brand-accent-contrast` (white or near-black), `--brand-accent-ink` / `--brand-accent-ink-dark` (text on light/dark surfaces, adjusted only as far as 4.5:1 needs). Components use `--brand-accent-text` (ink chosen by light/dark scope) for text and the fill pair for buttons. Brands that already pass are unchanged. PDF and packet do not use these variables.
3. Remove the contrast-reducing opacity on hints and counters; accessible Saved/Retry colors.
4. Water/sewer: two columns at every width (one line per label on desktop).
5. Step headings `h2`; tap targets 44px for the Back arrow, day/recycling chips and secondary text buttons.

## Acceptance criteria

- Header: 320x568 ≤ 100px; 568x320 and 844x390 ≤ 64px; desktop ≤ 113px; address visible on every size (full on desktop where it fits); no layout shift on load; scroll spec and header-clearance checks pass on all projects.
- Contrast: no text below 4.5:1 (3:1 large) for emerald, yellow and navy brands in light and dark mode, except the decorative gradient heading (transparent fill, false positive).
- No wrapped water/sewer labels beyond two lines at any width; no horizontal overflow; no new runtime errors or requests.
- All existing seller unit and browser tests pass (heading-level assertions updated), plus new browser regression for header height/clearance on short screens, address visibility and contrast.

## Validation plan

Focused unit tests, complete Vitest, isolated Playwright (`tests/telemetry.playwright.config.ts`), Next dev-server seller specs on all three projects, TypeScript, ESLint on changed files, security scan, `git diff --check`, and a scratch re-run of all viewports/variations with before/after numbers.

## Outcome (2026-10-14)

Implemented as approached above. Deviations and details:
- Short-screen header: the step count is rendered once and moved beside the brand row by CSS (`short:` variant, `max-height: 500px`, in `app/globals.css`); the brand row is fixed at 36px there. A first version rendered the count twice and a unit test caught it.
- Header background raised from 50% to 95% opacity: WebKit without backdrop blur (and any browser with reduced transparency) showed page text behind the compact header.
- Found during the new browser regression and fixed: each step slides in from 20px to the right, which widened the page by up to 4px for about 300ms after every navigation (pre-existing). `main` now uses `overflow-x: clip` (not a scroll container, so the fixed header, scroll reset and sticky behavior are unaffected).
- Handoff-section inputs and selects stay 44px at every width (they shrank to 40px at `sm`, which includes landscape phones and touch tablets).
- Logo image is decorative (`alt=""`) because the brand name is printed beside it.
- Test-drive banner shortens to "Test mode. Use made-up answers." on phones (agent-facing; full sentence from `sm`).
- `lib/branding/deliverable.ts`: new `brandAccentTextColors`, `contrastRatio`; `buildBrandAccentStyle` adds `--brand-accent-fill`, `--brand-accent-ink`, `--brand-accent-ink-dark`, and `--brand-accent-contrast` is now computed (was hard-coded white and unused); `--brand-accent-strong` darkens the fill. `--brand-accent` and the soft/border tints are unchanged. Only the seller wizard and the Form Editor intro preview use these; the PDF/packet do not. `wizardBrandScope` (wizard-ui) selects light or dark ink. Default emerald `#10b981` buttons become `#0c855d` with white text (4.64:1); yellow keeps its fill with dark text; navy is unchanged in light mode and lightened for dark-mode text.

Measurements (scratch harness, before → after):

| Viewport | Header px (share) | Welcome CTA (screens) | Home Basics Continue | Review Submit |
| --- | --- | --- | --- | --- |
| 320x568 WebKit | 154 (27%) → 92 (16%) | 1.08 → 0.97 | 2.84 → 2.74 | 3.13 → 3.02 |
| 390x664 WebKit | 154 (23%) → 92 (14%) | 0.92 → 0.87 | 2.20 → 2.13 | 2.67 → 2.58 |
| 390x844 / 430x932 | 154 → 92 | 0.83 → 0.79 / 0.78 → 0.75 | 1.73 → 1.68 / 1.56 → 1.50 | 2.10 → 2.03 / 1.90 → 1.84 |
| 844x390 landscape | 112 (29%) → 49 (13%) | 1.57 → 1.41 | 3.91 → 3.99 | 4.90 → 4.74 |
| 568x320 landscape | 154 (48%) → 49 (15%) | 1.72 → 1.39 | 4.43 → 4.12 | 5.55 → 5.22 |
| 640x450 (200% zoom) | 113 (25%) → 49 (11%) | 1.37 → 1.23 | 3.52 → 3.49 | 4.27 → 4.13 |
| Tablets, laptops, desktops (768-2560) | 113 → 103 | ±0.01 | +0.03 to +0.05 (2x2 water/sewer) | -0.01 |

- Test-drive header 229 → 146px (320x568), 179 → 157 (1280x720). Paused/submitted screens 154 → 57 (phone), 113 → 65 (laptop).
- Contrast failures (all brands × light/dark × phone/laptop × five steps): many (2.54:1 default CTAs, 1.4:1 yellow, 1.9:1 navy dark) → 0, excluding the gradient-clipped Welcome heading (transparent fill, false positive).
- Address: truncated at 180px on every viewport ≥ 640 → shown in full (up to 55% of the row, `title` with the full address); phones show it under the brand name (truncated as before, full on Welcome).
- Water/sewer labels: 3 lines at 4 columns → at most 2 lines (phones), 1 line (desktop).
- Touch targets under 44px in the journey: Back arrow, day/recycling chips, Change provider/Cancel Search, landscape selects → none (remaining: footer contact links, inline text, fine-pointer inputs at 40-42px on desktop).
- Semantics: step headings `h2` (inner `h3`), `progressbar` with value text, polite step announcement; keyboard order unchanged (Tab after Continue reaches the new step's first control).
- Every viewport: journey completes and submits once; headings ≥ 16px below the header; no horizontal overflow, runtime errors or unexpected requests. Landscape 844x390 Home Basics is +0.08 screens because water/sewer moved from one row of four to 2x2; every other step there is shorter.

Validation (Node 20.19.0, synthetic data only):
- Complete Vitest: 253 files passed / 1 skipped; 2,204 tests passed / 13 skipped / 0 failed. New: `tests/unit/brand-accent-contrast.test.ts` (14), `tests/unit/seller-layout-header.test.tsx` (4). Heading-level assertions updated in `seller-wizard-{reopen,required-basics-trash-cable,review-navigation}`.
- Isolated Playwright (`tests/telemetry.playwright.config.ts`, 3 projects): 45 passed, including new `tests/seller-layout-devices.spec.ts` (header budgets at 320x568, 844x390, 568x320, 1280x720; clearance; address; progressbar/announcement; no overflow; AA contrast for emerald, yellow and navy-dark). All 7 new tests fail on the previous code (checked by stashing the application changes, then restored). Re-run after the final select tweak: home-basics, layout-devices, scroll specs 27 passed.
- Next dev-server Playwright (3 projects): `seller-wizard-journey`, `seller-wizard-review-edit`, `seller-reopen`, `test-drive-journey`, `saved-seller-forms`, `maintenance`: 116 passed, 1 skipped (existing desktop skip). One assertion updated to an exact match (`'2 of 6'` also matched the new announcement text). A first run had one Desktop Chrome HOA journey stuck on the loading screen under parallel load; it passed on both reruns. Dev server stopped.
- TypeScript passed; ESLint 0 errors (8 existing warnings: `<img>` and untouched SellerWizard hook lines); `security:scan` passed; `git diff --check` passed.
- Not run: `tests/seller-flow.spec.ts` and `tests/intake-mobile.spec.ts` (they leave some seller API calls unmocked against the dev server, which reads `.env.local`); production build; physical devices, real virtual keyboards, VoiceOver/TalkBack; hosted checks.

Owner decisions (not implemented): see "Judgment calls" above, plus: the deeper default-emerald button color (approve or choose a different accessible default); whether landscape phones should keep a single row of four water/sewer tiles (shorter, but labels wrap to 3 lines).
