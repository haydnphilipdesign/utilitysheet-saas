# Shared seller-form URL identity

- Date: 2026-10-06. Status: accepted, implemented/validated locally, and migration applied with explicit owner authorization. Application deployment remains pending separate authorization.
- Plan: `../plans/2026-10-06-shared-seller-form-base-links.md`.
- **Amended 2026-10-06** by `../plans/2026-10-06-base-link-follows-default.md`: the bare base link now follows the default form. See "Amendment" below; where it conflicts with the original text, the amendment wins.

## Context and decision

Saved forms previously had independent global custom slugs. The owner wants to
reuse a custom base across forms. Existing flat aliases already remain bound to
their original form; fixed-workspace routing and independent referral identity
are established product boundaries.

Use one creator/fixed-workspace namespace pinned to its initial base form
(existing default, otherwise deterministic oldest). The base string is that
form's current flat slug; every flat alias owned by the base form is also an
alias for the namespace. Other forms have scoped permanent suffix aliases and
one current ending. The base form shares a bare URL, other forms a nested URL.
Changing the dashboard default never repoints the base. Pausing the base does
not disable active siblings. No shared team ownership or account-wide moving
workspace routing is introduced.

Reserve every published alias to its original form until existing account
closure removes the form. Base/ending renames support historical combinations
without redirects. PostgreSQL mutations keep account-first locking, commercial
allocation controls and expected revisions. Pro/Teams customizations retain
the existing fixed-scope paid rules; downgrade keeps links and configuration.

## Amendment: the bare base link follows the default (2026-10-06)

Owner decision in chat, made with the trade-off stated: the bare link and every
earlier base name open the workspace's **default** form, so "Make default"
repoints links that were already shared. The dashboard confirms before the
switch. To keep every form addressable, every form (including the one that owns
the base name) has its own permanent ending; the default's ending link keeps
working beside the bare link.

`root_form_id` stays immutable but now only records which form owns the base
name (base renames, referral-code lookup). Unchanged: one namespace per creator
and fixed workspace, permanent reservation of base names and endings, legacy
flat links of other forms, referral identity, snapshots, capability tokens and
paid gating. Rejected again: an account-wide base and reassigning published
endings. Reason for the reversal: with a pinned base the owner had no way to
change what their main link opens, and "Default" versus "Base link" were two
concepts that looked like one.

Consequence: a second additive migration,
`migrations-seller-form-default-base-link.sql` (applied 2026-10-06 with owner
authorization), must be applied before the
application that resolves the bare link by default.

## Rationale and alternatives

Reusing the current flat-alias registry avoids conflicting global slug ownership
and preserves old links/referrals. A namespace attached to the changing default
was rejected because a published link would then open another configuration.
An account-wide namespace was rejected because different workspaces must not
share destinations implicitly. A separate global base registry was unnecessary
and would require coordination with already reserved flat slugs.

Existing internal names remain private; backfill uses opaque endings. Name-based
suggestions are shown to new-form users before save. Legacy flat `slug` APIs keep
their meaning; new suffix fields do not overwrite referral identity.

## Consequences and recovery

Public cookies and rate identities use the resolved form ID so aliases share
resume/limits without letting sibling forms cross-resume. Legacy cookies require
alias ownership and existing request-provenance checks. Nested APIs include an
explicit `forms` segment to avoid a suffix named `start` colliding with the old
flat start endpoint. Public seller/request/packet capability URLs do not change.

An additive migration with compatible insert triggers must finish before the new
readers/publishing UI deploy. Published nested links require retaining nested
resolvers during recovery; keep reservations and forward-fix rather than restore
an incompatible older application or reset identities. This decision authorizes
no production action, schema execution, billing change or communication.
