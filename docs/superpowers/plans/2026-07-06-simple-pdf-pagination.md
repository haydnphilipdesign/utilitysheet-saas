# Simple PDF Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make typical Simple utility sheets fit one letter page while giving longer provider lists polished, contextual page continuations.

**Architecture:** Keep the current Chromium `print_pdf` pipeline and change only the Simple HTML template. Convert the provider card into a print-native table whose section title and columns share a repeating `thead`, then use compact point-based typography and break rules on atomic rows and list items.

**Tech Stack:** TypeScript, Vitest, Puppeteer/Chromium, HTML/CSS paged media, Python `pypdf`, Poppler.

---

### Task 1: Lock the Simple print structure with regression tests

**Files:**
- Modify: `tests/unit/packet-html.test.ts`
- Test: `tests/unit/packet-html.test.ts`

- [ ] **Step 1: Write the failing structural tests**

Add tests that build a Simple packet with five provider rows and assert the generated HTML contains a dedicated compact-print root class, places the provider section title inside `thead`, repeats that group with `display: table-header-group`, keeps individual provider rows together, and does not keep the entire provider table together:

```ts
it('uses a repeating provider heading group without keeping the full table together', () => {
    const result = buildPacketPdfHtml({
        mode: 'simple',
        request: {
            id: 'req_simple_pagination',
            property_address: '112 Morris Place, Bushkill, PA 18324',
            created_at: '2026-07-06T12:00:00.000Z',
            water_source: 'city',
            sewer_type: 'septic',
            heating_type: 'electric',
        },
        brand: { name: 'Multimedium Team' },
        utilities: Array.from({ length: 5 }, (_, index) => ({
            category: ['electric', 'internet', 'propane', 'trash', 'water'][index],
            provider_name: `Provider ${index + 1}`,
        })),
    });

    expect(result.html).toContain('class="simple-pdf"');
    expect(result.html).toMatch(/<thead>[\s\S]*provider-section-title[\s\S]*Utility Providers[\s\S]*provider-columns/);
    expect(result.html).toContain('thead { display: table-header-group; }');
    expect(result.html).toContain('.provider-row { break-inside: avoid;');
    expect(result.html).not.toContain('provider-table keep-together');
});

it('keeps buyer steps atomic while allowing unusually long lists to paginate', () => {
    const result = buildPacketPdfHtml({
        mode: 'simple',
        request: {
            id: 'req_simple_steps',
            property_address: '112 Morris Place, Bushkill, PA 18324',
            created_at: '2026-07-06T12:00:00.000Z',
        },
        brand: null,
        utilities: [],
    });

    expect(result.html).toContain('.buyer-step { break-inside: avoid;');
    expect(result.html).toContain('class="buyer-steps-section"');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/packet-html.test.ts`

Expected: FAIL because `simple-pdf`, `provider-section-title`, `provider-columns`, `provider-row`, `buyer-step`, and `buyer-steps-section` are absent from the current HTML.

- [ ] **Step 3: Commit the regression tests after implementation turns them green**

Run:

```powershell
git add tests/unit/packet-html.test.ts lib/pdf/packet-html.ts
git commit -m "Fix simple PDF pagination"
```

### Task 2: Implement compact, page-aware Simple markup

**Files:**
- Modify: `lib/pdf/packet-html.ts:215-429`
- Test: `tests/unit/packet-html.test.ts`

- [ ] **Step 1: Replace screenshot-era inline sizing with scoped print CSS**

Add `class="simple-pdf"` to the Simple root and define all Simple layout measurements in its `<style>` block. Use 10pt body text, 0.55in print margins supplied by the renderer, 16-18pt title hierarchy, 8-12px card padding, and 10-12px section gaps. Keep `.keep-together` only for compact atomic sections.

- [ ] **Step 2: Make provider context repeat on continuation pages**

Move the `Utility Providers` title into the provider table header:

```html
<table class="provider-table">
  <thead>
    <tr class="provider-section-title">
      <th colspan="3"><h3>Utility Providers</h3></th>
    </tr>
    <tr class="provider-columns">
      <th>Utility</th>
      <th>Provider</th>
      <th>Contact</th>
    </tr>
  </thead>
  <tbody>${utilityRowsHtml}</tbody>
</table>
```

Use `thead { display: table-header-group; }`, `.provider-row { break-inside: avoid; page-break-inside: avoid; }`, and borders on table cells rather than a clipping wrapper so a page boundary cannot cut a rounded container edge.

- [ ] **Step 3: Make Buyer Next Steps paginate between items only**

Add `buyer-steps-section` and `buyer-step` classes. Use `break-inside: avoid` on each item, `break-after: avoid` on the section heading, and a compact list rhythm. Do not apply an unconditional keep-together rule to the entire list because customized copy can exceed one page.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/unit/packet-html.test.ts`

Expected: all tests in `packet-html.test.ts` PASS.

- [ ] **Step 5: Run related PDF tests**

Run:

```powershell
npm test -- tests/unit/packet-html.test.ts tests/unit/packet-pdf-route.test.ts tests/unit/packet-route-branding.test.ts tests/unit/utilitysheet-pdf-preview.test.tsx
```

Expected: all selected test files PASS with zero failures.

### Task 3: Verify real one-page and multi-page rendering

**Files:**
- Create temporarily: `tmp/pdfs/render-simple-pagination.test.ts`
- Produce temporarily: `tmp/pdfs/simple-morris.pdf`
- Produce temporarily: `tmp/pdfs/simple-overflow.pdf`
- Produce temporarily: `tmp/pdfs/simple-morris/page-1.png`
- Produce temporarily: `tmp/pdfs/simple-overflow/page-*.png`

- [ ] **Step 1: Create a temporary Vitest renderer**

Create a temporary test that imports `buildPacketPdfHtml`, launches `C:\Program Files\Google\Chrome\Application\chrome.exe` with Puppeteer, calls `page.pdf()` with the production letter format/header/footer/margins, and writes two buffers: the Morris Place five-provider fixture and an oversized twelve-provider fixture.

- [ ] **Step 2: Generate both PDFs**

Run: `$env:RUN_PDF_RENDER_TESTS='1'; npm test -- tmp/pdfs/render-simple-pagination.test.ts`

Expected: PASS and both PDF files exist.

- [ ] **Step 3: Confirm page counts and selectable text**

Run with the bundled Python executable:

```powershell
$py='C:\Users\haydn\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py -c "from pypdf import PdfReader; a=PdfReader(r'tmp/pdfs/simple-morris.pdf'); b=PdfReader(r'tmp/pdfs/simple-overflow.pdf'); assert len(a.pages)==1; assert len(b.pages)>1; assert 'Utility Providers' in (a.pages[0].extract_text() or ''); assert all('Utility Providers' in (p.extract_text() or '') for p in b.pages); print(len(a.pages), len(b.pages))"
```

Expected: prints `1` followed by a multi-page count and exits 0.

- [ ] **Step 4: Render every PDF page to PNG**

Run the bundled Poppler `pdftoppm.exe` at 144 DPI for each PDF into its own temporary directory.

Expected: one PNG for Morris Place and one PNG per overflow page.

- [ ] **Step 5: Inspect every PNG**

Confirm readable type, complete table borders, repeated provider section/column headings, no clipped rows, no orphaned headings, and balanced page composition.

- [ ] **Step 6: Run final static verification**

Run:

```powershell
npm run lint -- lib/pdf/packet-html.ts tests/unit/packet-html.test.ts
npm test -- tests/unit/packet-html.test.ts tests/unit/packet-pdf-route.test.ts tests/unit/packet-route-branding.test.ts tests/unit/utilitysheet-pdf-preview.test.tsx
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 7: Remove temporary rendering sources and artifacts**

Delete `tmp/pdfs/render-simple-pagination.test.ts`, generated PDFs, and rendered PNG directories after visual verification. Preserve only production code, regression tests, the approved design, and this plan.
