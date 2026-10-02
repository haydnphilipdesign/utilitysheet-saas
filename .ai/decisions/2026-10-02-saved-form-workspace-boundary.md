# Saved forms stay in a fixed workspace

- Date: 2026-10-02.
- Status: Accepted product boundary; implemented locally, live migration/rollout unapproved.
- Owner: product owner, explicitly selected in planning discussion.
- Plan: `../plans/2026-10-02-saved-seller-forms.md`.

## Context

UtilitySheet is planning named saved seller forms, each with a reusable link,
for different transaction workflows. Existing intake links belong to an account
and resolve the owner's active organization at visit/start time. Switching the
dashboard workspace can therefore change the destination and branding context
of an already-shared link.

## Decision

Each saved form stays attached to its creation workspace. A personal scope is
explicit; it must not mean following the active workspace. Switching workspaces
does not reroute the form's new submissions. Public start and metadata must
resolve branding, membership and applicable entitlement context against that
fixed destination on the server.

## Rationale and alternatives

Stable links embedded in listing/closing workflows need predictable destinations.
Continuing to follow the owner's active workspace was rejected by the owner.
Automatic transfers on workspace switching are not an acceptable substitute.

## Consequences

Existing links need a reviewed backfill that preserves URLs and pins their
current valid destination; invalid membership must be resolved explicitly.
Existing requests are not moved. Lost membership or a missing organization must
make new intake unavailable rather than silently reroute it. Organization deletion
must not convert a form into personal scope through a SET NULL foreign key.

This decision does not authorize a live migration. It does not decide pricing,
team-wide edit permissions, ownership transfer, or all implementation details.
The plan recommends creator-owned forms within the fixed workspace for v1;
shared team form management remains outside that first release.
