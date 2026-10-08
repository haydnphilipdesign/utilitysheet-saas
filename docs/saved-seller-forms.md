# Saved seller forms

Saved forms provide named question configurations under one reusable base link
per creator/workspace. Manage them in **Seller forms**; Settings' existing `?tab=link` entry opens
the same manager. Forms remain owned by their creator in their fixed workspace.
The default controls first selection for sharing and individual creation;
choosing a different form for one transaction does not change that default.

New/duplicate opens an unsaved draft. Duplication copies configuration and
introduction, then saving creates a fresh identity and URL. Existing utility,
HOA, meter, packet, module/detail and Branding Profile controls are reused.
Introductions are escaped plain text, limited to 500 characters and shown only
to sellers. Names are internal, limited to 80 characters. Preview uses the demo
wizard: no persisted request, usage, seller mail or provider API calls.

### First screen of the link

The first screen of a reusable link shows a heading, an introduction and a
fixed "Your progress saves automatically." line, above the property address.
Each form may replace the heading (`seller_heading`, 80 characters) and the
introduction (`seller_intro`). Both are plain text and available on every plan.
The standard wording lives in `lib/seller-forms/intro-copy.ts` and names the
form's Branding Profile. The editor prefills both fields with that wording and
stores nothing while a field is empty or unchanged, so the standard text keeps
following the profile name. The editor's "What sellers see first" preview and
the public screen render the same `components/intake/IntakeIntro.tsx`.

The heading belongs to the link's first screen only; it is not captured on
requests. The introduction is still captured on each request and greets sellers
on the welcome step of requests created from the dashboard. A seller who came
through the link's first screen is not shown it a second time (a browser session
marker; if it is missing the introduction simply shows again).

Seller-facing wording does not assume the sender is an agent, because some
customers are transaction coordinators: screens name the Branding Profile, or
say "your real estate team" when there is none.

The form editor links straight to the selected Branding Profile, and each
profile on the Branding page links to the seller forms that use it. A profile's
"Welcome message for the buyer" is printed on the buyer's sheet and is separate
from the seller heading and introduction.

`migrations-seller-form-heading.sql` adds the column and the `sellerHeading`
key in `save_seller_form`. It is additive and may be applied before or after
the application: until it is applied the heading reads as empty and saving one
has no effect.

Form edits affect new requests. Started requests retain captured questions and
introduction. Individual creation may override question settings for that
request; form switches ask before replacing unsaved overrides. Manual API
creation without `formId` preserves its prior behavior. A selected form requires
`formRevision`; stale edits/starts return `409 FORM_REVISION_CONFLICT`.

Pausing stops new starts while existing seller links continue working. A paused
default stays the default and sharing is disabled with reactivation guidance.
Pause and Resume save immediately, from a form card's menu or the editor's
"Link and availability" section; they are not part of the editor's Save.

The Seller forms list adapts to the number of forms. With a single form its
card shows one link and "Rename link" renames the main link; the Main link card
and the main/own link distinction appear only from the second form on. Each
card has Copy link and Edit, with Preview, Duplicate, Rename link, Make default
and Pause/Resume in its "more" menu. The editor groups settings into Basics,
What sellers are asked, Branding, and Link and availability, with a sticky bar
that holds Save, Preview, the save status and any save error.
A form can be deleted and, in a Teams workspace, shared with the team; see
"Sharing a form with a workspace" and "Deleting a form". Lost workspace
membership, banned/closing/closed owners and missing workspaces fail closed for
public metadata and starts; for a shared form the owner that matters is its
current owner, not its creator. Switching the dashboard workspace never reroutes a form.

Custom slugs retain their existing paid entitlement. Changing a slug reserves
the new alias and preserves the old link/referral code. Referral display uses
the original account identity form, independent of default/workspace. Existing
referral eligibility, credit amounts and billing idempotency remain unchanged.
Branding usage includes every referencing form in the profile's scope; deleted
profiles fall back only inside that workspace. Account export includes form
configuration and request provenance/intro and continues excluding capability
tokens/URLs. Account closure deletes forms/aliases before deleting organizations.

## Sharing a form with a workspace

Decision: `.ai/decisions/2026-10-07-shared-seller-forms.md` (with its Amendment).

In a workspace on Teams, the person who created a form can share it. Every
member then sees it under "Shared by your team", can copy its link, preview it,
copy it into their own forms and create requests from it; a request a member
creates belongs to that member. Only the creator, the form's current owner and
workspace admins can edit, pause, resume, rename the ending of, stop sharing or
delete a shared form. Only the creator renames their main link name or chooses
their default form.

Storage: `intake_links.account_id` stays the creator and the owner of the
form's link names. `shared_owner_account_id` is set while the form is shared and
names the member who receives requests that sellers start from its link. Sharing
never changes a form's address, and referral credit through a link name stays
with the creator.

- Stopping sharing returns the form to its creator as a personal form. It is
  refused once the creator has left the workspace, or when the creator already
  has as many personal forms as their plan allows.
- When the owner leaves, is removed or closes their account, the form passes to
  the same admin as their requests and Branding Profiles and its link keeps
  accepting sellers. Their personal forms stop working, as before. On account
  closure the form that owns the link name is kept as an empty, deleted
  placeholder when a shared form still hangs under it.
- Shared forms count against the workspace, ten per current member, and not
  against their creator's ten. The count is checked when a form is shared.
- Sharing needs Teams at that moment. If Teams stops, forms already shared stay
  shared and keep working; nothing new can be shared.
- Submission emails are unchanged: they go to the request's owner, plus admins
  when the workspace setting is on.

APIs: `GET /api/seller-forms` returns the caller's forms and the workspace's
shared forms with `shared`, `isMine`, `canEdit`, `canShare`, `canDelete` and
`ownerName`, plus `capabilities.sharing`; `PUT /api/seller-forms/[id]/share`
takes `{ shared, revision }`. The rules are enforced in `set_seller_form_shared`,
`save_seller_form` and `validate_request_source_form`; every form change locks
the creator's account row.

## Deleting a form

Every plan can delete a form that is not the default (make another form the
default first, so a workspace always keeps one). Deleting is permanent in the
product: the form leaves every list and picker, stops counting toward an
allowance, and its links answer like an unknown link. Requests created from it
are kept, and sellers who already started can finish.

Deleting releases the form's link endings, current and earlier (owner decision,
2026-10-07): another form under the same link name can then be given one of
them, and a link shared earlier with that ending opens that form from then on.
Endings stay permanent in every other case (rename, pause). The row itself is
kept with `deleted_at` set, so the form's flat link name and any referral code
stay bound to it; the workspace's main link name is not affected. The
operational cap on forms per creator keeps counting deleted rows. `DELETE
/api/seller-forms/[id]` takes `{ revision }`.

## Shared base links and form endings

Links are handed out under `/form/`. The earlier `/i/` prefix serves the same
pages and stays live permanently, so links shared before the change keep
working; only the prefix the product displays and copies changed.

For example, `/form/jane-smith` opens the default form, while
`/form/jane-smith/closing` always opens the Closing form. The Base link setting
belongs to one creator in a fixed workspace, never the currently selected
workspace of a public visitor. Other workspace members do not gain editing rights.

The bare base link follows the default (owner decision, 2026-10-06, replacing
the earlier pinned rule). "Make default" changes what the bare link and every
earlier base name open, including where they were already shared, so the
dashboard asks for confirmation first. Every form, including the default, also
has its own permanent ending, so each form keeps a fixed address whatever the
default is. The default form's card shows the bare link and lists its ending
link as a second address. Pausing the default makes the bare link unavailable;
other active forms still open from their endings.

The form that was the default at initialization (oldest if none) owns the base
name in storage (`root_form_id`). That ownership is permanent and only matters
for renaming the base and for referral codes; it no longer decides what the
bare link opens.

Edit the shared base above the form list. Every form has a "Form link" field
(its ending, shown after the fixed part of the link) and full preview. Customer
wording never says "ending", "suffix" or "base": the dashboard says "main link",
"link name" and "the end of the link" (see
`.ai/decisions/2026-10-08-customer-facing-terminology.md`). This document keeps
"ending" and "base" as the storage terms.
New/duplicate drafts suggest a unique ending from the name, visibly before save.
Editing the suggestion makes it independent of later name changes. Internal
names remain private: a form that is not given an ending (the first form of a
workspace, old writers, backfills) gets the lowest free `form-N` in its
workspace instead of silently publishing its name. Earlier ID-derived endings
(`form-<hex>`) were replaced as the current ending by
`migrations-seller-form-readable-endings.sql` and stay reserved, so they keep
opening the same form. The dashboard calls the base the Main link, and each
form card can rename its own ending in place. Custom base/ending edits require
Pro/Teams in the fixed scope. Downgrade retains all published links and allows
ordinary form edits, pause and reactivation.

Every flat slug is still permanently bound in `intake_link_aliases`. All aliases
of the form that owns the base name identify the same
`seller_form_link_namespaces` row, and `getIntakeLinkByBaseSlug` resolves any of
them to that scope's default form. A flat slug of any other form still opens
that form. `getIntakeLinkBySlug` keeps returning the alias owner and remains the
referral-code lookup.
Each `seller_form_suffix_aliases` entry permanently binds an ending to its
original form; one entry per form is current. Renames retain every
earlier alias, including old-base/new-ending and new-base/old-ending combinations.
Published endings cannot be claimed by another form even after pause or rename.
Database writers serialize on the account row and retain optimistic revisions.
Legacy `slug` API fields continue to mean flat slugs, not nested paths.

Both public pages use `IntakeLinkScreen` and the same metadata/start handlers.
Nested APIs are `/api/intake/[slug]/forms/[suffix]` and their `/start` child, so an
ending named `start` cannot collide with the original flat start endpoint.
New resume cookies and rate limits use the immutable target form ID. Legacy
cookies are accepted only after checking that their flat alias belongs to that
target (including the cookie named after the slug in the URL, because the bare
link may now open a form that does not own that slug), then checking account,
fixed scope, source form, address and status.
Alias checks query only the bounded cookie candidates; very old aliases are not
excluded merely because the form has many newer aliases. Unknown links share an
IP limit, and persistent-limit outages continue to fail closed.

Canonical URL serialization supplies cards, selected-form sharing, compatibility
APIs and activation reminders. Referral codes still use the account's original
referral identity form and flat aliases. Requests, seller tokens, packet links,
captured answers, commercial limits and prices are unchanged. Namespace/ending
records cascade from forms explicitly removed during account closure; export
continues excluding URL identities/capability tokens.

### Base-link migration and release

A fifth file, `migrations-seller-form-sharing-and-delete.sql`, follows the four
below. It adds `shared_owner_account_id` and `deleted_at` and replaces
`ensure_seller_form`, `save_seller_form`, `set_default_seller_form` and
`validate_request_source_form`, so rerun it after rerunning any of them. It is
additive and safe under the previously deployed application, and must be applied
before the application that reads the new columns is deployed.

Four files, always in this order: `migrations-seller-form-base-links.sql`,
`migrations-seller-form-default-base-link.sql`,
`migrations-seller-form-readable-endings.sql` (readable `form-N` automatic
endings; changes no form, flat alias or request row), then
`migrations-seller-form-heading.sql` (seller heading; it replaces
`save_seller_form`, so rerun it after rerunning either of the first two). Each later file replaces
functions an earlier one installs, so after rerunning one, rerun those after it. The second gives every form that
owns a base name its own ending and lets it be renamed; it is additive,
rerunnable and safe under the previously deployed application, and must be
applied before deploying the application in which the bare link follows the
default (otherwise a non-default owner of the base name has no link of its own).
Rerunning the first file reinstalls its earlier writers, so always rerun the
second after it.

`migrations-seller-form-base-links.sql` must precede the new application deployment.
It adds schema/guards/compatible writers in one transaction and backfills in a
second transaction using account-first locks. New inserts during this interval
initialize their link records through a trigger. Re-running the migration must
leave pinned roots, current endings, existing aliases and requests unchanged.
The first transaction can succeed while the backfill fails; in that case retain
the compatible additive schema, fix the reported precondition and rerun before
deployment. Do not deploy the new readers until both parts and postconditions pass.

Release requires the owner's separate authorization. Review the target and confirm
the existing saved-forms migrations are present; obtain aggregate preflight counts
for forms, flat aliases and requests, and check for uninitialized scopes. Apply
the reviewed migration using a runner that supports its explicit transaction
boundaries. Verify no form lacks its pinned base/current ending, no namespace or
ending crosses creator/scope, existing counts/IDs/flat aliases are preserved, and
no request has changed. Do not log seller data or credentials. Then deploy the
compatible application and use authorized synthetic accounts to verify bare,
nested and historical links; suffix/base rename; default and pause independence;
draft resume; downgrade and a fixed-workspace submission.

The new readers expect the migration: missing tables return a generic operation
error rather than pretending a failed query was an absent namespace. Existing
flat public intake handlers remain usable until the new deployment. Once nested
links publish, rolling back to application code without nested resolvers breaks
them. Keep schema and alias reservations; forward-fix or deploy a recovery version
retaining nested reads/starts. Never reclaim names or rewrite collected data.

Decision: `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md`.

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
