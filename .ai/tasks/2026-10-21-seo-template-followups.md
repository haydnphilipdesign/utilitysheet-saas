---
status: done
owner: claude
updated: 2026-10-21 10:15
scope: app/(marketing)/utility-sheet-for-real-estate-agents/page.tsx (one sentence), app/(marketing)/utility-sheet-template, app/templates, lib/templates, app/sitemap.ts, docs/seo-playbook.md, tests/unit/utility-sheet-template.test.ts
---
# SEO template follow-ups (fillable PDF, sample sheet, buyer guide link)

## Goal

Build the three optional follow-ups handed over by
[the SEO content plan](2026-10-20-seo-content-plan.md): (1) a fillable PDF of
the free template, (2) a clearly labeled sample filled-in sheet with obviously
fictional data, (3) a link to the buyer guide from the agents page. Order:
3, 2, 1. Branch: `claude/seo-template-followups`.

Owner decisions (2026-10-21):
- Sample: the template itself filled in (jsPDF), as a SAMPLE-marked PDF and
  as real HTML text on the template page. Not a render of the production
  packet builder; nothing under lib/pdf, lib/packet, or lib/branding touched.
- Fillable PDF replaces the current download at the same URL.

## Progress

- 3: one sentence under "Where agents use it" on the agents page, using the
  `MarketingPointsSection` children slot the checklist page already uses.
  Sitemap date bumped. No shared components touched.
- 2: `lib/templates/sample-utility-sheet.ts` holds the fictional data
  (123 Sample Street, Anytown; 555-01xx numbers; .example / example.com).
  `buildUtilitySheetSamplePdf()` draws it on the template layout with a SAMPLE
  badge, a "fictional details" line, and a 7% diagonal watermark. Served at
  `/templates/utility-info-sheet-sample.pdf` by the existing `[file]` route.
  Template page has a new "A filled-in example" section (`#sample`) after
  "What's on the template"; later sections' alt backgrounds flipped to keep
  alternation.
- 1: `buildUtilitySheetTemplatePdf()` now adds AcroForm fields (38 text,
  16 checkboxes) through jsPDF 4.0.0's own AcroForm API, no new dependency.
  jsPDF gaps worked around in `lib/templates/utility-sheet-template.ts`:
  text fields get /DA (9pt on lines, auto-size in table cells), the form gets
  /DR (page resources, object 2, which jsPDF hardcodes for its own field
  appearances; a test pins it) and /DA; checkboxes get drawn-check
  appearances with V/AS Off (stock ones paint a white box over the printed
  border and use a 50pt glyph). Every field has a /TU tooltip.
  Page copy: hero lead and meta line, comparison row, a new FAQ, meta
  description. Title kept (68 chars with "Fillable" added).

Viewer testing of the fillable PDF (typing, Tab order, checkbox toggling):
- Chrome 155 built-in viewer (PDFium): pass. Note that the first click after
  the PDF loads only focuses the viewer (same for any PDF).
- Edge 155 built-in viewer ("Powered by Adobe Acrobat"): pass, long text
  shrinks to fit.
- Firefox 156 (pdf.js), driven by puppeteer-core over WebDriver BiDi: pass;
  all 54 fields exposed in order with tooltips.
- Not tested: Acrobat Reader desktop, macOS Preview, iOS/Android viewers.

## Environment

Static file server for scratch PDFs on 127.0.0.1:3131 (scratchpad only).
The final `next build` ran with the checkout's own .env/.env.local loaded
(the placeholder-env script was never written); it is a static build and no
hosted writes were made.

## Validation

- `node node_modules/vitest/vitest.mjs run tests/unit/utility-sheet-template.test.ts`: 9 pass.
- `tsc --noEmit`: pass. ESLint on changed files: pass.
- `next build`: pass; `/templates/utility-info-sheet.pdf`,
  `/templates/utility-info-sheet-sample.pdf`, and `/utility-sheet-template`
  prerendered static.
- `node scripts/security/scan-artifacts.mjs`: pass. `git diff --check`: pass.
- Not run (owner asked to merge and push first): full Vitest suite,
  Lighthouse on the template page, desktop/mobile screenshots of the
  template and agents pages.

## Next

Done. Merged into `main` and pushed on 2026-10-21 at the owner's request.
Follow-ups: screenshot the template page (sample section) at 1440px and
iPhone 13 after deploy, run Lighthouse on it, run the full Vitest suite, and
if possible open the fillable PDF in Acrobat Reader and macOS Preview.
Request indexing for `/utility-sheet-template` again (playbook row 11).
