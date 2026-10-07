# Plan: Shared seller forms (Teams plan review, slice 11)

## Status

Completed 2026-10-07. Migration applied to the live database, then committed and pushed to main, all with owner authorization in chat. Deployment not verified here. Written 2026-10-07 by Claude Opus 5.5 on main at `a821a12`. The owner confirmed the five settled points in chat on 2026-10-07 ("points confirmed") and added scope in the same message: a way to delete a seller form, on every plan, not only Teams (see "Form delete"). All six steps are done (see Progress). The migration needs its own separate authorization before it is run; no commit or push without the owner's say-so.

## Objective

Let a member of a Teams workspace share a seller form with the workspace, following the five product rules in `.ai/decisions/2026-10-07-shared-seller-forms.md`: every member can use a shared form; only its creator and workspace admins can change it; it outlives its creator's membership; it counts against the workspace; submissions go to the request's owner.

## Background

Parent plan: `.ai/plans/2026-10-07-teams-plan-review.md` (slice 11 of 11, flags [S] schema and [R] roles; slices 1 to 10 are done). Builds on `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md`, `.ai/decisions/2026-10-02-saved-form-workspace-boundary.md` and slice 10's hand-over (`removeOrganizationMemberWithHandover`).

## Verified Facts

Read in code on 2026-10-07.

- A form is an `intake_links` row keyed by creator `account_id` and fixed `organization_id` (`schema.sql:169-192`). Every reader and writer filters on both: `listSellerForms`, `getSellerForm` (`lib/neon/queries/intake-links.ts:165-180`), `ownedForm` (`lib/seller-forms/server.ts:250-258`), `save_seller_form`, `set_default_seller_form`, `ensure_seller_form` (`schema.sql:717-847`).
- A form's address belongs to its creator. `seller_form_link_namespaces` is one row per (creator, workspace), cannot be updated, and its `root_form_id` owns the base name through that form's rows in `intake_link_aliases`. `seller_form_suffix_aliases` binds each ending to a form of the same creator and workspace; both guards reject anything else (`schema.sql:582-641`). The bare link opens the default form of the namespace's (creator, workspace) (`getIntakeLinkByBaseSlug`); a nested link resolves through the root form's aliases (`getIntakeLinkBySuffix`).
- `intake_links` has one default per (creator, workspace) and one referral identity per creator, both unique indexes (`schema.sql:529-533`). Any flat alias of a form is a referral code that credits `intake_links.account_id` (`lib/neon/queries/referral-credits.ts:89-95, 154-187, 300-306`).
- `validate_request_source_form` (`schema.sql:850-874`) refuses a request unless the form's `account_id` equals the request's `account_id`, the workspace matches, the form is active, and the form's creator is an active member of the workspace. So a teammate cannot create a request from someone else's form, and a departed creator's link stops.
- The public path (`lib/seller-forms/public.ts`, `lib/seller-forms/intake.ts:190-270`) creates the request under the form's `account_id` and checks draft resume against that account.
- The dashboard path (`app/api/requests/route.ts:148-150`) looks the form up with the caller's own account id.
- Submission emails go to the request's owner while they are a member, plus admins when the workspace setting is on or the owner has left (`app/api/seller/[token]/route.ts:801-836`). Nothing there reads the form.
- Allowance: `seller_form_allowance` returns 10 for Pro or a Teams workspace, else 1, counted per (creator, workspace) inside `ensure_seller_form` and `save_seller_form`; the TypeScript mirror is `lib/seller-forms/capabilities.ts`. The technical cap counts all of a creator's forms.
- `removeOrganizationMemberWithHandover` (`lib/neon/queries/organizations.ts:1114-1220`) locks the workspace row, moves requests and Branding Profiles to an admin, deletes the membership. Forms are untouched.
- Account closure (`lib/neon/queries/account-closure.ts:313-482`) moves requests and profiles by the transfer map, then runs `DELETE FROM intake_links WHERE organization_id = ANY(sole) OR account_id = id`. The accounts row itself is kept. Deleting a form cascades to its aliases, and deleting a root form cascades to the namespace and every ending in it.
- No application code deletes an accounts row (only `scripts/demo-seed.mjs`).
- There is no form delete anywhere in the product (`docs/saved-seller-forms.md`), although the decision record lists "deleting" among the things only creators and admins may do.

## Assumptions

- A Teams workspace's admin usually created the workspace, so their first form (their referral identity) lives in it and is the form they are most likely to share. Inferred from activation creating a workspace and form per account; not measured.
- Live data has no workspace with more than one member (aggregates of 2026-10-07 in the parent plan), so no existing form changes behavior on release.
- The migration will be applied before the application is pushed, as in slices 8 and earlier. The plan depends on it (the hand-over statement names the new column).

## Open points from the decision record, settled here (owner confirmed all five on 2026-10-07; point 5 was then replaced by "Form delete")

1. **Undoing sharing: allowed, with one condition.** The creator or an admin can stop sharing a form while its creator is still a member; it goes back to being the creator's personal form. Requests already created from it are not affected (they carry their own captured questions; the source check runs only when a request is created). Refused when the creator has left (the form would become a dead personal form of someone outside the workspace) or when the creator has no room left in their personal allowance.
2. **Who receives a shared form when its creator leaves, including an admin creator: the same person as in slice 10.** The named admin if one is given, otherwise the admin doing the removing, otherwise the longest-standing other admin. An admin who leaves by themselves always has another admin to hand to, because the last admin cannot leave. Requests, Branding Profiles and shared forms always go to the same person.
3. **Teams only.** Sharing a form needs the workspace to be on Teams at that moment. If Teams later stops, forms already shared stay shared and keep working (same as the existing downgrade rule: nothing is taken away, nothing new is allocated).

Two further points the code raised:

4. **A shared form keeps its address.** The link stays `/form/<creator's link name>/<ending>` for good, also after the creator leaves. The creator alone can rename their main link name and choose their default form; admins can rename a shared form's ending. Referral credit for sign-ups through that link name stays with the creator. Reason: moving the form to another person's address would break links already in email templates, and would move referral credit, which is money.
5. ~~No form delete is added.~~ Replaced by the owner on 2026-10-07: add delete, for every plan.

## Form delete (scope added by the owner on 2026-10-07)

Every plan gets "Delete form" on a seller form. The agent's design, to be shown to the owner when the screens are ready:

- **Changed by the owner on 2026-10-07 after review: deleting releases the form's link endings** so another form under the same link name can take them (see the decision record's Amendment). `delete_seller_form` removes the form's rows in `seller_form_suffix_aliases`, and `initialize_seller_form_links` no longer gives a deleted form an ending. The rest of the next point stands for the flat link name and referral code only.
- **Deleting hides the form for good and keeps its address reserved.** The row stays with `deleted_at` set. The form leaves every list and picker, stops counting toward the personal or workspace allowance, and its links show the same "not available" page as an unknown link. Its link name and endings are never given to another form, and a link name that is also a referral code keeps crediting its owner. This follows `.ai/decisions/2026-10-06-shared-seller-form-url-identity.md` (published names are permanent) and keeps referral credit, which is money, untouched. A true row delete was rejected because it cascades to the aliases, the namespace and every sibling ending.
- **The default form cannot be deleted.** The person makes another form the default first. This also means the last form cannot be deleted, so every workspace always has one.
- **Requests are not affected.** Sellers who already started keep their links, and finished requests keep their captured questions; a request only remembers which form it came from.
- **Who may delete:** the creator for a personal form; the creator, current owner or an admin for a shared form (decision rule 2).
- **No undo in the product.** The confirmation says so and says the link will stop working. The row can be restored by hand in the database if the owner ever needs it.
- The technical cap (50 per creator) keeps counting deleted rows, because it exists to bound stored rows and reserved names.
- Account closure keeps today's true delete for the closing person's own forms; the placeholder it leaves for a link name that still carries a shared form is a deleted row in this sense.

## Proposed Approach

### Storage boundary (durable; amend the decision record on approval)

Keep `intake_links.account_id` as what it already is for links: the creator and the owner of the address. Add one nullable column that says "shared, and currently owned by":

```sql
ALTER TABLE intake_links
    ADD COLUMN IF NOT EXISTS shared_owner_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    ADD CONSTRAINT intake_links_shared_needs_workspace
        CHECK (shared_owner_account_id IS NULL OR organization_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS intake_links_shared_workspace
    ON intake_links(organization_id) WHERE shared_owner_account_id IS NOT NULL;
```

- `NULL`: personal form, every rule as today.
- Set: shared. The value is the member who receives requests from the public link. It starts as the creator and is the only thing a hand-over changes.

The same migration adds `deleted_at TIMESTAMPTZ` with `CHECK (deleted_at IS NULL OR NOT is_default)`. Every reader that lists, counts, resolves a link to, or starts a request from a form ignores deleted rows; alias and referral-code lookups (`getIntakeLinkBySlug`, the referral queries) deliberately do not.

Rejected: moving `account_id` to the receiving admin. It collides with the per-person default and referral-identity indexes, moves referral credit, leaves the endings in a namespace whose guards require the old creator, and drops the form out of the bare link. Rejected: a workspace-level link name, which changes every shared form's address at the moment it is shared.

### Rules in SQL (new `migrations-seller-form-sharing-and-delete.sql`, mirrored in `schema.sql`)

Fifth file in the seller-form chain; it replaces `save_seller_form`, `ensure_seller_form` and `validate_request_source_form`, so it is rerun after any earlier file in the chain. Additive and safe under the currently deployed application: with no form shared, every function behaves as before.

- `seller_form_shared_allowance(p_org)`: 10 times the workspace's current member count when it is on Teams, else 0.
- Personal counts in `ensure_seller_form` and `save_seller_form` gain `AND shared_owner_account_id IS NULL`, so a shared form does not use its creator's allowance. The technical cap is unchanged.
- New `set_seller_form_shared(p_actor, p_org, p_id, p_revision, p_shared)`: returns the form; raises `SF409` on a stale revision, `SF402` when the relevant allowance is full, `SF403` when not permitted.
  - Share: actor is the creator and a member; workspace is on Teams; shared count below the shared allowance. Sets the owner to the creator, bumps the revision.
  - Unshare: actor is the creator, or an admin; the creator is still a member; the creator's personal count is below `seller_form_allowance`. Clears the owner, bumps the revision.
- `save_seller_form` (same 8 arguments, plus a compatible wrapper): the actor may edit a form that is theirs, or a shared form in `p_org` when the actor is its current owner or an admin there. A non-creator's `slug` key is refused. Namespace and ending work uses the form's creator, not the actor.
- Lock rule, replacing "serialize on the owner row": every form mutation locks the **creator's** accounts row and no other accounts row. The actor's standing (not banned, active, member, role) is read without a row lock. This keeps one lock per form scope and avoids two admins locking each other.
- `set_default_seller_form`: creator only, as today; refuses a deleted form.
- New `delete_seller_form(p_actor, p_org, p_id, p_revision)`: same permission as editing; raises `SF409` on a stale revision and `SF416` for the default form; sets `deleted_at`, pauses the form and bumps the revision. Deleted rows are excluded from the allowance counts, from `ensure_seller_form`'s choice of form, from `save_seller_form` and `set_seller_form_shared`, and are refused by `validate_request_source_form`.
- `validate_request_source_form`: for a shared form, require the same workspace, the request's account to be a current member, the form active, and the current owner to be an active member. The creator is not consulted. Personal forms keep today's check exactly.

### Server and API

- `lib/neon/queries/intake-links.ts`: `IntakeLink.shared_owner_account_id`; `listWorkspaceSellerForms(accountId, organizationId)` returning the caller's forms plus the workspace's shared forms with the owner's display name; `getUsableSellerForm` (own, or shared in the workspace); `setSellerFormShared`. `listSellerForms` and `getSellerForm` stay for callers that mean "mine".
- `lib/seller-forms/server.ts`: `sellerFormContext` also returns the caller's role in the active workspace. `usableForm` and `editableForm` beside `ownedForm`. `serializeSellerForm` adds `shared`, `isMine`, `canEdit`, `canShare`, `ownerName`; each form is serialized with its **creator's** link scope (one `getSellerFormLinkScope` call per distinct creator, bounded by the member count).
- `lib/seller-forms/public.ts`: for a shared form the scope's account is the current owner; for a personal form nothing changes. `lib/seller-forms/intake.ts` needs no change beyond that (it already uses the scope's account).
- `lib/seller-forms/capabilities.ts`: `usage` counts personal forms only; adds `sharing: { available, allowance, usage }` with plain messages.
- `lib/seller-forms/errors.ts`: map the new codes.
- Routes: `GET /api/seller-forms` (workspace list); `GET`/`PATCH /api/seller-forms/[id]` (`usableForm` to read, `editableForm` to change, `slug` refused for a non-creator); new `PUT /api/seller-forms/[id]/share` with `{ shared, revision }` validated by a Zod schema in `lib/validation/schemas.ts`; `POST /api/seller-forms` may duplicate from a usable form (the copy is personal); `[id]/default` and `/api/seller-form-link-base` stay creator-only; `POST /api/requests` resolves `formId` with `getUsableSellerForm`. The request is created under the caller, as today.
- Delete: `DELETE /api/seller-forms/[id]` with the revision, through `editableForm` and `deleteSellerForm`. Readers that must skip deleted rows: `listSellerForms`, `getSellerForm`, `getIntakeLinkByBaseSlug` (the default it picks), `getIntakeLinkBySuffix`, `getSellerFormLinkScope` (default and current endings; reserved endings stay listed so a name is not offered twice), `getBrandProfileFormCounts`, the closure snapshot's `has_seller_form`, the account export, and the form counts in `lib/neon/queries/admin-telemetry.ts` (checked when that step is reached). `getSellerFormCount` (technical cap) keeps counting them.
- Never trust a client-supplied role, owner or shared flag; all of it is resolved from the session and the database.

### Hand-over and closure

- `removeOrganizationMemberWithHandover`: a `moved_forms` step sets `shared_owner_account_id` to the recipient for shared forms the person owns in that workspace; those forms count toward "has something to hand over"; the result gains `formsMoved`. The person's personal forms are left as today.
- `app/api/organization/members/[accountId]/route.ts` and `components/settings/workspace-team.tsx`: report moved forms, and the leave and remove confirmations say shared forms stay with the workspace while personal ones stop.
- Account closure (`lib/neon/queries/account-closure.ts`, `lib/account/closure.ts`): the snapshot counts shared forms the person owns per workspace and includes them in `needsTransfer` and in the conflict check; the transfer step moves their owner; the delete step spares shared forms in workspaces that survive, and spares the root form of any of the person's link names that still carries a spared form. A spared root that is personal is reduced to a paused placeholder (default name, no heading, introduction or Branding Profile), because deleting it would delete the link name and every ending under it. The closure review screen names the forms that will stay.

### Screens

- `components/seller-forms/FormsWorkspace.tsx`, `FormCard.tsx`, `types.ts`: a "Shared with <workspace>" badge; a "Shared by your team" group for other people's shared forms with Copy link, Preview and Duplicate only, or the full menu for an admin; "Share with workspace" and "Stop sharing" in the card menu with the shared `ConfirmDialog`; on a non-Teams workspace the action leads to Billing with the "Upgrade" badge, per `.ai/decisions/2026-10-07-dashboard-ui-conventions.md`.
- `FormEditor.tsx` / `FormAvailability.tsx`: a sharing row in "Link and availability" that saves immediately like Pause; a read-only notice when a member opens a shared form they cannot change; link name and default controls hidden for a non-creator.
- `FormShareSelector.tsx`, `app/dashboard/requests/new/page.tsx`: shared forms appear in the picker, labelled.
- `app/test-fixtures/seller-forms/page.tsx`: member, creator and admin states for the browser spec.
- "Delete form" at the bottom of every card's menu and in the editor's "Link and availability" section, on every plan, with a `ConfirmDialog` that says the link stops working and that this cannot be undone. On the default form the action is shown disabled with "Make another form the default first".
- Wording for non-technical users, no em dashes.

### Order of work (each step validated before the next; no commit, push or migration without the owner's say-so)

1. Migration file and `schema.sql`, with storage and native PostgreSQL tests. Stop and ask the owner to authorize applying it.
2. Queries, permissions, routes, public scope and request creation, with route and unit tests.
3. Hand-over on leave and removal.
4. Account closure.
5. Screens, fixture and browser spec.
6. `docs/saved-seller-forms.md`, the decision record amendment, parent plan outcome, `.ai/CURRENT.md`.

Steps 1 to 4 are safe to ship before step 5: nothing can be shared until a screen offers it.

## Files or Areas Expected to Change

New: `migrations-seller-form-sharing-and-delete.sql` (called `migrations-shared-seller-forms.sql` in the first draft of this plan), `app/api/seller-forms/[id]/share/route.ts`, `tests/unit/shared-seller-forms-*.test.ts(x)`.

Changed: `schema.sql`; `lib/neon/queries/{intake-links,organizations,account-closure,account-data,index}.ts`; `lib/seller-forms/{server,public,capabilities,errors}.ts`; `lib/validation/schemas.ts`; `lib/account/closure.ts`; `app/api/seller-forms/route.ts`, `app/api/seller-forms/[id]/route.ts`, `app/api/requests/route.ts`, `app/api/organization/members/[accountId]/route.ts`; `components/seller-forms/{FormsWorkspace,FormCard,FormEditor,FormAvailability,FormShareSelector,types}.tsx`; `components/settings/workspace-team.tsx`; the account-closure review component; `app/dashboard/requests/new/page.tsx`; `app/test-fixtures/seller-forms/page.tsx`; tests `tests/unit/{seller-forms-native,seller-forms-storage,seller-forms-commercial,seller-forms-route,organization-member-removal,account-closure-query,account-closure,intake-start-route,intake-public-route}.test.ts`, `tests/saved-seller-forms.spec.ts`, `tests/settings.spec.ts`; `docs/saved-seller-forms.md`; `.ai/decisions/2026-10-07-shared-seller-forms.md`.

Not touched: Stripe, prices, seats, referral credit rules, the seller submission route, the PDF builder, link resolution queries, marketing pages.

## Data, API, Schema, or External-State Impact

- Schema: one nullable column, one check, one partial index, two new functions, three replaced functions. No backfill; no existing row changes.
- API: `GET /api/seller-forms` returns more forms and new fields (existing fields keep their meaning); one new route; `POST /api/requests` accepts a teammate's shared form.
- Roles: members gain use of shared forms; admins gain edit, pause, ending rename and unshare on shared forms they did not create.
- Account export keeps listing forms the person created and gains a `shared` field.
- No billing, Stripe or email change.

## Risks and Edge Cases

- **Closure is the riskiest step.** A wrong delete condition either removes a team's link or keeps a closed person's form text. Covered by query tests for: creator still a member, creator already gone, shared root, personal root with a shared sibling, sole-member workspace.
- Lock order: the hand-over statement locks the workspace, then form rows, then the leaver's accounts row, while a form save locks the creator's accounts row and then the form. A save by or for the leaving person at the same instant can deadlock; PostgreSQL ends one side with an error and the caller can retry. Accepted as rare; to be exercised in the native suite if it can be done cheaply.
- A shared form whose owner is banned or mid-closure stops accepting sellers until an admin is the owner. Fail closed, as today.
- The creator's default form, if shared, keeps the bare link working after they leave; nobody can then change which form that bare link opens. Acceptable; noted in the docs.
- The technical cap still counts shared forms against their creator, including after they leave. Minor, unchanged on purpose.
- Members times ten is read at the moment of sharing; a workspace that later shrinks keeps its shared forms.
- A member duplicating a shared form copies its questions into a personal form. Intended.
- `ON DELETE RESTRICT` on the new column would block a hard delete of an account that owns a shared form. The product never hard-deletes accounts; `scripts/demo-seed.mjs` does, on demo accounts.

## Validation Plan

Node 20.19.0, tools as in `.ai/CURRENT.md`.

- Focused Vitest per step, then full Vitest with `SAVED_FORMS_TEST_PG_BIN` set (native suite on, no skips).
- Native PostgreSQL: share and unshare under both allowances, concurrent shares at the workspace limit, an admin's edit and ending rename, a teammate's request from a shared form, a non-member refused, hand-over keeps the nested and bare links accepting sellers, personal forms unchanged.
- The migration applied twice to a throwaway local cluster loaded with `schema.sql` and the chain, checking it is rerunnable and that no existing row changes.
- `npm exec tsc -- --noEmit`; ESLint on changed files; `tests/saved-seller-forms.spec.ts` and `tests/settings.spec.ts` on the three device profiles with service keys blanked in the process; `npm run build`; `npm run security:scan`; `git diff --check`; desktop and phone screenshots of the new states.
- Live migration, only when authorized: psql 17, stop on error, transaction-local lock and statement timeouts, aggregates only before and after (form count, fingerprint of existing columns unchanged, column and functions present, zero forms shared).
- Will not be verified here: a signed-in browser, the hosted site, a real second member.

## Acceptance Criteria

1. A creator in a Teams workspace can share a form and stop sharing it; neither changes its address.
2. Every member sees shared forms, can copy their links and can create a request from one; the request is theirs.
3. A member who is neither creator, owner nor admin cannot edit, pause, rename or unshare a shared form, through the screens or the API.
4. An admin can edit, pause, resume, rename the ending of, and unshare any shared form in the workspace.
5. When a creator leaves, is removed or closes their account, their shared forms pass to the same admin as their requests, and both the nested and (if it was their default) the bare link keep accepting sellers. Their personal forms behave as today.
6. A shared form does not count toward its creator's ten; the workspace can hold ten shared forms per member; both limits are enforced in the database under concurrency.
7. A seller arriving through a shared link creates a request owned by the form's current owner; submission emails follow the existing rule with no new setting.
8. A workspace not on Teams cannot share; forms shared earlier keep working after Teams stops.
9. With nothing shared, every existing seller-form test passes unchanged.
10. Docs, decision record, parent plan and `.ai/CURRENT.md` are current.
11. On any plan, a form that is not the default can be deleted by someone allowed to change it. Afterwards it is in no list or picker, its links show "not available", it no longer counts toward an allowance, no other form can take its link name or ending, requests made from it are unchanged, and a referral code that was its link name still works.

## Progress

| Step | State |
|---|---|
| 1. Migration, `schema.sql`, storage and native tests | Done 2026-10-07, uncommitted. **Migration not applied anywhere live; awaiting owner authorization.** |
| 2. Queries, permissions, routes, public scope, request creation | Done 2026-10-07, uncommitted |
| 3. Hand-over on leave and removal | Done 2026-10-07, uncommitted |
| 4. Account closure | Done 2026-10-07, uncommitted |
| 5. Screens, fixture, browser spec | Done 2026-10-07, uncommitted |
| 6. Docs, parent plan outcome | Done 2026-10-07, uncommitted |

### Step 1 outcome (2026-10-07)

- New `migrations-seller-form-sharing-and-delete.sql`: columns `shared_owner_account_id` and `deleted_at` with their checks, a partial index, new `seller_form_shared_allowance`, `seller_form_can_change`, `set_seller_form_shared`, `delete_seller_form`, and replaced `ensure_seller_form` (5 arguments), `save_seller_form` (8 arguments), `set_default_seller_form`, `validate_request_source_form`. `schema.sql` carries the same function text (copied by script, not retyped) and the columns in `CREATE TABLE intake_links`.
- New SQLSTATE codes for step 2 to map in `lib/seller-forms/errors.ts`: `SF411` not allowed (share by a non-creator, unshare by a plain member, link name change by a non-creator), `SF412` Teams needed, `SF413` workspace shared allowance full, `SF414` creator has left (cannot unshare), `SF415` creator's personal allowance full (cannot unshare), `SF416` the default form cannot be deleted. A caller with no right to the form gets no row back (routes answer 404), as before.
- Deviation from the first draft: `set_seller_form_shared` locks the workspace row first, then the creator's accounts row, so two creators cannot both take the last shared place. Deleting a form also clears its shared owner.
- Tests: new `tests/unit/shared-seller-forms-storage.test.ts` (13 cases on embedded PostgreSQL: rerunnable with no row change, who may share, edit, rename, unshare and delete, requests through a shared form, owner instead of creator after leaving, both allowances, Teams stopping, names stay reserved after delete); a native two-connection case in `tests/unit/seller-forms-native.test.ts` (two creators at the workspace limit, the second gets `SF413`); the new file appended to the migration chain in that file and in `tests/unit/seller-form-base-links-storage.test.ts`.
- Validation (Node 20.19.0): full Vitest with native PostgreSQL 221 files / 1660 passed; `tsc` clean; security scan and `git diff --check` passed. No lint run (no application TypeScript changed). Nothing live was read or written.
- Not done in this step: the hand-over versus form-save deadlock was not exercised; no application code reads the new columns yet, so nothing can be shared or deleted from the product.

### Step 2 outcome (2026-10-07)

- Queries (`lib/neon/queries/intake-links.ts`): new `listWorkspaceSellerForms`, `getUsableSellerForm`, `getSharedSellerFormUsage`, `setSellerFormShared`, `deleteSellerForm`. `listSellerForms`, `getSellerForm`, `getIntakeLinkByBaseSlug`, `getIntakeLinkBySuffix` and the default in `getSellerFormLinkScope` skip deleted forms; `getIntakeLinkBySlug` (referral codes) and the technical-cap count do not. `getBrandProfileFormCounts` skips deleted forms.
- Permissions (`lib/seller-forms/server.ts`): the context carries `isAdmin` (read from the membership row) and `isTeams`; `canChangeForm`, `usableForm`, `editableForm`, `creatorFormLinks`; `serializeSellerForm` takes an optional viewer and returns `shared`, `isMine`, `canEdit`, `canShare`, `canDelete`, `ownerName`. `publicFormScope` resolves a shared form through its current owner.
- Routes: `GET /api/seller-forms` returns the caller's forms plus the workspace's shared forms, each with its creator's link, and `capabilities.sharing`; `GET/PATCH /api/seller-forms/[id]` use usable and editable lookups and refuse a link name change by a non-creator; new `DELETE /api/seller-forms/[id]` (`{ revision }`) and `PUT /api/seller-forms/[id]/share` (`{ shared, revision }`); `POST /api/seller-forms` can duplicate a shared form into a personal one; `POST /api/requests` accepts a teammate's shared form. Make default and the main link name stay creator-only.
- Deviation: the delete error code is `SF416`, not `SF422` (`SF422` was already taken by an older base-link error). Mapped codes: `FORM_NOT_ALLOWED`, `FORM_SHARING_NEEDS_TEAMS`, `FORM_SHARED_ALLOWANCE_REACHED`, `FORM_CREATOR_LEFT`, `FORM_CREATOR_ALLOWANCE_REACHED`, `FORM_IS_DEFAULT`.
- Not changed yet (later steps): the closure snapshot's `has_seller_form`, the account export, the admin telemetry form counts, and every screen. Until step 5 nothing in the product offers share or delete.
- Tests: route cases appended to `tests/unit/seller-forms-route.test.ts`; query-module cases on embedded PostgreSQL in `tests/unit/shared-seller-forms-storage.test.ts`; mocks updated in `tests/unit/{intake-link-route,requests-route-advanced-gating}.test.ts`.
- Validation (Node 20.19.0): full Vitest with native PostgreSQL 221 files / 1673 passed; `tsc` clean; ESLint on changed TypeScript clean.

### Step 3 outcome (2026-10-07)

- `removeOrganizationMemberWithHandover` moves the owner of the person's shared forms in that workspace to the same recipient as their requests and Branding Profiles, counts them as something to hand over, and returns `formsMoved`. The form's creator, link and revision do not change. `DELETE /api/organization/members/[accountId]` returns `formsMoved`; Workspace & Team says what happens to shared and to personal forms in the leave and remove confirmations and reports moved forms.
- Tests: the real statement run on embedded PostgreSQL (shared form passes to the removing admin, its nested link and public scope keep working, the personal form stops, the last admin is refused with nothing changed); copy and shape assertions updated in `tests/unit/{organization-member-removal,workspace-leave}.test.ts(x)`.
- Validation: run with step 4 (below). `tests/settings.spec.ts` has not been rerun since the copy change; it is due in step 5.
- Not exercised: the hand-over racing a form save (see Risks).

### Step 4 outcome (2026-10-07)

- `removeAccountClosureData`: shared forms the person owns count as something that needs a receiving admin (same guard as requests and Branding Profiles); their owner moves by the transfer map; the delete of the person's forms spares forms shared with a workspace that survives and the form that owns the link name they hang under; that spared link-name form, when it is not itself shared, is reduced to a deleted, paused, non-default placeholder named "My seller form" with no heading, introduction or Branding Profile. The second `DELETE FROM intake_links WHERE account_id` in the transaction is replaced by that placeholder update.
- Snapshot and review: `owned_shared_form_count` per workspace, `ownedSharedFormCount` and `needsTransfer` in the review, `has_seller_form` ignores deleted forms; the closure review screen names shared forms that move and says personal forms are deleted.
- Also in this step: the account export keeps listing every form the person created and adds `shared_with_workspace` and `deleted_at`; Admin telemetry form counts skip deleted forms.
- Tests: the real transaction on embedded PostgreSQL in `tests/unit/shared-seller-forms-storage.test.ts` (a missing admin choice rolls everything back; the shared form keeps its nested link, passes to the chosen admin and accepts requests; the placeholder holds none of the person's text; a person who shared nothing loses every form and link name as before), with the test's database mock made lazy and transactional; statement assertions in `tests/unit/account-closure-query.test.ts`; `tests/unit/admin-telemetry.test.ts` table updated.
- Validation (Node 20.19.0): full Vitest with native PostgreSQL 221 files / 1678 passed (after the telemetry test's table was updated); `tsc` clean; ESLint on changed TypeScript clean.
- New risk found, not acted on, for the owner: a closed person's link names that stay behind for team forms still work as referral codes, because referral lookups do not check whether the referrer's account is closed. Before this step those names were deleted on closure. Closing it would mean a referrer-state check in `lib/neon/queries/referral-credits.ts`, which changes referral rules and needs the owner's word.
- Known behavior: if the closing person's default form was personal, their bare link afterwards opens the oldest shared form under that name instead of nothing.

### Step 5 and 6 outcome (2026-10-07)

- Seller forms page: the person's own forms as before, then "Shared by your team" for forms teammates shared. Card menu gains "Share with workspace" (leads to Billing with a "Teams" badge when the workspace is not on Teams), "Stop sharing" and "Delete form" (shown disabled with the reason on a default form), each behind the shared confirm dialog. A member's card for a teammate's form has Copy link, View, Preview and "Copy to my forms" only. The usage line says shared forms do not count and shows the workspace's shared total.
- Form editor: a sharing row and a delete row in "Link and availability"; a teammate's form opens with an explanation and cannot be saved, paused or deleted; the link ending shows the creator's link name. Request and share pickers label teammates' forms "(shared by your team)". `isDefault` in the API now means the viewer's own default.
- New `components/seller-forms/FormSharing.tsx`; changed `FormCard`, `FormsWorkspace`, `FormEditor`, `FormShareSelector`, `types.ts`, `app/dashboard/requests/new/page.tsx`. `FormAvailability.tsx` and the fixture page did not need changes.
- Docs: `docs/saved-seller-forms.md` has "Sharing a form with a workspace", "Deleting a form" and the fifth migration.
- Validation (Node 20.19.0, service keys blanked in the process): `tests/saved-seller-forms.spec.ts`, `tests/settings.spec.ts` and `tests/intake-link.spec.ts` 108/108 on Desktop Chrome, Mobile Safari and Mobile Chrome, including four new browser tests; desktop and phone screenshots of the team list and the delete dialog reviewed; full Vitest with native PostgreSQL 221 files / 1678 passed; `tsc`, ESLint on changed files, security scan and `git diff --check` passed; production build result recorded in `.ai/CURRENT.md`.
- Deviation: the settings spec's mocked form list had to gain the new fields. A page loaded from the new application against an API that predates it would show an empty list until reload; the two ship together.
- Not verified: a signed-in browser, a real second member, dark mode, the hosted site. The migration has not been applied to any live database.
- Not done, by choice: no picker for which admin receives a leaving person's forms (the route accepts `transferTo`); no "restore deleted form" screen; marketing pages do not mention sharing yet.

### Release (2026-10-07)

- Owner in chat: approved the migration, commit and push, and changed one point of the delete design: a deleted form must not block its link ending forever. Implemented before release: `delete_seller_form` removes the form's endings and `initialize_seller_form_links` (now also replaced by this migration) never gives a deleted form an ending; tests, dialog and editor wording, docs and the decision record updated. Full Vitest with native PostgreSQL 221 files / 1678 passed afterwards; `tsc` and ESLint clean.
- Migration: Applied to the configured Neon database on 2026-10-07 with owner authorization in chat (psql 17.11, stop on error, 10s lock and 180s statement timeouts). Aggregates only: 137 forms, 274 link endings, 136 link names, 138 flat aliases and 982 requests before and after; fingerprints of the form rows (ignoring the two new columns) and of the endings identical; both columns, both checks, the index, the four new functions and the replaced writer, validator and ending allocator present; zero forms shared or deleted.
- **No required work remains.** Owner checks after deploy: share a form on the test Teams workspace, open its link signed out, delete a spare form and reuse its ending.

## Handoff Notes

- Released; see "Release". Still for the owner to decide: the referral-code note under "Step 4 outcome".
- Optional, after release, needs the owner's word: say on the pricing pages that seller forms can be shared; a picker for which admin receives a leaving person's work.
