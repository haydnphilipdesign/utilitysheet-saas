---
id: 2026-10-14-product-emails-slate-blue
status: released
updated: 2026-10-14T19:40:52.8172741Z
---
# Task: UtilitySheet product emails to slate blue

<!-- coordination:generated:start -->
## Current handoff

- Status: released
- Owner/session: Claude / claude-product-emails-5f5d1227
- Updated (UTC): 2026-10-14T19:40:52.8172741Z
- Branch: main
- Worktree: C:\Users\haydn\Documents\norma_suite\utility-sheet
- Base commit: 0ddf9d9afb78ce48a55f67e23a807c440c9ff6b8
- Plan: 
- Files/directories: lib/email/email-service.ts, lib/email/types.ts, lib/email/index.ts, tests/unit/email-templates.test.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/organization-invite-email.test.ts
- Shared resources: product-email-colors
- Integration owner: Haydn
- Environment/isolation: Node 20.19.0; Upstash vars cleared; synthetic data only; no email/Resend, no database, no dev server; scratch renders and screenshots outside repo
- Integration commit: fc23e4c08068b720315fc06a50a0cb3d25f4fa1f
- Release reference: fc23e4c pushed to origin/main; GitHub status Vercel=success
- Ownership relinquishment: 
- Outcome before relinquishment: 
- Blockers: 

## Summary

UtilitySheet product emails on slate blue with success-only green, centered buttons, solid header fallbacks, single seller greeting, darker alert button; released via push to main (Vercel success)

## Next concrete action

None required. Not verified: a live email in real clients (Gmail, Outlook) or production send.

## Validation evidence (reported, not executed by this helper)

- passed: `node node_modules/vitest/vitest.mjs run`; required=True; environment=Node 20.19.0; Upstash vars cleared; synthetic data; committed tree fc23e4c (pushed); no email, Resend or database; commit=fc23e4c08068b720315fc06a50a0cb3d25f4fa1f; checked=10/14/2026 19:40:04; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=lib/email/email-service.ts, lib/email/index.ts, lib/email/types.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/email-templates.test.ts, tests/unit/organization-invite-email.test.ts. re-run on fc23e4c: 254 files passed / 1 skipped; 2,223 passed / 13 skipped / 0 failed
- passed: `tsc --noEmit; eslint <6 email files>; scan-artifacts.mjs`; required=True; environment=Node 20.19.0; Upstash vars cleared; synthetic data; committed tree fc23e4c (pushed); no email, Resend or database; commit=fc23e4c08068b720315fc06a50a0cb3d25f4fa1f; checked=10/14/2026 19:40:04; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=lib/email/email-service.ts, lib/email/index.ts, lib/email/types.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/email-templates.test.ts, tests/unit/organization-invite-email.test.ts. re-run on fc23e4c: tsc exit 0; eslint exit 0; security:scan passed
- passed: `node node_modules/vitest/vitest.mjs run <8 email/seller-route test files>`; required=True; environment=Node 20.19.0; Upstash vars cleared; synthetic data; committed tree fc23e4c (pushed); no email, Resend or database; commit=fc23e4c08068b720315fc06a50a0cb3d25f4fa1f; checked=10/14/2026 19:40:50; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=lib/email/email-service.ts, lib/email/index.ts, lib/email/types.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/email-templates.test.ts, tests/unit/organization-invite-email.test.ts. re-run on fc23e4c: 8 files, 111 tests passed
- passed: `tsc --noEmit; eslint <4 changed files>; scan-artifacts.mjs; git diff --check`; required=True; environment=Node 20.19.0; Upstash vars cleared; synthetic data; committed tree fc23e4c (pushed); no email, Resend or database; commit=fc23e4c08068b720315fc06a50a0cb3d25f4fa1f; checked=10/14/2026 19:40:50; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=lib/email/email-service.ts, lib/email/index.ts, lib/email/types.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/email-templates.test.ts, tests/unit/organization-invite-email.test.ts. re-run on fc23e4c: tsc exit 0; eslint exit 0; security:scan passed; diff check clean
- passed: `scratch render + Playwright screenshots, 12 templates x 600/375px`; required=True; environment=Node 20.19.0; Upstash vars cleared; synthetic data; committed tree fc23e4c (pushed); no email, Resend or database; commit=fc23e4c08068b720315fc06a50a0cb3d25f4fa1f; checked=10/14/2026 19:40:51; tree=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; fingerprint-version=2; paths=lib/email/email-service.ts, lib/email/index.ts, lib/email/types.ts, tests/unit/activation-reminder-email.test.ts, tests/unit/email-templates.test.ts, tests/unit/organization-invite-email.test.ts. re-run on fc23e4c: 24 renders, no overflow, every button centered (equal gaps), solid header fallback in all 12
<!-- coordination:generated:end -->

## Scope, acceptance criteria, assumptions, and recovery notes

- Origin: owner decision after [2026-10-14-seller-followups-impl](2026-10-14-seller-followups-impl.md) (emerald is success-only; default brand moved to slate blue in `0ddf9d9`). Small task, no plan.
- Claim: the seller-followups claim still held `lib/email/email-service.ts` after its release. Owner authorized (2026-10-14) taking it over and releasing it; the helper labels that "abandoned", but that work was committed, pushed and migrated.
- Scope (owner-approved): UtilitySheet product emails use slate blue `#23588a` (header gradient to `#0b4072`, button, accent borders, links); emerald stays only where it means success; delete the legacy `generateSellerNotificationHtml`/`generateSellerReminderHtml` if only tests use them; solid `background-color` fallback under every changed gradient; no copy, layout, link, footer, sending, recipient, idempotency, attachment or telemetry changes. Owner also chose to recolor the activation reminder (teal `#0f766e`/`#065f46`); the org invite emails (neutral dark slate) were left as they are.
- Done in `caf9109` (base `0ddf9d9`):
  - `lib/email/email-service.ts`: new `PRODUCT_EMAIL_ACCENT`/`_DARK` (reuse `DEFAULT_BRAND_COLOR`/`DEFAULT_BRAND_SECONDARY_COLOR`), `PRODUCT_EMAIL_ACCENT_TINT` (`#e9eef3`, activation badge) and `PRODUCT_EMAIL_HEADER_BACKGROUND` (solid color, then gradient; header cells also get `bgcolor`). Applied to completion, referral credit, weekly summary and activation reminder. Legacy seller templates and their local params interface deleted (search of app/lib/components/scripts/tests: only tests used them). `__testing` now exports `generateReferralCreditEarnedHtml`.
  - Green kept (success): completion "✓ Submission Complete"/"✓ Test Complete" badge, "Free month earned" badge (both `#d1fae5`/`#065f46`), weekly summary "Completed" count (`#10b981`, darkened to `#047857` in the follow-ups). Amber warning (contact alert, weekly attention card) and the blue "Pending" count unchanged.
  - Tests: `tests/unit/email-templates.test.ts` (legacy tests removed; referral template added to common checks; color assertions), `tests/unit/activation-reminder-email.test.ts` (color assertions).
- **Committed** as `caf9109` (owner authorized 2026-10-14; not pushed).
- **Follow-ups (owner asked 2026-10-14), committed as `4882687`:**
  - Weekly summary "Completed" count `#10b981` to emerald-700 `#047857` (2.43:1 to 5.25:1 on `#f9fafb`); still green, still success.
  - `renderBulletproofButton`: non-Outlook table gets `align="center"` and `margin: 0 auto`. All 8 callers already sat in `text-align: center` cells, so every button (including branded seller emails and invites) is now centered. Outlook VML branch unchanged and not verified in real Outlook.
  - New `emailHeaderBackground(from, to, solid = from)`; every email header now has a solid `background-color` plus `bgcolor`: branded seller emails (brand primary; colors already pass `safeHexColor`), both invite emails (`#0f172a`), contact alert (darker end `#d97706`, since white on `#f59e0b` is 2.15:1). No header uses `background: linear-gradient` any more.
  - Tests: `email-templates.test.ts` (weekly color, centering, contact-alert and branded fallbacks including an unsafe brand color), `organization-invite-email.test.ts` (invite header fallbacks).
- **Remaining items (owner asked 2026-10-14), committed as `fc23e4c`:** seller request/reminder emails greet once (a short leading greeting line in the message template, verbatim, takes the greeting slot above the property card; templates without one keep the "Hi <first name>," fallback); contact alert button `#d97706` to amber-700 `#b45309` (white 3.19:1 to 5.02:1); unused `GenerateEmailHtmlParams` removed from `lib/email/types.ts` and `lib/email/index.ts`.
- **Released 2026-10-14:** owner authorized commit and push; pushed `0ddf9d9..fc23e4c` to `origin/main`; GitHub status Vercel=success for `fc23e4c`. Required checks re-run on `fc23e4c` (generated block).
- Not verified: real email clients (Gmail, Outlook, Apple Mail), the Outlook VML button branch, or a production send. Remaining note: the contact-alert header title is white on the amber gradient start `#f59e0b` (2.15:1; large text, solid fallback `#d97706` is 3.19:1).
- Required remaining work: none.
