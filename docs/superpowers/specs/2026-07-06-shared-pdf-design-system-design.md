# Shared PDF Design System

## Goal

Make Simple and Advanced exports feel like one product family while preserving Simple's one-page-first efficiency and Advanced's richer multi-page content.

## Shared Document Shell

Both modes will render through one HTML/CSS document builder instead of separate Simple and Advanced presentation implementations. They will share:

- the title `Utility Info Sheet`;
- branded header structure and correct word-based initials (`Multimedium Team` becomes `MT`);
- contact name, phone, email, and website when supplied;
- centered title and address treatment;
- typography, colors, spacing, borders, shadows, radii, and restrained accent bars;
- Home Basics when water source, sewer type, or heating type is available;
- the Utilities table;
- Buyer Next Steps;
- running brand/address headers and powered-by/page-number footers.

Advanced mode will insert its Advanced detail sections between Utilities and Buyer Next Steps. The Advanced filename may remain `seller-transition-packet-<address>.pdf`; filename parity is not required for visual consistency.

## Visual Direction

Use the selected shared hybrid system: Simple's compact sans-serif clarity combined with Advanced's section-heading accent bars. Accent bars will appear consistently on card headings in both modes. Advanced detail cards use the same shell but retain a two-column field grid so richer content remains easy to scan.

Simple must remain comfortably readable and fit the supplied 112 Morris Place content on one US Letter page. Advanced may use multiple pages; page count is determined by content rather than scaling.

## Content Normalization

Advanced field output will follow `ADVANCED_MODULE_FIELD_METADATA` rather than object insertion order. This provides canonical field order and human-authored labels such as `Plumber` instead of database-derived labels such as `Plumber Provider Name`.

Boolean-like values `yes` and `no` will render as `Yes` and `No`. Other values, including `N/A`, phone numbers, notes, and user-entered capitalization, will be preserved.

Advanced includes all shared Simple content. In particular, Home Basics must not disappear merely because the packet mode is Advanced.

## Pagination

The shared Utilities table will repeat both the section heading and column headings on continuation pages. Utility rows remain atomic.

Each Advanced detail section will render as a two-column paged table. Its section heading repeats if that section spans pages, and each pair of field cells remains atomic. A section may move to the next page when it fits there in full, but oversized sections must be allowed to continue rather than forcing or clipping a whole-card block.

Buyer Next Step items remain atomic and may paginate only between items. Compact sections such as the brand header, title block, welcome message, and Home Basics remain together.

No whole-document scaling will be used to force content onto fewer pages.

## Code Structure

- `lib/pdf/packet-html.ts` will own one shared packet builder with mode-conditional Advanced sections.
- Small private helpers will build brand initials, shared header/title markup, Home Basics, Utilities, Advanced section tables, and Buyer Next Steps.
- `lib/packet/packet-data.ts` will normalize Advanced fields in canonical metadata order with canonical labels and display values.
- `lib/branding/deliverable.ts` will return the shared document title for both modes.
- Existing public interfaces and the Chromium `print_pdf` rendering path remain unchanged.

## Verification

Use test-first implementation. Regression tests will cover:

- the shared title in both modes;
- word-based initials;
- Home Basics in Advanced mode;
- canonical Advanced labels and order;
- `Yes/No` formatting;
- repeating Utilities and Advanced section headers;
- atomic utility rows, field rows, and Buyer Next Step items;
- unchanged vector `print_pdf` strategy and running page chrome.

Generate and inspect fresh browser-rendered fixtures for:

1. the supplied Simple 112 Morris Place content, which must remain one page;
2. the supplied Advanced 112 Morris Place content, which should remain a polished intentional multi-page document;
3. oversized Utilities and Advanced sections, which must continue cleanly without clipping, overlap, orphaned headings, or broken borders.

Extract PDF text to confirm selectability, repeated continuation headings, canonical labels, and page counts. Render every page to PNG and visually check typography, alignment, margins, borders, headers, footers, and page balance. Run relevant tests, the full unit suite, lint, and a production build.

## Non-Goals

- Changing packet eligibility, pricing, module selection, or seller data collection.
- Returning either PDF to screenshot/raster rendering.
- Forcing Advanced packets onto one page.
- Redesigning the web packet or in-app preview beyond changes required to keep the canonical title consistent.
- Adding new dependencies.
