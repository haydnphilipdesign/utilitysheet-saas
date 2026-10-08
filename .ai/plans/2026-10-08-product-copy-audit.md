# Plan: product copy audit (plain, consistent wording everywhere)

- Status: **Completed** (2026-10-08). No required work remains. Committed and pushed to origin/main with owner authorization in chat on 2026-10-08; deployment not verified.
- Owner: Claude Opus 5.5. Branch: `main`, started from a clean worktree at `b4c367b`.
- Requested by the owner in chat on 2026-10-08, following the 2026-10-07 note
  ("clean up awkward wording, for example 'link ending'").
- No commit, push, deploy, migration, live database action or sent message is
  authorized by this plan.

## Scope

Wording and comprehension only, on every customer-facing surface, then Admin as
a separate pass. Behavior, authorization, entitlements, data structures,
internal identifiers, API field names and visual design do not change.
Customer-authored content and saved custom templates are never rewritten.
Historical plans, decisions and `docs/superpowers/` are not reworded.

A wording problem that turns out to be a behavior or design problem is recorded
under "Findings outside scope" instead of being fixed here.

## Verified facts this plan relies on

- Free is limited by **submitted sheets** per calendar month, not by requests
  (`.ai/decisions/2026-09-15-submission-based-free-metering.md`;
  `components/settings/billing-section.tsx` already says so). Copy that says
  "unlimited requests" or "counts against your monthly limit" for creating a
  request is inaccurate.
- The printed document title is "Utility Info Sheet" for both sheet types
  (`lib/branding/deliverable.ts#getPacketTitle`). It is rendered output and is
  not changed here.
- The two sheet types are named in one place, `lib/packet/modules.ts`
  (`PACKET_MODE_LABELS`): "Simple Utility Sheet", "Property Handoff Packet".
- Several API `error` strings act as codes: clients match on them
  (`components/settings/workspace-team.tsx`, `app/invite/[token]/page.tsx`) and
  unit tests assert them. They are **not** reworded. Prose shown to people is the
  API `message` field and client fallbacks.
- Seller reminder retries must reproduce the rendered email exactly for 23 hours
  (`.ai/decisions/2026-10-05-seller-reminder-operations.md`, payload
  fingerprint). Changing the default reminder wording makes an in-flight retry of
  a reminder sent just before deploy fail closed as "content changed". See Risks.
- Seller-facing wording must not assume the sender is an agent
  (`docs/saved-seller-forms.md`).

## Terminology guide

Use these for all new and changed copy. One concept, one name.

| Concept | Say | Do not say |
| --- | --- | --- |
| Plans | Free, Pro, Teams | Starter, Team plan, "Pro and Team", free tier |
| Shared account space | workspace (the people in it: your team, teammates) | organization, org |
| What you send for one property | request | intake, ticket |
| A request the seller completed | submitted sheet (Free counts these) | submission credit, live file, file (as a count) |
| The finished document | utility sheet (then "sheet"); "PDF" for the file | info sheet, packet (generic), output, deliverable |
| The public page for a sheet | sheet link | packet link, info sheet link |
| The two kinds of sheet | sheet type: Simple Utility Sheet, Property Handoff Packet | packet mode, mode, Seller Transition Packet |
| Optional groups of handoff questions | handoff sections | modules |
| Named set of questions with a link | seller form (Seller forms) | saved form, configuration |
| Link to a seller form, any property | reusable seller link (then "seller link") | intake link, permanent link |
| Link for one request | seller link | seller form link |
| Link that opens the default form | main link; its editable part is the link name | base link |
| Last part of one form's link | "the end of the link"; field label "Form link" | link ending, suffix, slug |
| Pause and bring back a form | pause, resume | reactivate |
| How many forms a plan allows | limit | allowance |
| Branding | Branding Profile (then "profile") | brand profile, branding profile |
| Message placeholders like {{link}} | placeholder | variable, token |
| Built-in message wording | standard wording | default template |
| Who the seller deals with | the Branding Profile name, or "your real estate team" | your agent |
| Who filled in the form | the seller | homeowner |
| Signing in | sign in, account | login, authenticate |

Voice rules:

- Say what happened and what to do next. Errors read "We couldn't … Try again."
  Never show "Failed to …", "Error …", "Unauthorized", "Forbidden", "Internal
  server error", "Invalid …" or "Rate limit exceeded" to a person.
- Success messages are short: "Profile saved", not "saved successfully".
- No em dashes. Use a comma, a period or parentheses. (A lone dash used as an
  empty table cell is not prose and stays.)
- Sentence case for new and changed labels. Clear labels are not recased only for
  style, so a button a product update or test names ("Reopen for Seller", "Close
  Without Changes") keeps its casing. Document section names printed on the sheet
  ("Home Basics", "Utility Providers", "Buyer Next Steps") keep title case.
- No developer words: configuration, payload, fallback, engine, JSON (unless
  explained), changelog, config.
- Keep real-estate terms the audience uses: listing, closing, TC, HOA, buyer side.
- Marketing may say "workflow" and "handoff" sparingly; product screens avoid
  "workflow".

## Coverage checklist

Status: `[ ]` not started, `[~]` partly done, `[x]` implemented. "Seen" records
how it was verified: browser spec run, screenshot, or source only.

### A. Seller forms and links (the owner's example)
- [x] `components/seller-forms/*` (list, card, editor, main link, form link, sharing, delete, pause, create)
- [x] `lib/seller-forms/{errors,server,links,capabilities,intake,intro-copy}.ts`, `app/api/seller-form-link-base/route.ts`
- [x] `components/seller-questions/SellerQuestionsDialog.tsx`, `components/advanced-modules/AdvancedModuleConfigurator.tsx`, `components/question-requests/QuestionGapCapture.tsx`
- [x] `docs/saved-seller-forms.md` customer-term references

### B. Seller flow (public, per-request and reusable link)
- [x] `components/intake/*`, `app/s/[token]/page.tsx`
- [x] `components/seller-form/**` (layout, wizard, every step, status notice, success)
- [x] `lib/packet/{seller-questions,hoa,modules}.ts` prompts and helper text
- [x] seller API messages (`app/api/seller/**`, `lib/seller-forms/intake.ts`)

### C. Dashboard and requests
- [x] `app/dashboard/page.tsx`, `layout-content.tsx`, `components/dashboard/*`, banners
- [x] `app/dashboard/requests/{page,new/page,[id]/page}.tsx`, `components/requests/*`
- [x] `components/test-drive/*`, `components/seller-form/steps/{TestDriveSuccess,WelcomeStep}.tsx`
- [x] `app/dashboard/updates/page.tsx`, `lib/product-updates.ts` (plan name only; posts are dated history)
- [x] `components/feedback-dialog.tsx`, `components/norma-suite-panel.tsx`
- [x] request API messages (`app/api/requests/**`, `app/api/test-drive`, `lib/reminders`)

### D. Branding Profiles
- [x] `app/dashboard/branding/**`, `components/branding/*`
- [x] `app/api/branding/**` messages

### E. Settings, billing, team, referrals, invitations
- [x] `components/settings/*` (polished 2026-10-07; check terms only)
- [x] `components/referrals/referral-credit-card.tsx`, `app/api/referrals`
- [x] `app/invite/[token]/page.tsx`, organization API `message` fields
- [x] `lib/account/closure.ts`, `app/api/account/**`, `app/account-closed/page.tsx`

### F. Signup, sign-in, onboarding
- [x] `app/auth/{login,signup}/page.tsx`, `components/auth/*`, `components/email-verification-banner.tsx`
- [x] `app/onboarding/page.tsx`, `app/api/onboarding/**`

### G. Public sheet and PDF
- [x] `app/packet/[token]/page.tsx`, `components/packet/transaction-referral-cta.tsx`
- [x] `lib/pdf/packet-html.ts`, `lib/constants.ts` (standard Buyer Next Steps), `lib/packet/packet-data.ts`, `app/api/packet/**`

### H. Email, SMS and default sharing templates
- [x] `lib/email/email-service.ts` (every template)
- [x] `lib/message-templates/{defaults,variables}.ts`, `components/branding/MessageTemplatesEditor.tsx`
- [x] share text built in `app/dashboard/page.tsx` and `app/dashboard/requests/new/page.tsx`
- [x] `lib/email/provider-incident-update.ts`: one-off incident mail already sent; not reworded

### I. Marketing, pricing, demo
- [x] `lib/marketing-content.ts`, `components/landing/*`, `components/marketing/*`
- [x] `app/(marketing)/**` (legal pages: read, change only plain errors; legal text is the owner's)
- [x] `app/demo/*`, `app/opengraph-image.tsx`, `app/layout.tsx` metadata

### J. Admin (separate pass, operator terms)
- [x] `app/(admin)/**`, `components/admin/*`, `lib/admin/*` displayed strings, `ADMIN.md` if terms change

### K. Tests, docs, validation
- [x] unit and browser tests that assert changed strings
- [x] `docs/saved-seller-forms.md`, `docs/pdf-system-reference.md`, `ADMIN.md`, `PRD.md` where they quote changed labels
- [x] `tsc`, ESLint on changed files, full Vitest, Playwright on three device profiles, build, security scan, `git diff --check`
- [x] screenshots reviewed for wrapping at phone width

## Method

A scratch extractor (outside the repository) listed every JSX text node and
prose-like string literal per file with line numbers; every customer-facing area's
list was read in full on 2026-10-08 before editing. Each area is then edited with
the source open, related wording searched across the repository, and its tests
updated in the same step.

## Acceptance criteria

1. No customer-facing string uses a "Do not say" term from the guide, except
   where recorded below as deliberately kept.
2. No customer-facing prose contains an em dash.
3. Consequential messages (permissions, billing, privacy, deletion) say the same
   thing as before, verified against the code they describe.
4. No behavior, route, schema, identifier or API field changed. `git diff` shows
   string, comment, test and document changes only.
5. Validation in section K passes, or each failure is explained.

## Risks

- **Reminder retry fingerprint.** If the default reminder wording changes, a
  reminder whose outcome is `pending`/`unknown` at deploy time cannot be retried
  as the same operation (it fails closed and can be settled in Admin). The window
  is 23 hours and applies only to reminders already in flight.
- **Strings used as codes.** Rewording an `error` value a client matches on would
  silently drop a friendly message. Search for each changed server string before
  editing it.
- **Longer labels on phones.** Checked with the three-profile browser specs and
  screenshots.
- **SEO.** Marketing meta descriptions and titles are left alone unless they use
  a wrong plan name.

## Decisions made in this task

Durable record: `.ai/decisions/2026-10-08-customer-facing-terminology.md`
(terminology table, voice rules, boundaries, what was deliberately kept, open
points for the owner).

## Outcome (2026-10-08)

Every checklist area above is implemented. 122 tracked files changed (564
insertions, 554 deletions), all of them string literals, JSX text, comments, test
assertions or documents; plus this plan and the decision record (new files).

What "implemented" means per area, and how it was seen:

| Area | Implemented | Seen rendered |
| --- | --- | --- |
| A Seller forms and links | yes | browser spec on phone and desktop; phone screenshots of the editor and delete dialog reviewed |
| B Seller flow | yes | browser specs (seller flow, intake, reopen, wizard); no screenshot reviewed |
| C Dashboard and requests | yes | requests list on phone (screenshot reviewed); dashboard, request detail, new request and sheet editor by unit tests and source only (no fixture) |
| D Branding Profiles | yes | unit tests and source only |
| E Settings, billing, team, referrals, invitations | yes (terms only; polished 2026-10-07) | settings spec on phone and desktop |
| F Sign-in, sign-up, onboarding | yes | unit tests and source only |
| G Public sheet and PDF | yes | packet spec; PDF text by unit tests only |
| H Email and default messages | yes | unit tests only; no email was sent |
| I Marketing, pricing, demo | yes, rendered components only | marketing spec already fails on the committed code (see Findings) |
| J Admin | light pass, customer-visible nouns only | unit tests and source only |

Deliberately not edited: the weekly summary email (not scheduled, not offered in
Settings); `lib/email/provider-incident-update.ts` (already sent); the legacy
`generateSellerNotificationHtml` / `generateSellerReminderHtml` (only tests call
them); landing components nothing imports (`ArtifactPreviewBand`,
`AudienceSection`, `BeforeAfterSection`, `DemoVideoSection`, `FeatureSection`,
`StatsSection`, `TrustStrip`, `UtilitySheetPreview`); legal pages; `PRD.md`;
default reminder subject, body and button text.

Deviation from the first draft of this plan: the seller email footer and the
"Your agent" fallback were changed for both the request and the reminder email,
so the reminder fingerprint risk in Risks applies. It is recorded in the decision
record under Consequences.

Validation (Node 20.19.0; `DATABASE_URL`, `RESEND_API_KEY`, `GOOGLE_AI_API_KEY`,
`STRIPE_SECRET_KEY` blanked in the process only):

- `tsc --noEmit`: clean.
- ESLint on the 119 changed TypeScript files: 0 errors, 7 existing `<img>` warnings.
- Full Vitest with native PostgreSQL: 221 files, 1678 tests passed after the
  last assertion updates (the final full run showed 5 failures in 4 files, all
  assertions on old wording; they were updated and those 4 files rerun green.
  The full suite was not run again after that).
- Playwright, three device profiles: 229 passed, 15 skipped, 8 failed in the
  full run. One (seller wizard review edit, Mobile Safari) passed on rerun. The
  other 7 fail identically on the committed code, checked by setting the edits
  aside and restoring them: see Findings.
- Fixture specs rerun on Mobile Chrome and Desktop Chrome: 88 passed.
- `npm run build`: passed. `npm run security:scan`: passed. `git diff --check`: clean.

Not verified: a signed-in browser, the hosted site, dark mode, a real email in a
mail client, a generated PDF opened by eye.

## Findings outside scope

Not fixed here.

1. `tests/marketing-mobile.spec.ts` fails on the committed code: it expects the
   headline to contain "utility handoff." (the hero now reads "Seller utility
   details. Ready for the handoff."), and on Mobile Safari `page.goto('/')` times
   out in every test.
2. `tests/requests-list.spec.ts` (shared workspace test, Desktop Chrome) reads
   `table.isVisible()` before the table has rendered and fails about half the
   time, on the committed code as well.
3. The pricing card called the free plan "Starter". Renamed "Free" on 2026-10-08 at the owner's request (decision record, Open for the owner).
4. The "What happens next" list on the new-request page said the PDF attaches
   "automatically"; that depends on a Notifications setting. Reworded to say so.
5. Several upgrade prompts said "unlimited requests". Requests were never
   limited; submitted sheets are. Reworded.
6. The public sheet's locked message told the recipient that the sender must
   upgrade their plan. Changed on 2026-10-08 at the owner's request to say only
   that the sheet is not available and to ask the sender for an updated copy.
   Still open, and a product rule rather than wording: a sheet locked at
   submission is unlocked only while the account is paid (the flag is never
   cleared in application code), so a sheet already shared with a buyer locks
   again after a downgrade. Read from the code, not reproduced.
7. API routes still return bare "Unauthorized", "Forbidden", "Not found" and
   "Internal server error" in `error`. Screens that fall back to `data.error`
   can show them. They are asserted as contracts in tests, so they were left.

## Progress log

- 2026-10-08: startup checks, mapping, terminology guide, all areas edited,
  tests and docs updated, validation run. Completed.