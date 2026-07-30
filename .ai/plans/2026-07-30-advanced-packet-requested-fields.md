# Plan: Add Requested Advanced Packet Fields

## Status

Completed

## Objective

Add the missing standardized Advanced Utility Packet questions requested by a
transaction coordinator, preserve per-question inclusion controls, and make
those controls easier to discover.

## Background

Customer feedback requested the ability to remove irrelevant questions and
collect lawn, pool, pest, HVAC, other-maintenance, garage-code, and
keys/garage-remotes information. The current Advanced Utility Packet already
supports per-field exclusions plus lawn, pest, HVAC, and general service notes,
but it does not have dedicated pool, other-maintenance, garage-code, or
keys/remotes fields.

## Verified Facts

- Advanced question metadata, ordering, labels, and exclusions are centralized
  in `lib/packet/modules.ts`.
- Advanced answers are stored in the existing `advanced_packet_data` JSON
  boundary; no relational schema migration is required.
- Seller submission validation is centralized in
  `lib/validation/schemas.ts`.
- The seller form, submitted-sheet editor, public web packet, production PDF,
  and Branding Profile preview all consume the shared advanced metadata or
  typed packet data.
- Advanced questions can be configured both in Seller Form Defaults and while
  creating an individual request.

## Assumptions

- Existing requests remain compatible because every new field is optional.
- New questions should be included by default in their enabled modules and be
  individually removable through the existing exclusion controls.
- The product owner accepts optional garage access codes in privately shared
  capability-link/PDF packets.

## In Scope

- Pool service provider name and phone.
- Other maintenance providers and contact information.
- Garage door code.
- Location of extra keys and garage remotes at closing.
- Clearer settings/request-creation copy explaining that individual questions
  can be included or removed.
- Full lifecycle support in seller entry, validation, editing, web packet, PDF,
  preview data, and focused tests.

## Out of Scope

- Arbitrary user-defined custom questions.
- Changes to token authorization, packet sharing, or storage architecture.
- Production deployment, database operations, commits, or customer email
  delivery.

## Proposed Approach

1. Extend shared types, metadata, and module field ordering with optional fields
   under `service_providers` and `mailbox_access`.
2. Extend Zod validation and seller form controls using current field length and
   layout conventions.
3. Let metadata-driven packet/PDF/editor paths consume the new fields, adding
   only the long-text/editor classification needed for multiline fields.
4. Improve configurator labels and nearby settings/request copy so the
   individual include/remove behavior is explicit.
5. Add focused coverage for rendering, exclusions, validation, preview data,
   and seller interaction.

## Files or Areas Expected to Change

- `types/index.ts`
- `lib/packet/modules.ts`
- `lib/validation/schemas.ts`
- `components/seller-form/steps/AdvancedDetailsStep.tsx`
- `components/advanced-modules/AdvancedModuleConfigurator.tsx`
- `components/requests/SubmittedSheetEditor.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/requests/new/page.tsx`
- Relevant tests under `tests/unit/`
- `.ai/CURRENT.md` and this plan
- `.ai/decisions/2026-07-30-optional-access-codes-in-advanced-packets.md`

## Data, API, Schema, or External-State Impact

- The seller submission and submitted-sheet update payloads accept four new
  optional JSON fields.
- Existing database rows and API consumers remain compatible.
- No migration or external-state mutation is required.

## Risks and Edge Cases

- New default-included questions increase seller-form and packet length.
- Access codes are sensitive bearer-link/PDF content; the product owner has
  explicitly accepted that tradeoff for privately shared documents.
- Field exclusions and editor merge behavior must not drop legacy or excluded
  data.
- Metadata examples affect the production-parity Branding Profile preview and
  test PDF length.

## Validation Plan

- Focused Vitest coverage for advanced form fields, submission validation,
  field exclusions, packet data/order, preview data, configurator copy, and
  submitted-sheet editing where relevant.
- ESLint on changed TypeScript/TSX files.
- `npm exec tsc -- --noEmit`.
- Broader Vitest and build checks if focused validation exposes cross-cutting
  risk or after implementation is stable.
- `git diff --check`.

## Validation Results

- Focused Vitest: 7 files / 48 tests passed.
- Full Vitest: 134 files / 672 tests passed.
- `npm exec tsc -- --noEmit` passed.
- Focused ESLint passed for all changed TypeScript/TSX and test files.
- `npm run build` passed.
- `npm run security:scan` passed.
- `git diff --check` passed with line-ending warnings only.

## Acceptance Criteria

- Users can collect each requested missing item as a dedicated optional
  question.
- Every new question can be excluded independently in defaults and per request.
- Values survive validation and appear in the web packet and production PDF in
  canonical order.
- Paid users can edit submitted values using the existing editor.
- Existing requests and excluded fields remain backward compatible.
- The UI clearly explains how to include or remove individual questions.

## Handoff Notes

Implementation and validation are complete locally. No commit, push, deploy,
database operation, or customer email was authorized or performed. Preserve
unrelated pre-existing edits to coordination guidance files and do not add the
exported customer emails to source control.
