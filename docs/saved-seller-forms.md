# Saved seller forms

Saved forms provide named question configurations with independent reusable
URLs. Manage them in **Seller forms**; Settings' existing `?tab=link` entry opens
the same manager. Forms remain owned by their creator in their fixed workspace.
The default controls first selection for sharing and individual creation;
choosing a different form for one transaction does not change that default.

New/duplicate opens an unsaved draft. Duplication copies configuration and
introduction, then saving creates a fresh identity and URL. Existing utility,
HOA, meter, packet, module/detail and Branding Profile controls are reused.
Introductions are escaped plain text, limited to 500 characters and shown only
to sellers. Names are internal, limited to 80 characters. Preview uses the demo
wizard: no persisted request, usage, seller mail or provider API calls.

Form edits affect new requests. Started requests retain captured questions and
introduction. Individual creation may override question settings for that
request; form switches ask before replacing unsaved overrides. Manual API
creation without `formId` preserves its prior behavior. A selected form requires
`formRevision`; stale edits/starts return `409 FORM_REVISION_CONFLICT`.

Pausing stops new starts while existing seller links continue working. A paused
default stays the default and sharing is disabled with reactivation guidance.
There is no hard delete or team-wide form editing. Lost workspace membership,
banned/closing/closed owners and missing workspaces fail closed for public
metadata and starts. Switching the dashboard workspace never reroutes a form.

Custom slugs retain their existing paid entitlement. Changing a slug reserves
the new alias and preserves the old link/referral code. Referral display uses
the original account identity form, independent of default/workspace. Existing
referral eligibility, credit amounts and billing idempotency remain unchanged.
Branding usage includes every referencing form in the profile's scope; deleted
profiles fall back only inside that workspace. Account export includes form
configuration and request provenance/intro and continues excluding capability
tokens/URLs. Account closure deletes forms/aliases before deleting organizations.

## Approved commercial policy

Free includes one customizable saved form per creator/workspace. Pro includes up
to ten per creator/workspace; Teams includes up to ten per member in its Team
workspace. Paused forms count. Pro remains $9/month and Teams remains
$7/seat/month with the existing three-seat minimum; no SKU or Stripe price changes.

The authenticated workspace resolves capabilities server-side; PostgreSQL reads
the fixed account/organization plan and enforces scoped counts under the same
owner lock as allocation. An unrelated Team workspace cannot unlock another
workspace's forms. The operational technical cap counts all of the creator's forms
across workspaces, separately from this commercial allowance.

Free New form/Duplicate actions explain the Pro allowance when full. Commercial,
pilot and technical-cap denials use distinct reasons. Customization/preview stay
available. Downgrade retains every form, URL and configuration, allows edits and
pause/reactivation, and continues incoming submissions under existing Free
submission/paid-field rules. Additional allocation stops at/above the current
allowance. Re-upgrade restores stored paid behavior without recreating forms.

## Rollout and recovery

1. Rehearse `migrations-saved-seller-forms-expand.sql` against disposable native
   PostgreSQL, including multiple concurrent connections. Review catalog/index
   names and invalid active-membership handling. The migration aborts on invalid
   memberships rather than choosing a new destination. Never inspect live
   seller data to validate this feature.
2. Apply the reviewed expand migration with owner authorization. It preserves
   `intake_links_account_id_key`, original IDs, slugs, paused state and effective
   HOA/meter preferences. Insert triggers initialize old writer rows, register
   aliases and keep destination backfill idempotent. Requests remain unchanged.
3. Deploy compatible code with creation disabled. All intake writers must be
   ID/scoped, referral lookups explicit and propagation removed. Re-run/verify
   the expand backfill after old instances drain. During this window an account
   cannot initialize a second workspace form; APIs report rollout unavailability
   instead of copying/rerouting its original link.
4. Authorize/apply `migrations-saved-seller-forms-enable.sql`, removing only
   `intake_links_account_id_key`. Defaults are enforced by
   `seller_forms_personal_default` and `seller_forms_workspace_default`; global
   identity by `seller_forms_referral_identity`; alias slug is a primary key.
5. Additional form creation requires `SAVED_SELLER_FORMS_ENABLED=true`, a positive
   integer `SAVED_SELLER_FORMS_TECHNICAL_CAP`, and either
   `SAVED_SELLER_FORMS_ROLLOUT=all` (owner-selected full rollout) or an explicit
   comma-separated `SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS` allowlist. Missing or
   misspelled rollout mode never enables all users. The release uses technical
   cap 50 across each creator's workspaces; scoped commercial limits remain 1/10.
   The master switch defaults off. Automatic allocation in another workspace
   also requires these controls; first-ever provisioning and existing reads/edits
   remain available. Activate only after the enable migration and compatible deployment.
6. Verify original/old alias links, fixed destination, isolated configuration,
   snapshots/resume, referrals, branding and account lifecycle with authorized
   synthetic accounts before wider enablement. Browser fixtures are dev-only.

Recovery disables the creation gate while preserving reads, edits, published
links and snapshots. Do not restore old account-wide writers or account
uniqueness once multiple rows exist. Do not delete forms to roll back. Forward
fix and retain aliases, requests and collected answers.

Owner authorized the all-users release on 2026-10-02. Required release checks: native PostgreSQL rehearsal,
reviewed backfill target/catalog checks, actual CI validation and authorized
expand/deploy/enable steps. No live operation is implied by implementation.


Initial implementation validation on 2026-10-02 passed on Node 20.19.0: 173 Vitest files / 979
tests, production build, standalone TypeScript and tracked security scan.
Mocked Playwright coverage includes nine saved-form and 18 existing intake/seller
journey project scenarios across desktop Chrome, Mobile Safari and Mobile Chrome.
Eight embedded PostgreSQL tests verify storage constraints and atomic functions;
native multi-connection rehearsal remains required. Full lint still reports two
unchanged unrelated errors; changed-feature lint has zero errors. See
`.ai/CURRENT.md` and the implementation plan for evidence and limitations.


## Disposable native regression

Set `SAVED_FORMS_TEST_PG_BIN` to a local PostgreSQL binary directory and run
`npm test -- --run tests/unit/seller-forms-native.test.ts`. The test initializes a
new temporary cluster bound to 127.0.0.1 on a random free port, loads the full
schema and migration SQL, verifies real request/account FKs, and runs two native
connections. It ignores `DATABASE_URL` and ambient PG connection variables,
stops the server and removes its generated data directory. Without the binary
path the native suite skips; embedded/unit coverage still runs. CI should
explicitly opt into this suite on a host with PostgreSQL binaries. No existing
or live database is used.

PostgreSQL 17.11 regression on 2026-10-02 verifies both technical-cap ensure/create
race orders, both Free scoped-allocation race orders, concurrent paid tenth-form
creation, save-first/stale-start recovery and start-first/snapshot retention.
This bounded regression does not replace a production-version rollout/backfill
rehearsal with the reviewed target catalog and synthetic data.


Final correction/policy validation on 2026-10-02: Node 20.19.0 full suite
176 files / 1,007 tests passed (native suite enabled), production build,
standalone TypeScript and changed-file lint passed. Playwright saved-form suite
21 checks passed across all three projects; final upgrade/pilot-copy follow-up
six checks passed. Full lint still has the two unrelated baseline errors noted
above. No required local feature implementation remains; release steps remain
separately gated. See the completed plan and handoff for exact evidence.
