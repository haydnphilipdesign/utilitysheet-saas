# Saved form commercial policy

- Date: 2026-10-02. Status: Accepted by product owner; implemented and validated locally; rollout disabled.
- Owner approved the full pricing recommendation in the planning/review chat.
- Plan: `../plans/2026-10-02-saved-seller-forms.md`.

## Decision

- Free: one customizable form per creator per workspace (existing creator-owned model).
- Pro: up to ten forms per creator per workspace.
- Teams: up to ten forms per member in that Team workspace; no pooled/shared template library is implied.
- Existing prices remain unchanged: Pro $9/month; Teams $7/seat/month with existing minimum seats. No new SKU, paid add-on, or Stripe price change.
- Entitlements are resolved server-side from the relevant fixed workspace and existing account/Team plan rules. Switching the active workspace must not change a published form's destination or use an unrelated Team subscription to unlock it.
- Free retains name, seller introduction, preview, and existing free question controls. Existing paid branding/custom-slug/handoff restrictions remain.
- Show New form and Duplicate on Free with a Pro indicator and contextual upgrade explanation when the commercial allowance prevents creation. Do not paywall existing-form customization or preview. Distinguish commercial-limit messages from pilot unavailability and technical-cap errors.
- On downgrade, retain forms, URLs and configurations; allow editing, pausing/reactivating and incoming submissions under existing Free submission and paid-field rules. Prevent creation/duplication when at or above the current allowance. Re-upgrade restores paid behavior without recreating forms.

## Rationale and consequences

One form lets a free customer adapt UtilitySheet to their workflow. Multiple saved workflows add repeatable convenience to Pro/Teams. Ten is a launch hypothesis to evaluate after roughly 60–90 days, not a researched optimum. Avoid a price increase until adoption and conversion provide evidence.

Retaining working links after downgrade is intentional, even when it retains multiple forms for a former paid customer. Do not delete, pause or relabel existing forms automatically to enforce the lower creation allowance. Count all saved forms, including paused forms, when checking creation; pausing does not free a slot. V1 users can edit/reuse forms; hard deletion remains out of scope.

The operational pilot gate and account-wide technical abuse cap remain separate from commercial allowances. Every allocating path, including automatic workspace initialization, needs explicit treatment and atomic count enforcement. A first form in another workspace is commercially allowed under this policy; this does not authorize bypassing rollout restrictions or the technical cap. Existing form reads/edits and legitimate initial provisioning must keep working. R1's correction must reflect this distinction rather than impose one commercial form across the whole account.

## Required implementation

Centralize scoped commercial capability/count resolution; enforce it atomically alongside the operational controls for create/duplicate/ensure. Return allowance/usage and a clear denial reason to the UI. Update creation affordances, downgrade messaging, pricing/marketing comparison copy and maintained docs. Test Free 1→2, paid 10→11, concurrent allocation, separate member/workspace counts, pause counting, downgrade retention, re-upgrade and forged/cross-workspace entitlement inputs.

At initial approval, this record changed no code, migration, billing configuration or production rollout. The authorized correction pass subsequently implemented the policy as recorded below; no other chat was messaged.


## Implementation evidence

Implemented in the correction pass: SQL `seller_form_allowance` and atomic
allocation writers, server capability/count/reason responses, Free Pro creation
actions, downgrade retention, fixed-scope entitlement tests and updated unchanged
price comparison copy. Section 8 and `.ai/CURRENT.md` record validation: 1,007
unit/integration tests, seven native concurrency cases and 21 browser checks.
No Stripe change or production rollout occurred. Pilot eligibility/technical cap,
actual CI and separately authorized rollout remain release work.

## Rollout selection (2026-10-02)

Owner selected availability to all users at launch instead of an account pilot, so existing paying users can immediately use additional forms. The explicit all-users operational setting retains the disabled-by-default master switch and technical abuse cap; it does not change commercial allowances or prices.
