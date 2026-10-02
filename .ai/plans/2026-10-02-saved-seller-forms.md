# Saved Seller Forms: Implementation Plan

- Date: 2026-10-02. Author: Codex. Baseline: `main`, following `735ddb0`.
- Status: **Release in progress.** Local implementation/review corrections complete. Owner authorized release and requested all-users availability instead of a pilot.
- Confirmed: fixed workspace per form; approved Free 1 / Pro and Teams 10 per creator/workspace. Prices unchanged; rollout disabled.
- Decision: `../decisions/2026-10-02-saved-form-workspace-boundary.md`.
- Owner authorized the release sequence (migrations, commit/push/deploy and verification); global rollout selected on 2026-10-02. Preserve unrelated feedback files.

## 1. Outcome and scope

A coordinator can save different seller forms for different transactions, select one when making an individual request, or embed each form's reusable link in an existing email/checklist. Early listing and late closing are different transaction workflows, not successive stages imposed on every seller.

First release:
- Named saved forms, one reusable link per form, duplication, editing, preview, pause/reactivate, and a default per owner/workspace.
- Existing utility-category, HOA, electric-meter, packet-mode, handoff-module and per-detail controls. Do not imply that every built-in question is individually configurable.
- An optional short seller introduction, distinct from the Branding Profile's packet welcome message.
- Existing Branding Profile selection, scoped to the form's workspace.
- Selection for individual request creation, with changes applying to that request only.
- Stable workspace routing, stable existing URLs, request snapshots, and referral compatibility.

Exclude: custom questions, branching/reordering, document uploads, credentials, staged follow-up, automatic transaction-stage detection, new reminder campaigns, team-wide editing/ownership transfer, and new output/PDF layouts. No automatic creation of Listing/Closing forms with guessed question selections. Use examples as suggestions for names, not mandatory transaction categories.

## 2. Evidence and verified current behavior

- `schema.sql` and `lib/neon/queries/intake-links.ts`: `UNIQUE(account_id)`, one slug, account-owned defaults. Several updates use only `WHERE account_id`; these must be replaced before enabling multiple rows.
- `app/api/intake/[slug]/route.ts` and `start/route.ts`: read the account's active organization at visit/start time; branding, entitlements, and new request organization follow that selection.
- `app/api/intake-link/route.ts`: validates and persists defaults, but module/exclusion updates call `propagateAdvancedModuleDefaultsToOpenRequests`; that query can affect other requests in the organization. Snapshot behavior requires an intentional change to this path.
- `requests` already stores category/mode/module selections and nullable HOA/meter choices. Individual creation writes explicit booleans; reusable starts currently omit them. Existing requests with NULL preserve live-preference inheritance.
- Public start resumes a request using a slug cookie, address, owner, and token; it currently has no saved-form ID to verify.
- `lib/neon/queries/referral-credits.ts`, `/api/referrals`, seller completion and packet data use intake slugs for referral identity. Default form selection must not change the account's referral identity.
- Activation, test drive, reengagement cron, branding usage badges, account export/closure, and admin queries consume intake links. Audit every caller, not only Settings.
- `/i/[slug]` and `WelcomeStep` have fixed seller copy. `brand_profiles.welcome_message` is packet content and must not be repurposed.
- Historical profiles discussion: September 3 product evaluation, Idea 6; September 10 growth audit, item 10. October 1 custom-question evaluation remains Proposed/Not started and does not authorize a builder.
- No live demand/usage queries performed in this planning session. Repeated use of multiple configurations is a hypothesis to measure, not an established market fact.

## 3. UX contract

Use **Seller forms** in navigation and **New form** / **Duplicate** as actions. Proposed routes: `/dashboard/forms` and `/dashboard/forms/[id]`. Keep the existing Settings `link` tab/deep link working as an entry to the new page; avoid maintaining two competing editors.

List each form's internal name, workspace, active/paused state, default badge, short included-section summary, and Copy link / Edit / Preview actions. Show only forms owned by the signed-in account in its active workspace in v1. Workspace membership alone does not grant editing of another member's forms; existing team request visibility remains unchanged.

Editor:
1. Internal name (1-80 characters) and optional seller introduction (plain text, maximum 500 characters; blank uses existing neutral copy).
2. Existing question settings and Branding Profile selector. Read-only workspace destination.
3. Seller preview that reflects the draft without creating a real request, counting usage, or sending messages.
4. Save with clear unsaved/error states. Never partially save one section if another fails validation.

Create/duplicate opens an unsaved draft. Duplicate copies configuration and introduction, not identity, URL, default status, or seller data. On successful save it receives a fresh globally unique slug. Pause controls new intake starts; existing seller/request links remain usable. No hard-delete/archive feature in v1; paused forms can be renamed and reused. Allow a paused default, visibly labeled, without silently switching links; hide/disable sharing with an explicit Reactivate action.

Dashboard keeps a compact default-form share control. Show a selector only when there are multiple forms, plus Manage forms. Selecting a form for sharing does not change the persistent default. First use still gives one useful form without a setup wizard. The automatic first form is named `My seller form`.

Individual creation preselects the workspace's default form, loads settings, and allows request-only overrides. Switching forms after edits asks before replacing those edits. Preserve an explicit existing/manual creation path for API clients without a form ID. Existing request data is never rewritten merely because the originating form changes.

Display the introduction consistently before address entry and on the seller welcome step after start; snapshot it so later edits do not alter that request. Render escaped text with normal whitespace handling, no HTML/Markdown/embeds. Do not put the internal form name or introduction in the buyer PDF. Keep system progress/help copy separate; do not invent completion-time promises.

Existing SMS/email templates remain scoped to Branding Profiles. Pass the selected form URL through the existing sharing path; review default copy for stage-neutral wording. Per-form message-template editing is deferred.

## 4. Ownership and data model

Recommended shape: extend `intake_links` into the saved-form record. Alternative considered: separate reusable preset and link tables with arbitrary many-to-many associations. That adds selection, synchronization, and deletion states the first release does not need. One row per form/link keeps ownership and behavior explicit.

Add to `intake_links`:
- `name TEXT`, `seller_intro TEXT NULL` with the above bounds.
- `organization_id UUID NULL`: fixed destination; NULL explicitly means personal scope, never "follow active workspace" after migration.
- `is_default BOOLEAN`: one default per account/scope. Separate partial unique indexes for personal and organization scopes avoid NULL uniqueness ambiguity.
- `is_referral_identity BOOLEAN`: one original/primary form per account, independent of selected default/workspace. Backfill the existing row as the identity. New accounts get one; later forms do not replace it.
- `collect_hoa_questions BOOLEAN` and `collect_electric_meter_number BOOLEAN`: concrete form defaults, backfilled from effective account preferences. Do not overwrite old requests.
- `revision INTEGER`: increment on configuration edits, used for optimistic concurrency and source provenance.

Preserve existing fields, IDs, slugs, activation state, categories, modules, and brand selection. Replace account uniqueness only after application writers are compatible. Default creation must be concurrency-safe and repair absence without duplicate forms. `is_default` provides at-most-one; transactional ensure/default-switch logic provides at-least-one for initialized scopes.

Add to `requests`: nullable `source_form_id` FK, `source_form_revision`, and `seller_intro` snapshot. Existing question columns remain the authoritative snapshot; do not duplicate them in a second JSON configuration blob. New form-based requests always supply concrete HOA/meter values. Historical NULLs retain established fallback semantics. Form ID is provenance, never the live source of seller questions.

Workspace checks:
- Account remains creator/request owner in v1. Resolve organization membership, Branding Profile scope, and plan server-side against the form's fixed organization; never use the visitor's or owner's currently selected workspace for public intake routing.
- A form in another workspace is not selectable through the current workspace's authenticated APIs. Reject forged owner/organization/brand/form IDs. Derive create scope from the authenticated context.
- Removed membership, missing organization, banned/closed owner: public metadata/start return generic unavailable/404, without silently sending data to personal scope or another workspace. Existing request access continues through its established boundaries.
- Do not use `ON DELETE SET NULL` for form organization IDs, which would turn an organization form into a personal form. Plan explicit cleanup with organization/account lifecycle and a restrictive FK. Pausing on membership loss must not depend only on a background job; reads enforce membership too.
- Brand deletion can retain existing selected-brand NULL fallback, but resolve fallback only inside the fixed workspace. Explain which forms use a brand in branding usage/deletion UI.

## 5. URL and referral compatibility

Existing URLs remain valid, including after introducing forms and changing the default. Keep custom-slug entitlement restrictions.

Recommended compatibility mechanism: `intake_link_aliases(slug PRIMARY KEY, intake_link_id FK, created_at)`, seeded with every current slug. Register every published slug; never reassign it to another form/account. The form's `slug` is its current canonical display slug. Custom-slug changes register a new alias atomically, retain the previous one, and reject collisions by alias uniqueness, including collisions with the owner's other forms. Account closure removes the aliases along with the owned forms under existing deletion policy.

Public lookup resolves canonical and old aliases to the same form. Preserve alias ownership checks in resume cookies. New requests must match `source_form_id` and fixed organization as well as owner/address; legacy cookie resume with NULL provenance is permitted only on the migrated original form and matching destination scope. Do not infer a match from address alone.

Referral creation/display reads the account's explicit referral-identity form, not an unordered first row or workspace default. Referral claim/credit SQL resolves codes through the alias-to-form-to-account mapping. Historical codes stay valid; multiple codes cannot produce duplicate credits for one referred account. Preserve self-referral checks, earned/applied/forfeited behavior, Stripe idempotency and transaction boundaries. Do not change credit amounts, eligibility or billing ownership.

## 6. API and code boundaries

Proposed authenticated API:
- `GET /api/seller-forms`: scoped summaries plus default ID and capabilities.
- `POST /api/seller-forms`: create from validated configuration or a same-scope duplicate source.
- `GET/PATCH /api/seller-forms/[id]`: owner/scope checked read and atomic update; expected revision required for editing, stale write returns 409 with reload guidance.
- `POST /api/seller-forms/[id]/default`: atomic default switch within owner/scope.
- Keep `/api/intake-link` as a legacy response-shape adapter to the current workspace default. Validate first, mutate atomically, and remove bulk propagation to open requests. Inventory and update internal consumers to explicit default, list, or referral-identity helpers.

New domain module `lib/seller-forms/config.ts` owns normalization/effective question settings and deriving request fields. Query/storage stays under `lib/neon/queries/`; input validation stays in `lib/validation/schemas.ts`. Share question editor components between forms and individual creation instead of copying the Settings page.

Caller shape: `resolveFormForRequest(authenticatedScope, formId, requestOnlyOverrides)` returns authorized, plan-effective request fields and provenance; public start uses the same configuration rules without accepting caller-supplied overrides. This boundary must not accept an unchecked client account/organization/plan.

GET metadata and POST start must use the same entitlement/workspace resolution. Paid-only fields remain enforced server-side; follow current downgrade behavior for effective Simple mode without destroying stored paid configuration. Membership revocation or a downgrade between page load and POST must be rechecked. Concurrency-sensitive state must be read consistently when recording the revision and snapshot.

Request POST accepts optional `formId`/expected revision and existing request-only overrides. Reject stale configuration with reload guidance; never silently drop the user's overrides. Preserve legacy no-form behavior and capture introduction only from an authorized form or validated explicit request-only field if that field is intentionally exposed later.

## 7. Implementation sequence and expected files

### A. Storage and compatible writers
- Add focused root migration(s), mirror `schema.sql`, and add/extend types.
- Implement scoped/default/referral helpers and concurrency-safe creation/default/edit/alias transactions in `lib/neon/queries/intake-links.ts`; export via `index.ts`.
- Add shared config normalization and Zod contracts. Replace every account-wide intake UPDATE and unordered first-row lookup with the intended explicit operation.
- Add integration tests against a disposable/local database for unique indexes, defaults, alias collisions, revision conflicts, and atomic updates; mocks alone cannot prove these guarantees.

### B. Public intake and request snapshots
- Update both `app/api/intake/[slug]` routes, `app/api/requests/route.ts`, request queries/types, seller GET/POST serialization, `/i/[slug]`, `/s/[token]`, `SellerWizard`, and `WelcomeStep`.
- Remove form-save propagation from legacy API. Preserve old request NULL behavior and collected answers/packet rendering.
- Keep preview/test-drive safe, unmetered, and restricted to the expected account; default test drive can use the selected workspace's default form.

### C. Forms UI and existing entry points
- Add forms pages and shared components under `components/seller-forms/`.
- Update `app/dashboard/layout-content.tsx`, dashboard share controls, `app/dashboard/requests/new/page.tsx`, Settings `link` entry, onboarding and preview integration.
- Update branding usage badges/copy and deletion consequences to cover all referencing forms in scope.
- Verify desktop/mobile layouts, keyboard interaction, labels, save failures, paused states, and selector/default distinction.

### D. Compatibility and lifecycle audit
- Referral query/service tests, `/api/referrals`, `lib/packet/packet-data.ts`, seller completion referral use; explicitly preserve packet referral behavior.
- Activation service, test-drive API, reengagement cron, and all `getOrCreateIntakeLink` callers: resolve explicit scoped default or global referral identity as appropriate.
- Account export includes new form configuration and request provenance/intro; preserve existing export exclusion of capability tokens. Closure and organization/member lifecycle handle forms/aliases without orphaning or scope conversion.
- Admin funnel/testimonial/account summaries must count accounts correctly with multiple forms; replace accidental multiplicative joins where applicable, retaining existing DISTINCT semantics where already safe.
- Update maintained product/docs and old Settings wording that claims account settings change sent forms. Do not rewrite historical plans as though the old behavior never existed.

### E. Validation and release preparation
- Complete acceptance matrix below, full applicable validation, rollout/rollback checklist, and final handoff. Mark implementation complete only after required checks pass; deployment is a separate authorized operation.

## 8. Pricing policy (approved; implemented locally)

Owner approved Free: one form per creator/workspace; Pro: ten per creator/workspace; Teams: ten per member in the Team workspace. Prices stay unchanged. Keep HOA/meter choices free and existing handoff/custom-slug gating unchanged. The full policy, rationale, downgrade rules and implementation requirements are in `../decisions/2026-10-02-saved-form-commercial-policy.md`.

Implement one central scoped capability check and atomic creation/count enforcement, including automatic ensure, instead of scattered component plan checks. Count paused forms. Return usage/allowance and separate commercial, pilot and technical-cap reasons. Technical abuse cap and pilot membership remain operational decisions; commercial counts are now settled. No new billing SKU is required.

Approved downgrade behavior: retain configurations/URLs, permit editing and pause/reactivation, continue incoming submissions under Free submission/feature rules, and block new creation/duplication at or above the allowance. Re-upgrade restores paid behavior. Retaining extra existing forms after downgrade is intentional.

Implemented locally: these rules, contextual Pro actions on Free, pricing/marketing/rollout copy and boundary/concurrency/downgrade tests. Coordinate with Sol's R1 correction: one baseline form per workspace is commercially valid, but automatic provisioning still needs explicit rollout and technical-cap enforcement. Approval does not enable production or authorize migration/deployment.

## 9. Acceptance and validation

Required scenarios:
1. Migration preserves IDs, slugs, saved settings, paused state and effective default question booleans; invalid workspace memberships are reported, not guessed.
2. A one-form customer can copy the original URL with no extra setup. Old Settings entry works. No preview creates a real request or sends mail.
3. Two forms keep independent settings; duplicate, save, pause, default switch and stale-write behavior are correct. Concurrent create/default changes cannot violate invariants.
4. Workspace A's link still creates requests in A after the owner switches to B. A/B brands, entitlements, lists and cookies never cross scopes. Membership removal fails closed.
5. Form/request introduction is plain text, bounded and seller-only. Preview, public intake and individual creation agree on effective settings.
6. Form edits (including through the legacy endpoint) never mutate started requests. Existing NULL overrides preserve legacy semantics; explicit new snapshots survive account/form changes.
7. Same address through different form links cannot resume the wrong request; legacy original-link resume still works when scope matches.
8. Custom slug changes retain old link/referral aliases; alias collisions and same-account collisions reject safely. Default switching cannot alter referral identity. Referred account still earns at most one credit.
9. Free/paid behavior, plan downgrade, paused/unknown links, rate-limit failure, banned owner, and invalid payload/foreign ID cases preserve server enforcement and privacy.
10. Branding usage/export/account closure/admin aggregate paths handle multiple forms; packet output and existing answers remain intact.

Focused suites extend existing intake-link/start/public-route, request-question, seller-question, branding scope, referral, activation, test-drive, account-closure/export and workspace coverage. Add genuine database integration coverage for constraints/concurrency and mocked browser flows for two different forms and workspace switching.

Run focused tests first, then `npm run lint`, `npm exec tsc -- --noEmit`, `npm test -- --run`, `npm run build`, and relevant Playwright flows across Desktop Chrome, Mobile Safari and Mobile Chrome. Run `npm run security:scan` plus direct inspection of new files (scanner only covers tracked files), and `git diff --check`. Use Node 20 if available; report runtime mismatch. Review representative Simple/Advanced output if request configuration changes affect output; production PDF builder remains authoritative.

## 10. Migration, rollout and recovery

Use an expand/compatibility/enable sequence, not a single unconstrained schema flip:
1. Prepare additive schema/aliases and a reviewed backfill. Keep `UNIQUE(account_id)` while old writers may run. Backfill original forms from a valid current workspace membership (personal if active organization is actually NULL); flag invalid membership for explicit resolution. This pins the current destination without moving existing requests. Seed aliases/referral identity/defaults and effective HOA/meter values.
2. Deploy compatible code with multiple-form creation disabled. Old code can still omit additive fields, so use a repeatable final backfill after it drains. Verify all writers are ID-scoped, referral lookups explicit, and snapshot semantics enabled. Account/workspace creation must not attempt a second form until the constraint is relaxed.
3. With separate owner authorization, remove old uniqueness and enforce the new scoped defaults/referral/alias constraints. Verify aggregate/catalog invariants, then enable a small pilot through a server-side rollout gate.
4. Verify existing URLs, workspace destination, new form creation, request snapshots, referral attribution, and account lifecycle before wider enablement. Exclude demo/test-drive from adoption measurement.

Live migrations/deployment require explicit owner authorization under repository instructions. Do not perform live reads of seller data for validation; use aggregate/catalog checks and authorized synthetic test accounts.

Recovery: disable new form creation while keeping all published links functional through compatible code. Once multiple rows exist, never roll back to account-wide writers or restore `UNIQUE(account_id)` by deleting forms. Forward-fix application issues; preserve forms, aliases, requests and captured answers. Document the actual SQL constraint names and rollout gate in implementation, not guessed names in this plan.

## 11. Measurement and execution handoff

Measure distinct non-demo forms actually used per account, second-form use on a subsequent transaction, starts-to-submissions, and configuration/share friction. Use stable form IDs/revisions and bounded event attributes; do not log introduction text, internal names, seller answers or new personal data. Existing question-gap instrument stays separate. Read `docs/ai-telemetry.md` before telemetry changes.

Suggested staffing (workflow recommendation, not a model benchmark): Astra owns architecture/rollout review; 6.1-Sol can implement the bounded phases; Opus 5.5 can provide an independent product/edge-case review. A single implementer is sufficient. Do not have multiple agents edit intake/query/Settings files concurrently, and do not dispatch other agents/chats without the applicable authorization. The same model can also execute the whole plan.

Implementation handoff prompt: "Read AGENTS.md, .ai/CURRENT.md, and .ai/plans/2026-10-02-saved-seller-forms.md. Verify the worktree and take ownership in CURRENT. Implement the saved-form feature in the plan's sequence, beginning with compatible storage/writers and tests. Fixed workspace is approved; pricing is not decided, so do not impose final commercial limits. Preserve unrelated feedback files. Do not commit, push, deploy or touch a live database. Update the plan and CURRENT at milestones; finish with validation evidence and remaining release decisions."

Planning milestone (before implementation): no planning work remained; implementation, pricing and release checks were pending at that point. Create/update durable decisions when recommended architecture choices are adopted during implementation. The fixed-workspace decision is already recorded because the owner explicitly selected it.

## Implementation milestones (2026-10-02)
- A implemented: compatible additive/enable migrations and PostgreSQL atomic functions; five disposable PGlite storage tests pass. Development-only PGlite dependency added for reproducible credential-free tests. Embedded PostgreSQL verifies constraints and atomic functions; a real multi-connection PostgreSQL rehearsal is still required before release.
- B implemented: fixed public destination, snapshot provenance/intro/question settings, scoped resume, atomic legacy adapter with no propagation, authorized individual form selection and stale revision rejection.
- C/D in progress: forms list/editor/demo preview, shared question controls, Settings/default share and request selector integration, referral aliases, account export/closure, scoped test drive and branding usage. No live actions performed.
- Operational gate: `SAVED_SELLER_FORMS_ENABLED=true` plus explicit comma-separated `SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS`; default disabled. No commercial form count is imposed. Live expand/enable/deployment and pilot activation still require separate authorization.

- C/D completed locally: creator-owned UI/draft demo preview, shared question switches, default sharing/request selection, explicit referral identity plus alias SQL, fixed-scope brand fallback/counts, export and closure/organization cleanup, activation/test-drive/reengagement, announcement/demo seed caller audit. Admin funnel uses DISTINCT and testimonial counts are pre-aggregated; no multiplicative join change needed.
- Decision adopted: `../decisions/2026-10-02-saved-form-storage-and-snapshots.md`.
- Validation milestone: 24 mocked Playwright flows passed across desktop/iPhone/Pixel; eight embedded PostgreSQL integration checks pass, including final schema bootstrap and configured technical cap. Full regression initially exposed a CRLF-sensitive Vite MJS parse failure (demo-seed), repaired by preserving LF. Build exposed nullable Branding Profile preview fields, now normalized. Full revalidation underway.
- Full lint baseline has two unchanged errors: ignored `.qa-artifacts/specs/first-use.qa.spec.ts:334` (`prefer-const`) and tracked `components/admin/EventLogTable.tsx:6` (`no-explicit-any`). Preserve unrelated files; focused feature lint and type/build checks remain required.


## Initial implementation validation (2026-10-02; superseded by review and corrections below)

Phases A-E are complete locally. The milestones above retain the actual implementation progression and repaired failures. Creation remains off by default; the final gate additionally requires a positive `SAVED_SELLER_FORMS_TECHNICAL_CAP`. This is an operational guard, not a final commercial entitlement. No commit, push, deployment, live database read/write, migration execution or seller email occurred.

Acceptance evidence:
- 1/3/8: eight fresh, credential-free PGlite PostgreSQL integration tests exercise expand preservation/compatible inserts, enable migration, scoped defaults, atomic functions, optimistic revisions, alias collisions, cap enforcement, referral identity, snapshots and final schema bootstrap. The embedded engine serializes clients; true simultaneous multi-connection native PostgreSQL rehearsal remains a release check.
- 2/3/5: mocked browser tests exercise independent forms, escaped draft intro preview with no writes, stale-save draft retention, unsaved duplicates, paused sharing, fixed workspace and override replacement confirmation. Existing public intake and Simple/Advanced seller journeys also pass. Desktop and mobile screenshots inspected; labels, dialogs and overflow assertions pass.
- 4/6/7/9: public metadata/start and authenticated request/API tests cover fixed scope, membership/owner failure, cross-form cookie exclusion, legacy resume, explicit snapshots/request-only overrides, revisions, invalid/foreign IDs, paid-field enforcement and downgrade retention. No commercial form counts are imposed.
- 8/10: referral/activation/test-drive/branding/export/closure suites pass with explicit identity/alias/scoped behavior. Packet-data test verifies seller intro/internal provenance exclusion; existing production PDF suites pass. Admin aggregate joins audited and already safe. Operational announcement/demo scripts audited but not run.

Final checks:
- Node 20.19.0 (temporary official portable runtime, checksum verified): full Vitest **173 files / 979 tests passed**, production Next.js build passed, standalone TypeScript passed, tracked-artifact security scan passed. Global Node selection unchanged. Node 22.22.2 also passed full suite/build/typecheck.
- Playwright: final saved-form suite **9 passed** (three scenarios in each of Desktop Chrome, Mobile Safari and Mobile Chrome). Existing intake/seller journey suites **18 passed** in the earlier combined run; **27 distinct project scenarios** covered. APIs mocked and local database URL disabled; no real authenticated/native database/browser session exercised.
- Changed-feature ESLint: **0 errors**, seven existing warnings. Full lint retains two unchanged baseline errors: `.qa-artifacts/specs/first-use.qa.spec.ts:334` (`prefer-const`) and `components/admin/EventLogTable.tsx:6` (`no-explicit-any`), plus baseline warnings. They were left untouched.
- `git diff --check` passed. Direct new-file secret-pattern inspection passed; tracked security scan alone does not cover new files.
- Evidence: screenshots under `C:/Users/haydn/.codex/visualizations/2026/10/02/01a0fd57-6c97-7580-985b-3fffe2457c95/`; Node 20 logs under `%TEMP%/saved-forms-node20-{tests,build}.log`.

No required local implementation work remains. Required release decisions/checks are commercial counts/downgrade policy, pilot eligibility/technical cap, disposable native PostgreSQL concurrency/backfill/catalog rehearsal, actual CI and separately authorized expand/compatible deploy/enable/pilot actions. See `docs/saved-seller-forms.md` for the exact sequence and recovery constraints. Unrelated feedback changes remain preserved; no concurrent editing known.


## Review correction workstream (2026-10-02)

Owner: Codex; scope authorized by owner: R1–R3 only, regression coverage and durable handoff. Review report is preserved as original evidence.

1. R1: gate/cap all additional automatic workspace provisioning inside account-serialized ensure; allow first-ever provisioning and existing-scope access. Pass operational capability from server query, retain safe legacy signature, return deliberate unavailable for gated additional defaults. Tests: disabled/nonpilot/cap reached, first form/existing reads, native ensure vs explicit creation.
2. R2: consistently account→form for source request insert and mutations/closure; mirror SQL and use real full-schema FKs in deterministic native two-connection test. Preserve snapshots/revision/membership checks. Disposable native rehearsal remains a release check beyond bounded regression.
3. R3: surface server conflict explanation; refetch selected form and offer preserve overrides or explicit replace. Retain address/contact/date/send intent, do not auto-retry/send. Component/browser recovery and failed-refetch tests.
4. Focused validation first, then full unit/type/build, relevant desktop/mobile browser checks, focused lint, security and diff checks. Preserve baseline lint/feedback issues; no live actions.



## Approved commercial implementation workstream

Owner added approved policy implementation during R1–R3 work. R1–R3 code and focused/native/browser validation are complete; remaining scope is SQL-authoritative per-creator/workspace allowance (Free 1 / paid 10), combined allocation gate/cap, API count/reason reporting, Free upgrade actions, retained downgrade configurations/URLs, and pricing/marketing comparison copy at unchanged prices. Counts include paused forms.

Expected files: shared seller-form capability/config/query/API, expand migration/final schema, FormsWorkspace/FormEditor/types, landing PricingSection/pricing page/marketing content, regression suites and rollout/decision docs. Acceptance: Free 1→2, paid 10→11, ensure/create and create/create races, isolated workspace/member counts, Team subscription scope, paused counting, downgrade edit/start and re-upgrade, forged inputs, contextual upgrade versus operational denial. Production gates remain disabled.


## Correction and commercial implementation completion (2026-10-02)

Status: **Completed locally; production release disabled/unapproved.** The original review remains preserved at `docs/audits/2026-10-02-saved-seller-forms-review.md`. No required feature implementation remains for R1–R3 or section 8.

- R1: ensure receives verified operational eligibility/cap; owner lock protects total/scoped counts. Existing scope reads/repairs and first-ever account provisioning still work when gated. Additional automatic allocation requires the pilot gate and account-wide technical cap. A first form in another workspace is commercially permitted but not exempt from operational controls. Safe old ensure/save signatures cannot allocate extra forms.
- R2: source request INSERT acquires account key-share before form share, matching owner-first mutations. Account closure locks owner before data/FK writes. Full-schema native tests verify real request/account FKs and deterministic two-connection interleavings; revisions and snapshots preserved.
- R3: individual request displays the actual conflict explanation, disables stale retry, refetches the selected form and offers keep-settings or reload-defaults. Address/contact/date/send intent survive both paths and failed refreshes; no automatic submit/mail.
- Policy: central API capability reports scoped usage/allowance, account-wide total, upgrade requirement and distinct commercial/pilot/technical reasons. SQL resolves plan allowance from account/fixed organization (Free 1 / paid 10), including paused rows, under the allocating lock. Downgrade leaves forms/aliases/configs editable and public starts subject to existing Free rules; re-upgrade restores paid configuration. No unrelated Team plan, forged scope or client allowance can unlock creation.
- UI/copy: New/Duplicate stay visible on Free with contextual Pro dialog, pilot caveat and billing link; customization/preview remain available. Usage/retained-downgrade copy and pricing/marketing comparison updated. Pro $9/month / Teams $7/seat/month and existing minimum seats/SKUs unchanged.

Validation evidence (Node 20.19.0):
- Full Vitest **176 files / 1,007 tests passed**, with native suite enabled. Focused correction/policy/API/request/closure suites **87 passed**. Final capability/error follow-up **25 passed**.
- Nine PGlite storage tests and six full-schema commercial tests; **seven native PostgreSQL 17.11 concurrency cases**: both technical-cap ensure/create orders, both Free scoped-allocation orders, concurrent paid tenth creation, save-first stale-start, start-first snapshot retention. Tests initialize/stop/clean their own localhost-only temporary cluster, ignoring DATABASE_URL/ambient PG settings. Binary runtime obtained from EDB link on official PostgreSQL download page; no global installation or live access.
- Playwright **21 passed** across Desktop Chrome/Mobile Safari/Mobile Chrome; final Free/pilot copy follow-up **6 passed**. APIs mocked/dev-only fixture and disabled database URL; recovery/upgrade desktop/mobile screenshots inspected. No application exceptions or layout overflow in covered flows. Existing dev color/cross-origin/baseline-mapping notices are unrelated.
- Production Next.js build, standalone TypeScript, focused changed-file lint, tracked security scan and direct new-file secret inspection passed. `git diff --check` passed.
- Full lint retains exactly two unrelated baseline errors (`.qa-artifacts/specs/first-use.qa.spec.ts:334`, `components/admin/EventLogTable.tsx:6`) and 19 warnings; preserved. One earlier full run had an unchanged account-security dialog test order-dependent failure (isolated case passed); the final full run passed all tests. No fix or weakening was made to that unrelated test/security UI.
- Logs: `%TEMP%/saved-forms-policy-{tests,build,lint}.log`. Screenshots: `C:/Users/haydn/.codex/visualizations/2026/10/02/01a0fd57-6c97-7580-985b-3fffe2457c95/*-{request-recovery,form-upgrade}.png`.

Remaining release work: review correction diff, choose pilot eligibility/account-wide technical cap, explicitly opt native suite into actual CI, rehearse production-version expand/backfill/enable against reviewed synthetic/catalog targets and authorize compatible deployment/migrations/pilot separately. Bounded native regression is complete; it does not prove every production rollout condition. Pricing/downgrade decisions are settled, not outstanding. Historical notes saying pricing was undecided describe the earlier implementation only. Existing feedback and prior implementation preserved; no concurrent editing known; no commit/push/deploy/live operation occurred.

## All-users release workstream (2026-10-02)

Owner: Codex. Current main baseline is `f771115`; origin/main matches. Owner selected all users, replacing the proposed allowlist pilot. Add explicit `SAVED_SELLER_FORMS_ROLLOUT=all`, retain master switch and account-wide technical cap (50); commercial 1/10 limits unchanged. Correct public operational-denial copy. Validate rollout controls, rehearse original-schema expand/backfill/enable on PostgreSQL 17.11, enable native coverage in GitHub CI, then authorized expand → compatible deployment with creation off → enable migration → global activation and smoke checks. Do not restore old writers after enable.

Read-only production preflight: matching previously verified database host fingerprint, PostgreSQL 17.11, 964 requests / 136 forms, zero invalid active memberships, old uniqueness present and expand not yet applied. Vercel project `utilitysheet` has Node 24.x: validate this actual runtime too; do not silently change infrastructure to Node 20. No live mutation yet.

Release validation milestone: explicit global rollout and neutral denial copy implemented. Node20 full suite 177 files /1,020 tests passed including 12 rollout tests and eight native PostgreSQL17.11 cases; genuine f771115 schema expand/legacy insert/repeat backfill/enable rehearsal passed. TypeScript, focused lint, security and 34-new-file sensitive inspection passed. Three browser denial-copy checks passed. Vercel production DATABASE_URL matches verified local target; Node24 remains production runtime. Release workflow added but not yet committed/run remotely. No live mutation, push or deployment yet. Remaining: actual CI/Node24 build, staged migration/deployment/global enablement and live smoke verification.

Production expand applied with bounded transaction-local timeouts; 136 forms initialized and aliases complete, old uniqueness preserved. Build passed. Owner explicitly requested main push, so CI runs on main alongside the gated compatible deployment. Production rollout remains disabled until enable migration.
