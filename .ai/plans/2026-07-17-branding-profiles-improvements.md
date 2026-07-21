# Branding Profiles Improvements

- Status: Phases A, B, and C COMPLETE and validated (584/584 Vitest, changed-file ESLint clean,
  tsc clean, production build succeeded). Field model was approved by the user on 2026-07-17;
  reply-to is automatic. Pending: commit, push to `main`, and the live migration (all
  user-authorized). Live authenticated browser QA remains a recommended follow-up.
- Owner: Claude Code
- Date: 2026-07-17
- Source audit: `.ai/plans/2026-07-17-settings-branding-configurability-audit.md`
- Authoritative PDF reference: `docs/pdf-system-reference.md` (read in full before this plan)

## Verified starting facts

- Worktree clean on `main` at `cb7630f`. The prior notifications slice is committed (the previous
  `.ai/CURRENT.md` said "uncommitted"; that was stale and has been corrected).
- Branding list: `app/dashboard/branding/page.tsx`. Editor: `components/branding/BrandProfileForm.tsx`
  (tabs: Brand, PDF Content, Messages) with production-HTML preview and test-PDF button.
- APIs: `GET/POST /api/branding` (GET auto-creates a first default profile; POST is paid-gated),
  `GET/PUT/DELETE /api/branding/[id]` (ownership checked against account or active organization;
  delete and default/advanced fields are paid-gated). Validation in
  `lib/validation/schemas.ts` (`brandProfileCreateBodySchema` / partial update schema).
- DB: `brand_profiles` (schema.sql:67). `requests.brand_profile_id` and
  `intake_links.default_brand_profile_id` both `ON DELETE SET NULL`. Profile resolution for PDFs:
  request profile -> scope default -> oldest (`getDefaultBrandProfile`).
- Emails: all sends `from: 'UtilitySheet <noreply@utilitysheet.com>'` (Resend); seller request and
  reminder emails render per-profile `message_templates` with variables
  `seller_name, seller_first_name_with_space, agent_name, property_address, closing_date, link`
  via `lib/message-templates/render.ts` (`{{var}}`; unknown variables silently render as '').
  No reply-to on seller emails today; profile `contact_email` appears in the email footer.
- Templates editor: `components/branding/MessageTemplatesEditor.tsx` (plain textareas, static
  variables hint, no insertion control, no validation, no resolved preview).

## Phase A — profile productivity and clarity (approved, in progress)

1. `POST /api/branding/[id]/duplicate` (new): auth + same ownership checks as `[id]` route,
   paid-gated like create; copies all configurable content (logo URL, colors, contact fields,
   disclaimer, message templates, buyer steps + title, display toggles, welcome message);
   new identity: new id, name `<name> (Copy)` truncated to the 60-char limit, `is_default: false`.
2. `GET /api/branding` annotates each profile (additive fields, array shape unchanged) with
   `request_count` (count of `requests.brand_profile_id`) and `is_intake_default`
   (matches the account's `intake_links.default_brand_profile_id`). New query
   `getBrandProfileUsage` in `lib/neon/queries/brand-profiles.ts`.
3. List page: show usage context per card (requests count, reusable seller form badge, default =
   preselected for new requests); Duplicate menu item; in-product delete Dialog
   (`components/ui/dialog`) explaining fallback behavior (requests fall back to the default/oldest
   profile; the reusable seller form reverts to the default; deleting the only profile recreates a
   basic default) replacing `confirm()`; overflow-menu trigger gets an accessible name.

Acceptance criteria:
- Duplicate creates a paid-gated, ownership-checked copy that never becomes default and lands in
  the same scope (personal vs active organization) as the source.
- Usage/default context visible on the list without changing the API array shape.
- Delete uses an in-product dialog naming actual fallback behavior; no `confirm()`.
- Overflow trigger has a per-profile accessible name.
- Focused Vitest for the duplicate route and list page behavior; changed-file ESLint; tsc; build.

### Phase A implementation record (2026-07-17)

All acceptance criteria met. Files changed: `app/api/branding/[id]/duplicate/route.ts` (new),
`app/api/branding/route.ts`, `app/dashboard/branding/page.tsx`,
`lib/neon/queries/brand-profiles.ts` (`getBrandProfileRequestCounts`), `lib/neon/queries/index.ts`,
`types/index.ts` (`BrandProfileWithUsage`), plus new tests
`tests/unit/branding-duplicate-route.test.ts` (8 tests) and
`tests/unit/branding-list-page.test.tsx` (4 tests).
Validation: 12/12 new tests pass; 50/50 across `brand-profile-form`, `branding-schema`,
`brand-profiles-update-query`, `onboarding-branding`, `packet-data`, `packet-route-branding`;
changed-file ESLint clean (one pre-existing `no-img-element` warning on the empty-state
illustration); `npm exec tsc -- --noEmit` clean; `npm run build` succeeded.
Not done: live authenticated browser QA (non-interactive session).

## Phase B — structured professional identity (COMPLETE)

Optional columns on `brand_profiles` (all nullable TEXT, clearable, length-limited): `company_name`
(80), `professional_title` (60), `license_number` (40), `license_state` (30), `compliance_line`
(160). Free-form; no regulated formatting guessed. Absent fields render nothing (verified by
`packet-html-identity` test). Fields pass through on every plan, like core contact fields/disclaimer.

Surface matrix as implemented:
- PDF header contact block: name+title line, company line, license line ("License #<n> · <state>").
  Compliance line renders as a small centered `.compliance-line` block just before the disclaimer.
- Web packet header card: same name+title/company/license lines; compliance line above the footer
  disclaimer.
- Request + reminder emails: footer identity lines (company, license line, compliance line).
  Professional title intentionally omitted from email per the approved matrix.
- Seller form: unchanged (no identity fields), by design.

Migration: `migrations-brand-profile-identity.sql` (IF NOT EXISTS, idempotent) + `schema.sql` mirror.

## Phase C — branded communications and preview (COMPLETE)

- Reply-to: seller request/reminder emails set Resend `replyTo` to the profile's validated
  `contact_email` (helper `safeReplyToEmail`); the `noreply@utilitysheet.com` from-address and
  authenticated sending domain are unchanged. Omitted when the email is missing/malformed.
- Templates editor: variable-insertion chips (caret-aware), inline validation of unknown/malformed
  `{{tokens}}` (`analyzeMessageTemplate`), and per-field resolved preview using safe sample data
  (`renderMessageTemplatePreview`). New module `lib/message-templates/variables.ts`.
- Test email: `POST /api/branding/test-email` — auth required, per-user rate limited
  (`reminderRatelimit`), sends ONLY to the authenticated user's own verified email (recipient is
  never client-supplied), sample seller data, `sellerToken: 'preview'`. Tests mock the email
  service, so no real external mail is sent. A "Send test email" button lives in the Messages tab.

## Out of scope (explicitly rejected by audit/product)

Arbitrary PDF fonts/margins/layout/pagination/title; separate Simple vs Advanced branding;
user-defined utility taxonomy; unverified custom sender domains.

## Validation plan

Focused Vitest per change; then `npx eslint <changed files>`, `npm exec tsc -- --noEmit`,
`npm run build`, PDF regression suites (`packet-html`, `packet-data`, `packet-route-branding`,
`packet-pdf-route`, `utilitysheet-pdf-preview`, `branding-schema`) when Phase B/C touch branding
render paths. Live authenticated browser QA is not possible in this non-interactive session and
remains a follow-up.

## Final integration review (2026-07-21)

- Organization-scoped list/create/read/update/delete/duplicate paths now require live membership instead of
  trusting a stale active-workspace pointer. Default updates use the source profile's verified scope.
- New request creation validates a selected Branding Profile against the authenticated account/active
  workspace before association. Existing request/profile fallbacks, messages, PDF/email/web-packet output,
  and Free/paid behavior remain unchanged. See the 2026-07-21 integration plan for final validation.
