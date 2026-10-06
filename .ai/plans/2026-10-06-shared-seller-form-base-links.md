# Shared seller-form base links

- Date: 2026-10-06. Author: Codex. Baseline: `main` at `ccd4eda`; clean worktree at planning startup.
- Status: **Implementation, local validation and authorized live migration completed (Codex, 2026-10-06).** No required implementation or migration work remains. Owner explicitly requested the migration after local completion; commit/push/deployment remain separately gated and were not performed.
- Superseded in part (2026-10-06): the pinned bare base (section 1, items 2, 3 and 7) was replaced by `2026-10-06-base-link-follows-default.md`. The rest of this plan stands.
- Intended result: choose one custom base link for a creator's forms in a fixed workspace, then identify additional forms with an editable URL ending.
- Related: `2026-10-02-saved-seller-forms.md`; decisions `../decisions/2026-10-02-saved-form-{workspace-boundary,storage-and-snapshots,commercial-policy}.md`.
- No runtime code, schema, database, deployment, billing or email changes made during planning. No other active editor known; recheck before implementation.

## 1. Product contract and explicit assumptions

Example:

| Link | Destination |
| --- | --- |
| `/i/jane-smith` | Original base form |
| `/i/jane-smith/listing` | Listing form |
| `/i/jane-smith/closing` | Closing form |

The owner confirmed the shared-base concept. The following are recommended implementation choices, not previously established owner decisions:

1. A base belongs to one **creator and fixed workspace**, consistent with existing forms. Personal and Team workspaces have separate bases; different members do not share edit rights. This is not an account-wide link that follows the active workspace.
2. Initialize the base using the current workspace default form and its existing slug. This becomes the immutable **base form** identity. Do not invent a new branded slug, choose another form based on its name, or repoint an existing link.
3. The bare base continues opening that base form forever while it exists. Changing the dashboard default affects initial selection only; it must not repoint published URLs. Label the base form separately from the Default badge and explain this distinction briefly.
4. Additional forms receive a suffix, suggested from the internal form name on creation. Paid users can edit it. Renaming the internal form name does not automatically rename its URL. Duplication receives a fresh suffix and never copies published identity.
5. Customizing either base or suffix uses the existing Pro/Teams entitlement in the fixed scope. Free gets generated links, retains published custom links after downgrade, and may continue ordinary form edits/pause/reactivation. Do not change prices, form allowances, submission limits or billing.
6. Every previously published flat link continues opening its original form. After a base or suffix rename, previously published nested links also keep opening their original form. Published aliases cannot be reassigned, even to another form of the same creator or after pausing.
7. The base form's canonical share link remains bare; its editor explains that it uses the base link. Other forms share the nested URL. No form picker, transaction-stage flow or suffix on individual `/s/[token]` request links.

These choices let one custom identity be reused without weakening the existing permanent-alias contract. If the implementation owner requests materially different behavior, revise the plan before changing the model; do not silently reinterpret the base as a moving default.

## 2. Verified repository behavior

- `intake_links` is the creator-owned saved-form record, with fixed `organization_id`, `is_default`, independent `is_referral_identity`, and optimistic `revision`. Existing forms are already live; the completed saved-forms plan supersedes old rollout statuses in its decision records.
- `intake_link_aliases(slug PRIMARY KEY, intake_link_id)` reserves every published flat slug to its original form. `register_seller_form_alias` in `schema.sql` rejects reuse and preserves old aliases when `intake_links.slug` changes.
- `ensure_seller_form`, `save_seller_form`, and `set_default_seller_form` take the account lock first and enforce membership, ownership, commercial allowances and operational creation controls. Preserve this ordering and atomicity.
- `lib/neon/queries/intake-links.ts` is the query boundary. `serializeSellerForm` in `lib/seller-forms/server.ts` currently builds `/i/${form.slug}`. `/api/seller-forms` and `/api/intake-link` both use it.
- `FormEditor.tsx` edits a full flat slug per form; `FormsWorkspace.tsx` displays/copies `form.url`. Dashboard/new-request sharing uses the selected serialized URL. The activation-reengagement cron independently constructs `/i/${intakeLink.slug}` and needs review.
- `/i/[slug]/page.tsx` is a client intake screen with address selection/confirmation. Its layout is noindex, and `app/robots.ts` excludes `/i/`. Metadata/start APIs resolve the form, then `publicFormScope` checks the owner and fixed membership. Branding and entitlements use the target form's fixed scope.
- `/api/intake/[slug]/start` limits by slug/IP, resumes using `us_intake_${slug}`, and verifies owner, workspace, source form, address and submission status. New requests capture concrete configuration, source ID/revision and introduction. The request INSERT trigger rejects stale source revisions.
- Referrals deliberately use `getReferralIdentityForm`/the original identity form and flat aliases. Default selection and workspace switching do not change referral identity. Packet/PDF and seller completion use that identity slug for referral codes.
- Account export excludes capability tokens/URLs. Account closure explicitly deletes `intake_links` because the pseudonymous account row remains; relying only on account deletion cascades would leak new records.
- Meaningful test anchors: `tests/unit/{seller-forms-storage,seller-forms-native,seller-forms-route,intake-public-route,intake-start-route,intake-link-route,intake-slug,referrals-route,referral-credits-query,account-closure-query,account-export-route}.test.*`, `tests/saved-seller-forms.spec.ts`, `tests/intake-mobile.spec.ts`, and `app/test-fixtures/seller-forms/page.tsx`.

## 3. Recommended storage and identity approach

Extend the existing identity system. Keep all flat slugs/aliases, form IDs, scopes, defaults, referral identity and requests intact. Do not replace `intake_links` or infer nested links by string-concatenating independent flat slugs.

Recommended additive tables (names may follow repository conventions):

- `seller_form_link_namespaces`: ID, account ID, fixed organization ID (nullable for personal), immutable unique `root_form_id` referencing the base form. Separate partial unique indexes enforce one namespace per creator/personal scope or creator/organization scope. Organization deletion must not turn it into personal scope. Validate root ownership and exact scope in the SQL writer/backfill; FKs alone do not prove them.
- `seller_form_suffix_aliases`: namespace ID, validated suffix, target form ID, `is_current`, created timestamp. Primary key `(namespace_id, suffix)` reserves that suffix permanently; a partial unique index on `(namespace_id, form_id) WHERE is_current` gives one canonical suffix per non-base form. Historical rows can lose `is_current`, but their namespace/target/suffix mapping must never change. Verify target owner/scope in the writer.

The current base string is the base form's existing `slug`; all its entries in `intake_link_aliases` are base aliases for that namespace. This reuses the globally unique slug registry and avoids a competing global namespace registry. Nested resolution first identifies the namespace through a flat alias belonging to its base form, then resolves the suffix inside that namespace. Never treat an arbitrary non-base form's flat slug as a namespace.

This model deliberately supports old-base/new-suffix and new-base/old-suffix combinations, all to the same bound form. Each suffix is permanently reserved within its namespace. The bare old base remains its original flat alias. No redirects are required for compatibility.

Changing the base updates the base form's flat slug through the existing alias mechanism, with its expected revision. Changing a suffix atomically reserves the new alias, switches the current marker, and increments the target form revision. Re-selecting a historical suffix of the same form is safe; selecting another form's historical suffix is a conflict. Base-form identity never changes when defaults change.

Backfill/initialization:

- For each creator/scope with forms, choose the existing default, otherwise the same deterministic `created_at, id` fallback as `ensure_seller_form`. Pin that base form once. Preserve paused state and every existing alias. Abort on inconsistent owner/scope data rather than guessing a destination.
- Backfill other existing forms with deterministic opaque `form-<id-derived-ending>` suffixes, ordered by `created_at, id`, extending the ending on collision. Existing internal names are private and must not silently become public URL text. New-form name-based suggestions are visible for review before save; handle identical/short/non-ASCII names with bounded ID-derived endings. Do not generate an empty suffix. Explicit user-supplied duplicate suffixes get a clear conflict, not a silently modified value.
- Use lowercase letters/numbers/dashes and 3–60 characters, matching current slug rules. Automatic suggestions must produce valid results even for names that normalize to nothing. Normalize suggestions, but reject invalid explicit input with actionable validation.
- Backfill must be rerunnable without changing existing base/suffix identities or canonical choices. Reserve historical suffixes too. Initialize future namespaces/suffixes for every allocating path, including ensure, create, duplicate, compatibility overloads, and old inserts during the deployment window.
- Include a focused root migration and mirror the final schema/functions in `schema.sql`. Use additive schema and compatible writers; do not rewrite deployed historical migrations. Match current account-first locking, avoid reverse FK lock order, and exercise real concurrent connections.
- Ensure deletion of a base form during account closure cascades its namespace/suffix aliases and that deleting any target form removes its suffix aliases. Preserve restrictive organization behavior. There is still no user-facing form deletion or base reassignment.

## 4. Server, routing and resume work

1. Add typed canonical-link lookup/building under `lib/seller-forms/` and database resolution under `lib/neon/queries/`. Fetch link metadata in a bounded query for a list; do not introduce per-form N+1 reads. Serialize `url` from this shared path; keep legacy `slug` explicitly meaning the flat slug, rather than overloading it with a slash-containing path. Add base-form/suffix/base-revision metadata needed by editors.
2. Keep the flat public page/API working. Add `/i/[slug]/[suffix]` and reuse one intake page component for both shapes. Preserve address confirmation, branding, introduction, errors, phone sizing, navigation to `/s/[token]`, analytics and noindex. Do not duplicate the whole page or wizard.
3. Add nested metadata/start APIs using a route shape that cannot collide with existing `/api/intake/[slug]/start`, e.g. `/api/intake/[slug]/forms/[suffix]` and `/api/intake/[slug]/forms/[suffix]/start`. A direct `/api/intake/[slug]/[suffix]` would conflict when the suffix is `start`; use the explicit `forms` segment.
4. Extract shared metadata/start handlers used by both flat/nested endpoints. Each resolves the exact target server-side and runs the existing target-active/owner/membership/branding/plan checks. Pausing the base form stops the bare URL, but does not disable an active sibling form's nested link; namespace lookup must not require the base form to be active. Missing/paused targets and unknown/foreign suffixes return generic unavailable responses without listing forms or private data.
5. Resume and limits must identify the **resolved target form**, not just the base string. Use a cookie name based on immutable form ID for new starts. Read legacy slug cookies only when their alias is known to belong to that same target, validate every existing owner/workspace/source/address/status check, and migrate valid resumes to the new cookie. Never resume form A from form B's cookie just because they share a base or property address. Preserve the existing historical NULL-source fallback only for the referral identity form.
6. Make flat, nested and renamed aliases for the same target share a stable form/IP rate-limit identity. Preserve persistent-limit failure behavior and headers. Invalid-link requests still need an IP-based limit so invented slugs/suffixes cannot bypass protection; resolve with bounded queries, and keep an initial IP guard if necessary. Avoid removing an existing limit while extracting handlers.
7. Start always snapshots the selected form/revision through `formRequestFields` and `createRequest`. Keep request INSERT race protection and established stale-start 409 behavior. A URL change must not rewrite prior requests, seller tokens, public packet URLs or stored answers.
8. Add an authenticated base settings endpoint, for example `/api/seller-form-link-base`, deriving creator/scope from `sellerFormContext`, validating with Zod, enforcing existing paid checks, and using the base form's expected revision. Do not trust supplied account/organization/root IDs. Return canonical links or reload after save so sibling URLs refresh together.
9. Extend per-form updates with a distinct suffix field. Root-form suffix changes are invalid. Preserve legacy flat `slug` API semantics: a root slug change changes the base; a non-root slug change changes only that form's legacy flat alias. Existing compatibility paths must not accidentally update the wrong base after a default switch. SQL mutations remain atomic and reject stale/foreign IDs; preserve existing create/duplicate allowance enforcement.

## 5. Dashboard and caller changes

- Add one compact **Base link** setting above the forms list, with URL preview, paid customization control, clear save/error states, and the identity of the form opened by the bare link. Explain: "Other forms add an ending to this link. Previously shared links keep working."
- Non-base editors replace the full-flat-slug field with **Link ending**, show the immutable base prefix and full preview, and explain retention of previously shared links. The base editor points to the shared base setting and shows its bare link. Do not introduce two editable base controls.
- New/duplicate forms show a generated suffix suggestion and full URL; saving publishes only the unique validated identity. Keep previews side-effect-free and preserve unsaved draft/error behavior. If paid customization is blocked, keep existing form edits usable.
- Keep form cards, dashboard sharing, onboarding, selected-form sharing on new-request pages, copy/SMS/mailto, and activation reminders using the canonical serialized URL. Audit all `/i/` construction; a legacy flat link remaining valid is not a reason for selected-form share controls to keep generating the old layout.
- Keep referral signup codes tied to the existing identity form/aliases, even if that form is not a namespace base. Never replace referral codes with a suffix or a nested URL. If touching packet/PDF callers, read `docs/pdf-system-reference.md` first; no packet output changes are intended.
- Update `docs/saved-seller-forms.md` for the identity contract, UI, migration order and recovery. Record the implemented durable decision in `.ai/decisions/` after acceptance via the implementation prompt; do not mark recommendations accepted during this planning-only task.
- Review account export for new fields without exposing URL identities excluded by its existing contract; verify cleanup in `lib/neon/queries/account-closure.ts`. Prefer cascades from explicitly deleted forms, with tests proving no namespace/suffix records survive. No export or privacy policy expansion is required.

## 6. Implementation order and expected areas

1. Read startup files, verify current code/diff and take ownership in `.ai/CURRENT.md`; mark this plan implementing. Review the recommendations above as the contract approved by the owner's implementation prompt.
2. Build/rehearse additive migration, atomic initialization/suffix mutation/base mutation, and schema mirror with synthetic data; test data invariants before UI work.
3. Add typed link metadata/canonical serializer, exact public resolver, shared handlers and safe resume/rate identity. Keep existing API adapters functional.
4. Add shared page/nested page and endpoint wrappers, then base setting and suffix editing/creation UI. Update canonical URL callers.
5. Run the validation below, fix failures, update docs/decision/plan/current handoff, and prepare migration/release instructions. Implementation stops before live actions.

Expected edits: new root migration; `schema.sql`; `lib/neon/queries/intake-links.ts` (and query exports/new focused query module if needed); `lib/seller-forms/{server,config,public,errors}.ts`; new URL helper/shared intake handlers; `lib/validation/schemas.ts`; seller-form and intake APIs; shared intake component and flat/nested pages; `components/seller-forms/{types,FormsWorkspace,FormEditor,FormShareSelector}.tsx`; affected sharing callers/activation cron; relevant tests/fixtures; `docs/saved-seller-forms.md`; durable coordination files. Inspect account-lifecycle/referral consumers but edit only what this contract requires.

## 7. Acceptance criteria and required validation

- One base plus distinct suffixes opens the correct configurations/branding in the same fixed creator/workspace, through both metadata and start APIs. Personal/Team switching, different creators and removed membership cannot retarget links.
- Existing flat aliases and historical base/suffix combinations remain bound to their original forms after rename, default switch, pause/reactivate and downgrade/re-upgrade. Base paused/sibling active works as specified. Bare base never follows a changed default.
- Colliding explicit suffix/base edits return clear errors without partial changes; duplicate/name-generated endings are unique and valid. Historical alias reuse by another form is rejected. Stale base/form revisions return conflicts and preserve drafts.
- Create/ensure/duplicate allocate namespace/suffix records atomically without bypassing Free/paid allowance, pilot/master switch or technical cap. Backfill is deterministic and idempotent; no request or old URL is rewritten. A same suffix in different namespaces is valid.
- A legacy cookie resumes only its matching target. Flat/nested/renamed aliases resume the same eligible draft; same-address sibling forms cannot cross-resume. Submitted requests follow current no-resume behavior; reopened requests retain current behavior. Forged/malformed cookies fail safely. All aliases share target limits; unknown-link attempts remain limited; unavailable persistent limiter fails closed.
- Referrals, branding fallback, request provenance/revisions, manual individual creation, packet links and closure/export exclusions retain their contracts. Closure leaves zero related namespaces/suffixes.
- UI copies the selected canonical URL, refreshes sibling URLs after base edit, displays base versus default clearly, retains pause guidance and upgrade behavior, and works at desktop and phone widths. Preview creates no request or message.

Validation, focused first:

1. Unit/API tests for validation, link resolution/serialization, paid gating, base/suffix mutation, flat/nested metadata/start, cookie/rate behavior and compatibility adapters. Extend the existing test anchors above; mock provider/address services rather than calling them live.
2. PGlite migration/storage tests from a legacy fixture and full current schema: preserve aliases/requests, idempotent backfill, scoped uniqueness, collision rollback, revision conflicts, memberships, pause/downgrade retention and closure cascades.
3. Native PostgreSQL regression using `tests/unit/seller-forms-native.test.ts` (local temporary cluster, `SAVED_FORMS_TEST_PG_BIN`; ignores hosted credentials). Add concurrent same-base claim across accounts, same-suffix claim by two forms, ensure/create/duplicate initialization, rename/default overlap and old-writer compatibility. PGlite alone is not evidence for interleaving. Find an available local binary, or record this required check blocked instead of reporting a skip as a pass.
4. Extend `tests/saved-seller-forms.spec.ts`/fixture for base/suffix editing, canonical copying, duplicate conflicts, paused/default independence and paid/downgraded UI. Extend intake browser coverage for flat/nested address confirmation and start; run Desktop Chrome, Mobile Safari and Mobile Chrome with mocked APIs, no live writes. Check actual rendered widths/focus and console errors.
5. Focused ESLint on changed TypeScript; `npm exec tsc -- --noEmit`; `npm test -- --run`; `npm run build` with secret-backed external services disabled through process-only configuration (never print secrets or edit real .env values); `npm run security:scan`; `git diff --check`. Inspect new files directly for sensitive data because the scan covers tracked files only. Document unrelated baseline failures separately.

## 8. Release boundary and recovery

Local implementation includes the migration artifact and disposable-database rehearsal. **It does not authorize running SQL against Neon/any existing database, sending real email, changing deployment flags, committing, pushing or deploying.** Treat `.env.local` as live. Make the implementation concrete and reviewable before asking for the final live release authorization.

Prepare an exact reviewed order: additive schema/backfill plus compatible writer/trigger initialization, then deploy new resolvers/UI/canonical publishing after schema is available. Rehearse old application writes between migration and deployment, and report safe missing-schema behavior; do not hide unexpected DB errors behind a broad fallback. Backfill must cover forms allocated during the transition. Owner approves each live action explicitly.

Once nested URLs have been published, an old deployment without nested routes is not a safe rollback. Preserve schema/aliases and forward-fix or deploy a compatible recovery version retaining nested reads/starts. Do not reclaim names, reset namespace roots or remove collected data. Existing form-creation controls remain unchanged; a new rollout flag is optional only if a concrete deployment need justifies it.

## 9. Handoff and completion

Planning outcome: implementation-ready proposal created from current code; no product changes or runtime validation performed. Recommended next action is for the owner to send the accompanying prompt to Opus 5.5.

Implementer must update this plan and `.ai/CURRENT.md` at meaningful milestones. At completion, record exact files, tests/results, native/browser/build limitations and live migration status; create/update the durable URL identity decision and link it here. Mark local implementation complete only after required checks have actually passed or explicitly record outstanding required validation. Separate implementation completion from the owner-authorized release.

## Implementation outcome (2026-10-06)

Claude Opus 5.5 implemented the migration/schema, query/link helpers, canonical
serialization, base API, shared flat/nested public handlers/pages, and initial
storage tests before reaching its usage limit. Codex resumed on the owner's
instruction, finished the shared base/ending UI and canonical caller coverage,
added regression/concurrency/browser tests, and synchronized maintained docs and
the durable decision: `../decisions/2026-10-06-shared-seller-form-url-identity.md`.

Material corrections during completion:

- The failing legacy-insert storage fixture omitted existing additional-form
  default/referral flags. The fixture now supplies them; first-ever insert
  defaults and product guards were preserved. A temporary change that silently
  reset explicit insert flags was removed before final validation.
- Activation cron test mocks now include the canonical-link query; no fallback
  for incomplete production form rows was retained merely to satisfy a mock.
- Legacy resume checks query bounded cookie-alias candidates directly so cookies
  under older published aliases still work beyond 50 subsequent alias edits.
- Suffix suggestion collision handling stays inside validation length bounds,
  including after many historical endings. The ending follows a new-form name
  until the user edits it; saved names never rename a published ending.
- New browser mocks return real base/suffix metadata. Scoped selectors avoid
  matching the Next route announcer or other cards whose URL includes the base
  name. Nested navigation allows 15s for cold development compilation.
- Node 20 full validation exposed an existing account-security test race: the
  test clicked Confirm password while its initial fetch still disabled it.
  A narrow test helper now waits until enabled before clicking; no security
  implementation, guard or expected assertion changed. Wizard cleanup passed
  reruns after an earlier load-sensitive failure; its code/tests were preserved.

Implemented areas: `migrations-seller-form-base-links.sql`, `schema.sql`, intake
queries/exports; `lib/seller-forms/{links,intake,server,errors}.ts`; Zod payloads;
saved-form/base/intake APIs and compatibility adapters; flat/nested page wrappers
and `components/intake/IntakeLinkScreen.tsx`; `components/seller-forms/` base
editor, form editor, workspace and types; activation-reengagement canonical URL;
storage/helper/API/native tests and saved-form/intake browser specs;
`docs/saved-seller-forms.md`, decision and coordination files. Account export and
closure code were inspected and preserved; schema cascades and tests verify
cleanup, and no new URL fields were added to export.

Release boundary at local completion: migration had not yet run against any
existing/hosted database; its later authorized application is recorded below. No
real email, commit, push, deployment or deployment-setting changes. New source
files inspected directly for sensitive patterns; the owner's exported chat is
reference-only and remains untracked, excluded from staging. The concrete
migration order, pre/postconditions, partial-migration recovery and compatible
application recovery are in `docs/saved-seller-forms.md`, Shared base links.

Final verification, on Node 20.19.0 to match CI's major version:

- Complete Vitest run with disposable native PostgreSQL enabled: **202 files,
  1418 tests passed, zero skips** (`--maxWorkers=2`, 154.65s). Includes 12 native
  PostgreSQL 17.11 concurrency/compatibility checks and 12 PGlite storage checks.
  Earlier Node 22 full run also passed 202/1418. Initial load-sensitive failures
  and the security-test timing correction are described above; final run green.
- Both browser specs across Desktop Chrome, Mobile Safari and Mobile Chrome:
  **42 passed** (57.9s). Desktop/phone screenshots reviewed for layout and overflow.
  APIs/provider/address services mocked; no hosted writes or messages.
- TypeScript, changed/new TypeScript ESLint (including the timing helper), safe
  production build, tracked security scan and `git diff --check` passed. Build
  external services disabled through process-only settings; no real .env edits.
  New source artifacts directly inspected for sensitive patterns, no matches.

No required local work remains. Recommended next action: review the uncommitted
patch and release instructions, then obtain explicit owner authorization for
commit/push/deployment. Hosted smoke checks after
an authorized release and actual GitHub CI observation remain release work;
neither is represented as performed. Do not stage the exported chat or generated
test/build artifacts.

### Authorized live migration (2026-10-06)

Owner explicitly requested running the migration after local completion. Applied
the reviewed SQL to the configured Neon database using psql 17, stop-on-error and
transaction-local lock/statement timeouts. Both transactions committed. Startup
timeout options were initially rejected by the pooler before any SQL executed;
transaction-local settings resolved this runner issue without migration changes.

Preflight: existing saved-form writer/allowance/UUID functions present, obsolete
global uniqueness absent, zero uninitialized forms or invalid current aliases;
new tables absent. Postflight: 136 namespaces, 1 suffix alias, zero unmapped forms,
root/suffix scope mismatches or duplicate current endings; all new guards and
insert initialization enabled. All 137 forms, 138 flat aliases and 975 requests
preserved exactly according to counts and server-side whole-row fingerprints.
Only aggregate results emitted; no credentials or customer rows retained. The
temporary runner was removed. No required migration work remains; application
commit/push/deployment and hosted smoke checks still require owner authorization.
