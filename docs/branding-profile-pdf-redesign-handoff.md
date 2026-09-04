# Branding Profile and PDF Redesign Handoff

Last verified: July 6, 2026, on `main` at merge commit `9ff0ca4`.

> **Status update (July 7, 2026): the redesign described below has been implemented.**
> The editor now uses a tabbed information architecture (Brand / PDF Content / Messages) with an
> ownership-scope badge and a header-level default-profile control. The live preview renders the
> production HTML from `lib/pdf/packet-html.ts` in a sandboxed iframe, and "Download test PDF" goes
> through `POST /api/branding/test-pdf` using the production Chromium pipeline; both share
> `lib/branding/preview-data.ts`. The COALESCE update-semantics bugs in the "clear/reset" section
> were fixed with explicit "absent = unchanged, null = clear" semantics in
> `lib/validation/schemas.ts` and `lib/neon/queries/brand-profiles.ts`. Secondary Color stayed
> email-only and now lives in the Messages tab labeled "Email accent color". Message templates
> stayed profile-scoped, in the Messages tab. The screenshot helper
> `lib/pdf/client-screenshot-pdf.ts` was deleted. Sections below describe the pre-redesign state
> for historical context; see [pdf-system-reference.md](./pdf-system-reference.md) for current
> architecture.

Audience: the next designer/engineer refining Branding Profiles and their relationship to the Simple PDF and Property Handoff Packet.

Read [pdf-system-reference.md](./pdf-system-reference.md) for the complete production PDF architecture. This document focuses on the Branding Profile model, its downstream effects, current preview gaps, and safe redesign boundaries.

## Product relationship

A Branding Profile is more than a PDF theme. It currently controls or contributes to:

- Simple and Advanced PDFs;
- the live Branding Profile PDF preview;
- the Branding Profile “Generate Test PDF” action;
- seller-facing intake/wizard branding;
- the web packet;
- seller request and reminder emails;
- manual SMS/mailto and automatic email message templates;
- which profile is selected by default for new requests.

Changes to the Branding Profile schema or editor must therefore be evaluated across more than the downloadable PDFs.

The production PDF relationship is intentionally simple: both PDF modes consume the same profile. There is no separate “Simple branding” and “Advanced branding” configuration.

## Field impact matrix

| Branding Profile field | Simple PDF | Advanced PDF | Other known consumers | Notes |
| --- | --- | --- | --- | --- |
| `name` | Header and running header | Header and running header | Seller form, email branding | Required; max 60. Also supplies fallback initials. |
| `logo_url` | Header logo | Header logo | Seller form, email branding, preview | PDF accepts safe HTTP(S) only. If absent/invalid/unavailable, initials are used or the image fails without blocking generation. |
| `primary_color` | Main accent | Main accent | Seller wizard, preview, email branding | Must be 3- or 6-digit hex. Falls back to `#10b981`. |
| `secondary_color` | Not used | Not used | Branded emails | Exposing it beside Primary Color can imply PDF behavior that does not exist. |
| `contact_name` | Brand header | Brand header | Seller form and emails | Max 60. |
| `contact_phone` | Brand header | Brand header | Seller form and emails | Max 30. |
| `contact_email` | Right side of brand header | Right side of brand header | Seller form and emails | Max 100. |
| `contact_website` | Right side of brand header | Right side of brand header | Preview | Max 100. PDF displays the hostname only; schemes and paths are removed. Schemeless domains are supported. |
| `disclaimer_text` | Body after Buyer Next Steps | Body after Buyer Next Steps | Preview | Max 240. It is not a repeating page footer despite the current “Footer Disclaimer” label. |
| `buyer_next_steps` | Buyer Next Steps | Buyer Next Steps | Preview | Paid customization. Up to 8 steps, 100 characters each. Null/empty uses product defaults. |
| `next_steps_title` | Section title | Section title | Preview | Paid customization; max 40; blank uses `Buyer Next Steps`. |
| `show_powered_by` | Running footer | Running footer | Preview | Paid preference. Free accounts are forced to show it. |
| `show_generation_date` | Title block | Title block | Preview | Paid preference. Free accounts are forced to show it. The displayed value currently uses request creation time. |
| `welcome_message` | Before Home Basics | Before Home Basics | Preview | Paid customization; max 320. |
| `message_templates` | No direct effect | No direct effect | Seller request/reminder SMS and emails | Keep conceptually separate from visual PDF controls even if they remain in one editor. |
| `is_default` | Indirect selection | Indirect selection | New request creation | Paid control. It selects a profile; it does not change visual rendering by itself. |

## Defaults and limits

The editor initializes new profiles with:

- primary color `#10b981`;
- secondary color `#059669`;
- powered-by visible;
- generation date visible;
- default Buyer Next Steps;
- no welcome message or disclaimer;
- no custom message templates.

The canonical PDF-related limits are in `lib/branding/limits.ts`:

| Value | Limit |
| --- | ---: |
| Brand name | 60 characters |
| Contact name | 60 |
| Contact phone | 30 |
| Contact email | 100 |
| Contact website | 100 |
| Disclaimer | 240 |
| Welcome message | 320 |
| Buyer Next Steps title | 40 |
| Buyer Next Steps | 8 items |
| Each buyer step | 100 characters |

The API validates the profile payload with `brandProfileCreateBodySchema` and `brandProfileUpdateBodySchema` in `lib/validation/schemas.ts`. Unknown keys are stripped. Colors must be valid hex strings.

## Profile ownership, defaulting, and request behavior

Profiles can be account-scoped or organization-scoped.

- When an organization is active, profile listing and creation use that organization.
- Otherwise, profiles are personal/account-scoped.
- Marking a profile default clears the other default in the same scope.
- If no default is marked, the oldest profile in the relevant scope is used as fallback.
- If a workspace has no profiles, `GET /api/branding` auto-creates one from organization/account identity data.

New requests generally store a `brand_profile_id`. PDF generation reads the referenced profile at generation time. This means a Branding Profile edit can change a regenerated PDF for an existing request; profile values are not snapshotted into the request.

If the referenced profile is deleted, the database sets the request's foreign key to null. PDF generation then falls back to the current default profile.

## Paid and Free behavior

Creating and deleting custom profiles requires Pro or Team access. The editor still supports an automatically created/default profile for account activation and legacy behavior.

The production packet data layer, not the PDF CSS, enforces these output rules:

| Feature | Free | Pro / Team |
| --- | --- | --- |
| Property Handoff Packet mode | Unavailable | Available |
| Custom Buyer Next Steps | Product defaults | Profile value honored |
| Custom next-steps title | Default title | Profile value honored |
| Welcome message | Hidden | Profile value honored |
| Powered-by footer | Forced on | Profile toggle honored |
| Generation date | Forced on | Profile toggle honored |
| Default-profile control | Disabled | Available |

Do not implement plan gating only in the preview. The server data layer must remain authoritative.

## Current Branding Profile editor

`components/branding/BrandProfileForm.tsx` currently presents a long two-column desktop layout:

- Left: stacked editing cards
- Right: sticky live PDF preview and Generate Test PDF button

The left-side cards are:

1. Brand Identity
2. Contact Information
3. Additional Options
4. Request Message Templates
5. Display Options
6. Buyer Next Steps

The live preview is hidden below the large breakpoint. Paid-only controls are disabled for Free users and visually marked where applicable.

Logo upload currently permits JPEG, PNG, WebP, and SVG up to 2 MB. The UI recommends at least 200×200 pixels and says square or horizontal logos work best. Production PDF logo rendering fixes the height and leaves width automatic, so extremely wide marks deserve explicit testing.

### Existing clear/reset semantics need attention

The current update query uses SQL `COALESCE(new_value, existing_value)` for optional profile fields. At the same time, the editor represents some “clear” actions as `undefined`, and `JSON.stringify()` omits those keys.

Two concrete examples are worth resolving during an editor redesign:

- Remove Logo sets `logo_url` to `undefined`, so an existing saved logo may not actually be cleared by the update request.
- Reset Buyer Next Steps to Defaults sets `buyer_next_steps` to `undefined`, so an existing saved custom list may remain in the database.

Text inputs cleared to an empty string behave differently because the empty string is still sent and is not SQL null. This makes clear/reset behavior inconsistent across field types. A redesign should define explicit API semantics for “leave unchanged,” “clear this value,” and “return to product defaults,” then cover them with update-route/query tests.

## Authoritative output versus approximations

The production server PDF is the source of truth. The two Branding Profile feedback mechanisms are approximations today.

### Live preview

`components/branding/UtilitySheetPdfPreview.tsx` is a hand-built React/Tailwind miniature. It does not reuse the production HTML/CSS tree from `lib/pdf/packet-html.ts`.

Known drift as of this handoff:

- Its source comment and rendering logic say Advanced omits Home Basics. Production Advanced now includes Home Basics when values exist.
- It labels the Advanced utility section `Utilities`, while production uses `Utility Providers` in both modes.
- The production shared accent-bar language is not represented consistently across every preview section.
- Some comments still describe different Simple and Advanced document titles, although both now use `Utility Info Sheet`.
- It cannot show real page breaks, repeated table headings, running headers, or running footers.
- It uses sample content and only two representative Advanced modules.

The preview remains useful for immediate color/logo/contact feedback, but it should not be described as pixel-accurate until the duplication is removed or systematically synchronized.

### Generate Test PDF

`lib/test-pdf-generator.tsx` calls the shared HTML builder but then uses `downloadScreenshotPdfFromHtml()`.

Consequences:

- output is rasterized rather than selectable vector text;
- the entire result is scaled onto one page;
- production multi-page pagination is not exercised;
- production running headers and footers are absent;
- the current sample does not include Home Basics;
- it does not generate Advanced mode or Advanced sections;
- its visual result can differ materially from a real downloadable packet.

This is the most important technical mismatch to address if the Branding Profile editor is being polished around “what you see is what you get.”

## Recommended redesign direction

The safest refinement is to improve the editor while reducing renderer duplication.

### 1. Separate concerns in the editor

Consider organizing the experience into clear conceptual groups:

- Identity: name, logo, primary color
- Contact: name, phone, email, website
- PDF content: welcome message, disclaimer, Buyer Next Steps
- PDF display: date and powered-by toggles
- Communication templates: SMS/mailto/automatic email content
- Profile behavior: default profile and workspace scope

This makes it clear that Secondary Color and message templates are not currently PDF styling controls.

### 2. Make production rendering the preview source

Preferred options, in descending fidelity:

1. Generate a server-side preview PDF from unsaved synthetic packet data and display it in the editor.
2. Render the production HTML/CSS in a sandboxed iframe with the same synthetic data.
3. If the miniature React preview remains, derive a shared view model/design tokens and add parity tests.

A manual second template should be treated as an explicit maintenance cost, not an invisible convenience.

### 3. Replace the screenshot test-PDF path

Route test generation through the same Puppeteer `page.pdf()` pipeline and page settings used in production. The preview request should allow Simple/Advanced selection and include representative Home Basics, Utilities, Advanced sections, long values, welcome text, and disclaimer text.

### 4. Clarify the role of Secondary Color

Choose one of two honest product models:

- Keep it email-only and label/explain it that way; or
- deliberately add it to the shared PDF token system and define exactly where primary versus secondary applies.

Avoid introducing decorative second-color usage independently in Simple, Advanced, preview, and email templates.

### 5. Preserve content and pagination contracts

Visual polish can safely adjust tokens, spacing, border treatment, logo presentation, and hierarchy. Changes to section order, table semantics, field order, plan gating, or pagination require broader product and regression review.

## Safe-to-change areas

These are good redesign candidates when verified against the normal and overflow fixtures:

- Branding Profile information architecture and form grouping;
- helper copy and clear explanation of which surfaces each field affects;
- preview controls and mode selection;
- shared PDF spacing and typography within the one-page Simple budget;
- accent-bar weight, neutral palette, radii, and border polish;
- logo sizing/container behavior;
- responsive editor layout;
- server-backed preview/test-PDF implementation;
- shared design tokens or a normalized preview view model.

## Changes that require an explicit product decision

- different profiles or styling per Simple/Advanced mode;
- using Secondary Color in the PDFs;
- changing the canonical title;
- renaming `Utility Providers`;
- changing the Advanced filename prefix;
- moving the disclaimer into a repeating footer;
- changing `Generated on` from request creation time to render time;
- removing Home Basics from either mode;
- reordering shared document sections;
- changing which fields are paid-only;
- allowing arbitrary fonts, CSS colors, or remote assets;
- forcing every Simple document onto one page;
- snapshotting branding per request instead of resolving the live profile.

## PDF redesign guardrails

Any visual refinement should continue to satisfy:

- Simple Morris-sized content fits one page at a comfortable reading size.
- Larger Simple content paginates rather than globally shrinking.
- Advanced can use multiple pages without appearing accidental.
- Both modes retain selectable text.
- Utilities repeat the section and column headings on continuation pages.
- Long Advanced sections repeat their section heading.
- Provider rows, Advanced field rows, and individual buyer steps do not split.
- Running header/footer content remains inside the configured page margins.
- Long names, contact values, websites, steps, notes, and disclaimers wrap without clipping.
- Missing and failed logos degrade acceptably.
- Free/paid output remains honest.
- Both modes still read as one product family.

## Recommended visual test matrix

At minimum, render and inspect:

| Fixture | Purpose |
| --- | --- |
| Morris-sized Simple | One-page target and overall balance |
| Morris-sized Advanced | Intentional multi-page hierarchy |
| 30-provider overflow | Repeated Utilities headings and atomic rows |
| Long Advanced module | Repeated module title and border seams |
| No logo | Initials fallback and long brand name |
| Wide and square logos | Header balance and image loading |
| Maximum profile text | Wrapping, one-page pressure, and clipping |
| Free profile | Forced powered-by/date and default steps |
| Pro/Team profile | All toggles/custom content honored |
| Missing Home Basics | Section omitted cleanly |
| Empty utilities | Empty-state row remains valid |
| Website variants | Schemed, schemeless, long, and invalid values |

For each multi-page PDF, inspect every page—not only the first and last.

## Suggested implementation sequence for Opus

1. Read this handoff and [pdf-system-reference.md](./pdf-system-reference.md).
2. Inspect the production renderer before treating the current preview as a design reference.
3. Decide whether Secondary Color remains email-only.
4. Decide whether preview fidelity is part of the redesign scope.
5. Establish shared tokens/view-model boundaries before restyling multiple surfaces.
6. Update the editor information architecture and live feedback.
7. Update production PDF styling without changing table/pagination semantics accidentally.
8. Add or update parity and renderer tests.
9. Render the full visual test matrix.
10. Run focused tests, the complete suite, ESLint, and the production build.

## Code map

| Area | File |
| --- | --- |
| Branding Profile editor | `components/branding/BrandProfileForm.tsx` |
| Miniature live preview | `components/branding/UtilitySheetPdfPreview.tsx` |
| Test-PDF action | `lib/test-pdf-generator.tsx` |
| Screenshot PDF helper used by test action | `lib/pdf/client-screenshot-pdf.ts` |
| Production PDF HTML/CSS | `lib/pdf/packet-html.ts` |
| Production PDF browser pipeline | `lib/pdf/packet-attachment.ts` |
| Profile-to-packet normalization | `lib/packet/packet-data.ts` |
| Canonical title and color helpers | `lib/branding/deliverable.ts` |
| Branding limits and text clamping | `lib/branding/limits.ts`, `lib/branding/text.ts` |
| Profile API | `app/api/branding/route.ts`, `app/api/branding/[id]/route.ts` |
| Profile database queries | `lib/neon/queries/brand-profiles.ts` |
| Profile types | `types/index.ts` |
| Profile/API validation | `lib/validation/schemas.ts` |
| Database schema | `schema.sql` |
| Advanced module definitions | `lib/packet/modules.ts` |
| Branded email use of primary/secondary colors | `lib/email/email-service.ts` |

## Final handoff principle

Treat the production PDF builder as the current truth, the Branding Profile as a cross-surface content model, and the existing preview as a convenience that now needs reconciliation. The highest-leverage polish is not merely prettier fields—it is making the profile editor, preview, test download, and final Simple/Advanced PDFs tell the same visual and behavioral story.
