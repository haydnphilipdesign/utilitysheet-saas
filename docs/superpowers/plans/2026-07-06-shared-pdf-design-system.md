# Shared PDF Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Simple and Advanced exports through one compact, accent-led PDF design system with canonical Advanced labels/order and resilient pagination.

**Architecture:** Replace the duplicate Simple/Advanced HTML builders with one shared builder that conditionally inserts Advanced detail sections. Normalize Advanced fields from module metadata before rendering, and represent all flowing sections as paged tables with repeating heading groups and atomic body rows.

**Tech Stack:** TypeScript, Vitest, HTML/CSS paged media, Puppeteer/Chromium, Python `pypdf`, Poppler.

---

### Task 1: Canonicalize the shared title and Advanced field data

**Files:**
- Modify: `lib/branding/deliverable.ts`
- Modify: `lib/packet/packet-data.ts:256-280`
- Modify: `tests/unit/packet-data.test.ts`
- Modify: `tests/unit/packet-html.test.ts`

- [ ] **Step 1: Write failing title and normalization tests**

In `tests/unit/packet-html.test.ts`, add a test that builds both modes and asserts both HTML documents contain `<title>Utility Info Sheet</title>`.

In `tests/unit/packet-data.test.ts`, add an Advanced request whose `smart_home_security` values are deliberately stored out of order:

```ts
advanced_packet_data: {
    smart_home_security: {
        smart_home_notes: 'Transfer after closing',
        smart_doorbell_brand: 'Blink',
        security_system_brand: 'Blink',
        smart_thermostat_brand: 'N/A',
    },
    irrigation_seasonal_controls: {
        has_irrigation_system: 'no',
    },
},
```

Assert the normalized Smart section keys are exactly:

```ts
expect(smartSection?.fields.map((field) => field.key)).toEqual([
    'security_system_brand',
    'smart_thermostat_brand',
    'smart_doorbell_brand',
    'smart_home_notes',
]);
expect(smartSection?.fields.map((field) => field.label)).toEqual([
    'Security System Brand',
    'Smart Thermostat Brand',
    'Smart Doorbell Brand',
    'Smart Home Notes',
]);
expect(irrigationSection?.fields).toContainEqual(expect.objectContaining({
    key: 'has_irrigation_system',
    value: 'No',
}));
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npm test -- tests/unit/packet-data.test.ts tests/unit/packet-html.test.ts
```

Expected: title test reports `Utility Information Sheet`; field order follows object insertion order; `no` remains lowercase.

- [ ] **Step 3: Implement canonical field normalization**

Import `ADVANCED_MODULE_FIELD_METADATA` into `lib/packet/packet-data.ts`. Replace `Object.entries(sectionData)` iteration with metadata iteration:

```ts
function formatAdvancedFieldValue(raw: unknown): string {
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw).trim();
    if (value.toLowerCase() === 'yes') return 'Yes';
    if (value.toLowerCase() === 'no') return 'No';
    return value;
}

const fields = ADVANCED_MODULE_FIELD_METADATA[moduleKey].flatMap((field) => {
    const raw = sectionData[field.key];
    if (raw === null || raw === undefined) return [];
    const value = formatAdvancedFieldValue(raw);
    if (!value) return [];
    return [{ key: field.key, label: field.label, value }];
});
```

Change `getPacketTitle()` in `lib/branding/deliverable.ts` to return `Utility Info Sheet` for both modes while retaining its existing parameter for API compatibility.

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```powershell
npm test -- tests/unit/packet-data.test.ts tests/unit/packet-html.test.ts
```

Expected: both files pass.

### Task 2: Replace duplicate renderers with one shared document shell

**Files:**
- Modify: `lib/pdf/packet-html.ts:184-819`
- Modify: `tests/unit/packet-html.test.ts`

- [ ] **Step 1: Write failing shared-shell tests**

Add an Advanced fixture with Home Basics and `brand.name = 'Multimedium Team'`, `contact_name = 'Haydn Watkins'`. Assert:

```ts
expect(result.html).toContain('class="packet-pdf"');
expect(result.html).toContain('class="brand-mark">MT</div>');
expect(result.html).toContain('Haydn Watkins');
expect(result.html).toContain('Home Basics');
expect(result.html).toContain('class="section-heading accent-heading"');
expect(result.html).toContain('Utility Providers');
expect(result.html).toContain('Buyer Next Steps');
expect(result.html).not.toContain('font-family: "Georgia"');
```

Build an equivalent Simple fixture and assert it uses the same `packet-pdf`, `brand-header`, `title-block`, `accent-heading`, `provider-table`, and `buyer-steps-section` classes.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/packet-html.test.ts`

Expected: Advanced lacks the shared classes, renders `MU`, omits contact name and Home Basics, and still includes Georgia CSS.

- [ ] **Step 3: Create shared private rendering helpers**

Inside `lib/pdf/packet-html.ts`, add private helpers with these responsibilities:

```ts
function getBrandInitials(name?: string | null): string {
    const initials = String(name || '')
        .trim()
        .split(/\s+/)
        .map((word) => word[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
    return initials || 'US';
}

function chunkFields<T>(fields: T[]): Array<[T, T?]> {
    const rows: Array<[T, T?]> = [];
    for (let index = 0; index < fields.length; index += 2) {
        rows.push([fields[index], fields[index + 1]]);
    }
    return rows;
}
```

Keep escaping, URL normalization, and trash-schedule helpers unchanged. Extract shared markup generation for brand header, title block, Home Basics, Utilities, Advanced sections, and Buyer Next Steps so each content block is defined once.

- [ ] **Step 4: Build one mode-aware document**

Replace `buildSimplePacketPdfHtml` and `buildAdvancedPacketPdfHtml` with one `buildPacketPdfDocumentHtml(data)` implementation. Its content order is:

```text
brand header
title/address/date
welcome message (when present)
Home Basics (when present)
Utilities
Advanced detail sections (Advanced only)
Buyer Next Steps
disclaimer (when present)
```

Use the Simple renderer's compact Arial/Open Sans-compatible sans-serif sizing as the baseline. Add the brand-colored left accent border to every section heading in both modes. Preserve `print_pdf`, shared running header/footer templates, powered-by rules, and mode-specific filenames.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/unit/packet-html.test.ts`

Expected: all packet HTML tests pass.

### Task 3: Make Utilities and Advanced sections page-aware

**Files:**
- Modify: `lib/pdf/packet-html.ts`
- Modify: `tests/unit/packet-html.test.ts`

- [ ] **Step 1: Write failing pagination-structure tests**

Build an Advanced packet with five fields and assert:

```ts
expect(result.html).toMatch(/<table class="detail-section-table">[\s\S]*<thead>[\s\S]*Mailbox &amp; Home Access/);
expect(result.html).toContain('thead { display: table-header-group; }');
expect(result.html).toContain('.detail-row { break-inside: avoid;');
expect(result.html).toContain('.provider-row { break-inside: avoid;');
expect(result.html).toContain('.buyer-step { break-inside: avoid;');
expect(result.html).not.toContain('packet-section keep-together');
```

Assert odd field counts produce a final row with one real cell and one `.detail-cell-empty` cell.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/packet-html.test.ts`

Expected: Advanced sections are still whole-card `<section>` elements rather than repeating-header tables.

- [ ] **Step 3: Implement paged Advanced section tables**

Render each Advanced section as:

```html
<table class="detail-section-table">
  <thead>
    <tr class="detail-section-title">
      <th colspan="2"><h3>Section title</h3></th>
    </tr>
  </thead>
  <tbody>
    <tr class="detail-row">
      <td class="detail-cell">...</td>
      <td class="detail-cell">...</td>
    </tr>
  </tbody>
</table>
```

Use `thead { display: table-header-group; }`; atomic `.detail-row`, `.provider-row`, and `.buyer-step` rules; cell-owned borders; and final-row corner radii. Do not put `break-inside: avoid` on entire Utilities, detail tables, or Buyer Next Steps.

- [ ] **Step 4: Run all related unit tests**

Run:

```powershell
npm test -- tests/unit/packet-html.test.ts tests/unit/packet-data.test.ts tests/unit/packet-pdf-route.test.ts tests/unit/packet-route-branding.test.ts tests/unit/utilitysheet-pdf-preview.test.tsx
```

Expected: all selected files pass.

- [ ] **Step 5: Commit the implementation**

Run:

```powershell
git add lib/branding/deliverable.ts lib/packet/packet-data.ts lib/pdf/packet-html.ts tests/unit/packet-data.test.ts tests/unit/packet-html.test.ts
git commit -m "Unify simple and advanced PDF design"
```

### Task 4: Render and inspect real and oversized fixtures

**Files:**
- Create temporarily: `tests/render-shared-pdf-review.test.ts`
- Produce temporarily: `tmp/pdfs/shared-review/simple-morris.pdf`
- Produce temporarily: `tmp/pdfs/shared-review/advanced-morris.pdf`
- Produce temporarily: `tmp/pdfs/shared-review/advanced-overflow.pdf`

- [ ] **Step 1: Create a temporary Chromium fixture test**

Import `buildPacketPdfHtml`, launch local Chrome with Puppeteer, and render three fixtures using the production `page.pdf()` letter size, margins, header template, and footer template:

- Simple Morris Place: five utilities, Home Basics, four default steps.
- Advanced Morris Place: the values extracted from the supplied Advanced PDF, including all enabled Advanced sections.
- Advanced overflow: 30 utilities plus enough fields or long values to span an Advanced section across pages.

- [ ] **Step 2: Generate PDFs and verify page counts/text**

Run the temporary Vitest file, then use bundled Python `pypdf` to assert:

```text
Simple Morris: exactly 1 page
Advanced Morris: at least 2 pages
Advanced overflow: more pages than Advanced Morris
All documents: selectable Utility Info Sheet text
Advanced: Home Basics present, MT present, canonical labels present, raw awkward labels absent
Continuation pages: Utility Providers or Advanced section heading repeats where its table spans pages
```

- [ ] **Step 3: Render every page to PNG**

Use bundled Poppler `pdftoppm.exe -png -r 144` into separate fixture directories.

- [ ] **Step 4: Inspect every PNG**

Confirm both modes share header, centered title, typography, card styling, accent bars, Home Basics, Utilities, Buyer Next Steps, and page chrome. Confirm no clipped text, overlap, black squares, broken borders, orphaned headings, split rows, or accidental blank pages.

- [ ] **Step 5: Remove temporary fixture code and artifacts**

Delete `tests/render-shared-pdf-review.test.ts` and `tmp/pdfs/shared-review` after inspection.

### Task 5: Final verification and integration

**Files:**
- Verify all modified production and test files.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint -- lib/branding/deliverable.ts lib/packet/packet-data.ts lib/pdf/packet-html.ts tests/unit/packet-data.test.ts tests/unit/packet-html.test.ts
```

Expected: exit 0.

- [ ] **Step 2: Run the full unit suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: compilation, TypeScript, page-data collection, and static generation all complete successfully.

- [ ] **Step 4: Audit the final diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, no temporary files, and only approved implementation/test files plus committed design/plan documentation.
