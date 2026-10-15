# UtilitySheet selected Diffui design — local implementation QA

Date: 2026-10-15. Current scope: marketing homepage redesign only. The user deferred the actual print PDF redesign; it is preserved separately and excluded from this change.

## Findings and comparison history

- **Resolved P2 — oversized desktop hero.** The first implementation pushed the three-step strip roughly 54 CSS pixels below the selected reference, changing the first-screen proportions. Evidence: `.qa-artifacts/diffui/comparison-desktop-v1.jpg`. Fixed the desktop image box at 600 CSS pixels while preserving natural responsive sizing on mobile. The revised strip starts at approximately y=759.8, compared with y=756 in the reference. Post-fix comparison: `.qa-artifacts/diffui/comparison-desktop-v2.jpg` and final comparison below.
- **Resolved P2 — coral button text contrast.** White text on the initial coral token had approximately 4.12:1 contrast. Changed the marketing CTA token to `#cc4932`, approximately 4.60:1 against white. Final browser capture confirms the darker coral is applied.
- No remaining actionable P0/P1/P2 visual findings in the reviewed states.

## Source, capture, and normalization

- Source visual truth: `C:/Users/haydn/AppData/Local/Temp/utilitysheet-diffui-reference.png`, the selected second Diffui design, 1440 × 1024 pixels. The build link's access token is not stored in project files.
- Implementation: `http://localhost:3150/`, screenshot `.qa-artifacts/diffui/home-desktop-final.png`, 1152 × 819 pixels.
- CSS viewport: 1440 × 1024. State: public homepage, signed out, light theme, top of page, menu closed. Source and implementation represent the same desktop content region without browser/canvas chrome.
- Capture density: browser reported devicePixelRatio 1; Windows display scaling required an explicit CDP clip scale of 0.8 to capture the complete intended CSS viewport. The source was downsampled to the same 1152 × 819 pixels before comparison. Screenshots were not stretched independently or judged at mismatched densities.
- Full-view combined evidence: `.qa-artifacts/diffui/comparison-desktop-final.jpg`, 2304 × 850 pixels including a 31-pixel label strip. Source left, rendered implementation right. Both opened and judged together after the final capture.
- Focused typography/control comparison: `.qa-artifacts/diffui/comparison-hero-detail.png`, source and implementation together. This detail predates only the final darker coral adjustment; final full-view evidence verifies that token.
- Responsive implementation captures: `.qa-artifacts/diffui/home-mobile.png` (390 × 844 CSS viewport), `home-mobile-320.png` (320 × 740), and `home-tablet.png` (820 × 1180), normalized with the same 0.8 capture scale. The source supplies no mobile/tablet layouts; these are implementation usability checks rather than claims of exact mobile fidelity.

## Required fidelity surfaces

| Surface | Review and disposition |
| --- | --- |
| Fonts and typography | Figtree heavy sans matches the reference's compact, rounded headline character. Desktop headline preserves the two-line wrap, hierarchy, optical weight, and tight tracking. Body and small navigation text remain readable. Mobile wraps naturally without clipping. Existing brand wordmark is intentionally retained. |
| Spacing and layout rhythm | Cream page, restrained navigation, left copy/right phone and paper, thin rules, and three equal workflow columns follow the selected composition. Hero-height issue was corrected and recaptured. Mobile stacks copy then artwork; tablet retains the split layout. Header controls fit at 320 CSS pixels. |
| Colors and visual tokens | Cream `#f8f6f0`, navy `#0a2c40`/`#123e56`, mint details, and coral CTAs reproduce the palette. Coral is intentionally darker for white-text contrast. Tokens are scoped to marketing; product screens retain their existing theme. |
| Image quality and assets | Local generated transparent WebP, 1385 × 1136, approximately 240 KB. Phone, two-column paper, and mint/navy pattern share the source's art direction. No source screenshot is embedded as the page. Existing brand logo and library icons remain real assets. At intended display size there is no material clipping or transparency halo. Small raster document text is illustrative, explicitly captioned; the actual PDF remains selectable vector text. |
| Copy and content | Selected headline and CTA hierarchy retained. Supporting copy reflects actual reusable links, seller flow, and web/PDF output. Added audience and accurate Free allowance. Removed unsupported sample account numbers, balance/service assertions, and delivery-status claims. Existing lower-page product content, pricing, SEO, demo routes, and analytics behavior retained. |

Intentional adaptations: actual UtilitySheet house logo in the navigation; accurate product copy and allowance; darker coral; new synthetic hero illustration instead of an exact reproduction of fictional account/status data. The paper in the hero is an illustrative marketing preview. The actual downloadable PDF retains its existing layout.

## Interaction and responsive checks

- Browser-reviewed desktop 1440 × 1024, tablet 820 × 1180, mobile 390 × 844, and narrow mobile 320 × 740. No horizontal viewport overflow.
- Header and hero signup links point to `/auth/signup`; secondary action points to `/demo`. Features navigation reached `/features` and the correct page heading. No signup or external submission was performed.
- Mobile menu exposes the existing destinations and closes with Escape. FAQ expands its PDF-delivery answer. Sticky signup control appears on scroll and its dismiss control hides it.
- Hero CTAs remain visible before the artwork on mobile. Browser page console checked: zero errors in the final reviewed page state.
- Local preview stays running on port 3150 and open for review. No deployment performed.

## Deferred print PDF work

- All 23 print-PDF implementation, branding, schema, migration, documentation, and test changes are held outside the homepage commit in a named local Git stash. No actual PDF or database change is included.
- The original combined QA report and synthetic sample files remain in ignored `.qa-artifacts/diffui/` for later review. They describe the held implementation, not the homepage-only commit.
- No migration is required for this homepage redesign.

## Validation limits and remaining release work

- After separating the held PDF work, scoped ESLint, `tsc --noEmit`, Node 20.18.0 production build, `git diff --check`, and `npm run security:scan` passed again. Browser recheck at 390 and 1440 CSS widths confirmed the headline, loaded hero asset, signup destination, no overflow, mobile menu/Escape, and zero page console errors. No PDF, branding, schema, migration, or PDF-test changes remain in the homepage diff.
- Scoped ESLint, TypeScript, production build, and tracked-artifact security scan passed. Production build used Node 20.18.0; Vitest used Node 22.22.2 because the installed Vitest/Vite combination fails to bootstrap on the locally available early Node 20.18.0 runtime. No toolchain files changed.
- Full Vitest run: 253 passing files, one failing file, one skipped file; 2233 passing tests, one failing test, 13 skipped tests. The failure is the untouched admin operations empty-state assertion at `tests/unit/admin-operations-ui.test.tsx:320`, reproduced in isolation. No clean-checkout baseline run was made, so this is documented as an out-of-scope failure rather than a proven baseline result.
- CLI Playwright suite was not run; interactive browser verification above was completed. The PDF experiment's previous focused results are historical evidence for the held work, not acceptance evidence for this homepage-only commit.
- User authorized committing and pushing the homepage redesign. No hosted migration, production-data mutation, or messages are part of this change.

## Implementation checklist

- [x] Selected desktop design implemented and compared after fixes.
- [x] Mobile/tablet layouts and primary marketing controls reviewed.
- [x] Actual PDF changes separated and preserved for later; existing layout remains active.
- [x] Prior visual checks and broader-suite limitation disclosed.
- [x] Homepage-only source and browser checks repeated after removing the PDF experiment; commit/push outcome belongs to the task handoff.

Follow-up polish: none required for the reviewed scope. Further visual iteration can follow user review.

final result: passed
