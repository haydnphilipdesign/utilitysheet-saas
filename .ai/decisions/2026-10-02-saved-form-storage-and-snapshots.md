# Saved form identity and snapshot storage

- Date: 2026-10-02. Status: implemented locally; live rollout unapproved.
- Plan: `../plans/2026-10-02-saved-seller-forms.md`.
- Related: `2026-10-02-saved-form-workspace-boundary.md`.

Saved forms extend `intake_links`: one creator-owned configuration and published
URL identity per row. Workspace membership does not grant editing another
creator's forms. This preserves the existing owner boundary and avoids adding
new team permissions. A separate preset/link association model was rejected
because v1 requires one reusable URL per saved form.

Defaults are per creator/workspace. Referral identity is explicitly global per
account and never follows the selected default. Published slugs are permanent
aliases for their original form until existing account-closure cleanup removes
the form. Alias collisions, including within one account, are rejected.

PostgreSQL functions serialize form creation/default switching/editing on the
account row and apply edits with an expected revision. This keeps one atomic
operation across Neon HTTP calls; separate read/unset/set writes would race.
Partial unique indexes enforce personal and workspace defaults separately.

New requests copy concrete question choices, seller introduction, form ID and
revision. The request INSERT trigger verifies scope/revision/membership and
captures the introduction under account key-share then form share locks.
Form writers and closure take the account lock first, avoiding reversed FK lock ordering. No form edit propagates to open
requests. Existing NULL question choices retain the existing inheritance rules.
Introduction/internal name are excluded from buyer packet/PDF construction.

Expand keeps `intake_links_account_id_key` until compatible writers are deployed
and old writers drain. `scope_initialized` distinguishes an intentionally
personal form from an old insert requiring a one-time destination backfill.
Restrictive organization FKs prevent accidental conversion to personal scope.

Commercial policy is approved in `2026-10-02-saved-form-commercial-policy.md`: Free 1 / Pro and Teams 10 per creator/fixed workspace, counting paused rows.
PostgreSQL resolves allowance from the account and fixed organization plan and checks scope count under the allocating account lock; requests never accept client entitlements.
Additional creation (including automatic allocation in another workspace) also requires an operational server
switch, explicit pilot account IDs and an owner-configured technical abuse cap.
The technical cap is account-wide and distinct from scoped commercial allowance.
First-ever provisioning and existing form reads remain allowed with the pilot gate off.
Downgrade retains configuration/URLs and edits, while blocking new allocation at
the lower allowance. Prices/SKUs are unchanged. After multiple forms exist, recovery must retain compatible
writers and all published aliases rather than restore account uniqueness.
