# Base link follows the default form

- Date: 2026-10-06. Author/implementer: Claude Opus 5.5. Baseline: `main` at `46a5c03`, clean worktree.
- Status: **Completed (2026-10-06).** Implemented, validated, migration applied to Neon, committed and pushed to main with the owner's authorization. Hosted deployment confirmation and smoke checks remain owner checks.
- Supersedes one rule of `2026-10-06-shared-seller-form-base-links.md` and its decision record: the bare base link no longer stays pinned to the first base form.
- Decision record: `../decisions/2026-10-06-shared-seller-form-url-identity.md` (amended by this task).

## Owner decision (2026-10-06, in chat)

Asked whether the bare link should stay pinned or follow the default, the owner chose **follows the default**, knowing that it reverses the pinning rule and that "Make default" will change where already shared bare links go.

## Contract

1. `/i/<base>` (and every earlier base name) opens the workspace's **default** form. "Make default" is the only way to change it, and the dashboard confirms before doing so.
2. **Every** form, including the one that owns the base name, has its own permanent ending. `/i/<base>/<ending>` always opens that exact form, whether or not it is the default.
3. Canonical share link: the default form shares the bare link; every other form shares base plus ending. The default's own ending link also works and is shown as a secondary address.
4. Unchanged: one base per creator and fixed workspace, endings and base names reserved permanently, legacy flat links of non-base-owner forms stay bound to their form, referral identity, request snapshots, capability tokens, paid gating for customizing a base or ending, allowances.
5. A paused default makes the bare link unavailable; other active forms still open from their endings.

## Verified facts

- `seller_form_link_namespaces.root_form_id` is immutable and owns the base slug and its flat aliases. It stays as the storage owner of the base name only; it no longer decides the destination.
- `guard_seller_form_suffix_alias`, `initialize_seller_form_links` and `save_seller_form` (SF422) each exclude the root form from having an ending. All three must change.
- `set_default_seller_form` needs no change once every form has an ending.
- `getIntakeLinkBySlug` is also the referral-code lookup (`app/(marketing)/from-a-closing/page.tsx`); it must keep returning the alias owner. Bare-link resolution gets its own query.
- Legacy resume cookies named after a base slug were trusted without an ownership check because the alias owner was the target. That shortcut is no longer valid.

## Changes

- New `migrations-seller-form-default-base-link.sql`, mirrored in `schema.sql`: allow endings on the root form, give every root an opaque ending (rerunnable backfill), remove SF422 from the writer. Additive and safe under the currently deployed application, which never sends an ending for the root form. **Apply before deploying the new application.**
- `migrations-seller-form-base-links.sql`: header note and one relaxed post-check so that rerunning old then new stays clean. No behavior change for the database it was already applied to.
- `lib/neon/queries/intake-links.ts`: `getIntakeLinkByBaseSlug` (bare link to default form), scope query returns the default form.
- `lib/seller-forms/{links,server,intake,errors}.ts`: canonical path by default form, `endingUrl`, drop `isBaseForm` and the root-ending rejection, verify legacy cookie ownership.
- `components/seller-forms/`: ending field for every form, default-follows copy, confirmation on Make default, secondary address on the default card.
- Tests: storage, native, helper, route, intake route, browser spec. Docs: `docs/saved-seller-forms.md`, decision record.

## Acceptance and validation

- Bare link and old base names open the default after a default switch; each ending keeps opening its own form; referral lookup still returns the alias owner.
- Root form can rename its ending; collisions and stale revisions still fail atomically.
- Migration rerunnable, preserves all existing identities, adds exactly one current ending per root.
- A legacy cookie resumes only a request of the resolved form.
- Focused Vitest (PGlite storage, native PostgreSQL if the local binary is still present, routes, helpers), `tsc`, ESLint on changed files, full Vitest, saved-form and intake Playwright specs, build if time allows.

## Release boundary

No live migration, commit, push or deploy is authorized by this plan. Each needs the owner's explicit go-ahead.

## Outcome (2026-10-06)

Implemented as planned. Notes and deviations:

- `isBaseForm` was removed from the serialized form; `endingUrl` was added. The "Base link" card badge is gone because Default now carries that meaning.
- Every existing base owner gets an opaque `form-<id-derived>` ending in the backfill (eager, not lazy), so no form is ever without its own address.
- `migrations-seller-form-base-links.sql` was edited in two small ways: a header note and removal of one post-check condition that forbade an ending on the base owner. Nothing it already did to the live database changes. Rerunning it reinstalls the earlier writers, so the second file must always follow it.
- SF422 is no longer raised by the current writers; its mapping stays only for a database that has not had the second migration.
- Legacy slug-named resume cookies are now always alias-checked against the resolved form (one bounded query, only when such cookies are present).

Validation on Node 20.19.0: full Vitest with native PostgreSQL enabled, 202 files / 1421 tests passed, no skips. Saved-form and intake Playwright specs on Desktop Chrome, Mobile Safari and Mobile Chrome: 41 of 42 passed in the full run; the one failure (an unrelated new-request test on Mobile Chrome, timing under parallel load) passed 6 of 6 on rerun. `tsc`, ESLint on changed files, production build (external services blanked by process-only variables), tracked security scan, new-file sensitive-pattern check and `git diff --check` passed.

Authorized release (2026-10-06): the migration was applied to the configured Neon database (both transactions committed). 137 forms now each have one current ending (136 added for base owners); forms, flat aliases, requests and the pre-existing ending are unchanged by count and whole-row fingerprint. One scope has a default that differs from its base owner, so its bare link changes destination when the application deploys. Committed and pushed to main.

Not done: authenticated check in a real browser session, confirmation of the hosted deployment, hosted smoke checks.
