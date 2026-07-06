# Simple PDF Pagination Design

## Goal

Make ordinary Simple utility sheets render as polished, selectable-text, one-page PDFs while ensuring longer sheets paginate at intentional content boundaries.

## Success Criteria

- The supplied 112 Morris Place content (five utility providers, Home Basics, and four Buyer Next Steps) fits on one US Letter page at a comfortable print size.
- Provider rows and Buyer Next Step items never split across pages.
- When the provider table spans pages, each continuation page repeats both the `Utility Providers` section heading and the table column headings.
- No section heading is orphaned at the bottom of a page.
- Page borders, backgrounds, headers, footers, and page numbers remain visually complete on every page.
- PDF text remains selectable; the Simple renderer continues using Chromium's vector `print_pdf` path.

## Layout Strategy

Use print-native sizing and a tighter vertical rhythm in the Simple HTML template. Reduce oversized screenshot-era padding, heading sizes, row spacing, and decorative gaps without applying whole-document scaling or dropping below a comfortable body-text size.

Structure Utility Providers as one paged table. Put the section title and column headings inside its repeating table header group so overflow pages begin with enough context. Apply break avoidance to individual provider rows, not to the full table.

Keep the Buyer Next Steps section together when it fits in the remaining page area. If it cannot fit, move the section to the next page; for unusually long customized steps, allow breaks only between list items.

## Overflow Behavior

Normal sheets should fit one page through compact print styling. Content volume, not a hard provider-count threshold, determines overflow. Longer sheets flow naturally onto additional pages, with repeated provider context and atomic rows/items. The renderer must never shrink the entire document dynamically to force one-page output.

## Implementation Scope

- Update the Simple-mode markup and print CSS in `lib/pdf/packet-html.ts`.
- Preserve Advanced-mode rendering and content.
- Add structural regression assertions for repeating headers and break rules.
- Add a browser-backed PDF fixture for the Morris Place-sized one-page case and an oversized multi-page continuation case if the existing test harness can run Chromium reliably.
- Render resulting PDFs to PNG and inspect every page for clipping, overlap, broken borders, orphaned headings, and legibility.

## Verification

Run the focused PDF/template tests, the broader unit suite relevant to packet generation, TypeScript/lint checks for changed files, and a production build if feasible. Generate fresh PDF artifacts for both fixtures, confirm their page counts, extract text to verify selectability and repeated headings, and inspect page PNGs visually.

## Non-Goals

- Returning Simple PDFs to screenshot/raster rendering.
- Redesigning the Advanced PDF.
- Changing packet data, branding limits, or displayed utility content.
- Forcing every possible customized sheet onto one page.
