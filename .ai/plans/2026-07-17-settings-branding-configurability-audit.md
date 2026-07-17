# Settings and Branding Profile Configurability Audit

- Status: Completed
- Owner: OpenAI Codex
- Date: 2026-07-17
- Scope: Read-only product/UX audit of every Settings tab and the Branding Profiles list/editor. No product implementation, database action, deployment, commit, or push is authorized.

## Goal

Identify high-value settings or user-controlled inputs that are missing, confusingly placed, duplicated, or insufficiently explained, while grounding every recommendation in the current UI, code paths, plan gating, and packet/PDF behavior.

## Verified starting facts

- Settings is implemented in `app/dashboard/settings/page.tsx` with URL-addressable tabs.
- Branding Profiles has list, create, and edit routes and a tabbed editor in `components/branding/BrandProfileForm.tsx`.
- The production PDF system consumes Branding Profile identity, contact, display, buyer-step, welcome-message, and disclaimer values; plan gating changes which values are honored.
- The worktree is clean on `main`; the prior `.ai/CURRENT.md` described a completed fix that is no longer present as a diff.

## Phases

1. Inventory and trace
   - Enumerate every Settings and Branding Profile control, persistence path, entitlement, downstream consumer, and visible gap.
2. Live experience capture
   - Open each Settings tab plus Branding Profiles list/editor in the authenticated app, capture stable screenshots, and note interaction/accessibility behavior.
3. Opportunity analysis
   - Separate missing settings from settings that should remain product-owned; rank recommendations by user value, risk, and implementation complexity.
4. Handoff
   - Deliver a concise screenshot-backed audit with step health, prioritized additions, non-recommendations, evidence limits, and optional follow-up.

## Acceptance criteria

- Every Settings tab is reviewed individually.
- Branding Profiles list and every editor tab are reviewed.
- Recommendations distinguish account-level, reusable-link, notification, billing/referral, organization/team, request-level, and brand-profile-level ownership.
- Branding recommendations are checked against the authoritative PDF architecture and current plan gating.
- Findings are tied to current-run screenshots and code evidence; uncertain or backend-dependent ideas are labeled.
- `.ai/CURRENT.md` and this plan reflect the final status before the session ends.

## Validation

- Browser screenshots are inspected after capture.
- Current UI controls are cross-checked against schemas, API routes, Neon queries, tests, and downstream packet/email usage.
- No source behavior is changed during this audit.

## Outcome

- Highest-value Settings opportunities: expose reusable-link activation, default Branding Profile, and utility-category defaults; separate Workspace & Team from Billing; add workspace rename and pending-invite management; add team notification routing; and move the meter-number toggle into seller-form defaults.
- Highest-value Branding Profile opportunities: duplicate a profile, add structured professional/compliance fields, make profile usage/default impact visible, use the profile contact email as an optional reply-to, and preview/test every branded surface and message template.
- Immediate quality fixes: give notification switches and the Branding Profile overflow menu accessible names, communicate the dependency between submission emails and PDF attachments, and replace the generic delete confirmation with a branded explanation of fallback behavior.
- Product-owned constraints that should remain constrained: arbitrary PDF layout/fonts/title, separate Simple/Advanced brands, and free-form utility taxonomy customization.
- No product code, data, schema, billing state, deployment state, or production environment was changed.
