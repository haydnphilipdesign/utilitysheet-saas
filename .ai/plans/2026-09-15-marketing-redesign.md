# Marketing redesign

- Status: Completed locally 2026-09-15. No required implementation work remains.
- Owner: Codex. Branch main. User authorizes local review/redesign; no commit, push, deployment or production writes.
- Usage: check both windows at milestones; pause at 15% remaining with CURRENT and Opus 5 continuation prompt.

## Review and approach

Verified: eleven overlapping homepage sections, small video-first hero, repetitive seller-link copy, lengthy feature/pricing lists, simulated sheet with truncated text and placeholder actions. Supporting pages have text-heavy heroes without early CTAs. Existing screenshots/video and customer quotes are available. Conversion improvements are hypotheses, not measured outcomes.

Create an editorial property-handoff identity: warm paper, deep ink, restrained blue, serif display headings, generous spacing, prominent legible output. Simplify homepage into outcome, workflow/video, capabilities, customer evidence, pricing, FAQ, CTA. Improve shared shell and core page headings. Preserve legal content, auth behavior, metadata, plan destinations, attribution and real product capabilities. Scope app/(marketing), components/landing, components/marketing, targeted marketing-content copy and browser regression expectations. Scope CSS to marketing; no dashboard, billing, database or PDF renderer changes.

## Acceptance and validation

- First screen identifies audience, product, output, free plan and signup/demo path.
- Illustrative preview labeled; real video retained; no invented proof or capabilities.
- Cohesive supporting pages, responsive menu, visible focus, reduced motion, no overflow at 360/390/820/1440px.
- Preserve CTA destinations/tracking; verify FAQ and mobile navigation.
- Focused lint, TypeScript, relevant unit/browser checks, production build; inspect desktop/mobile screenshots.
- Final CURRENT handoff and completed plan.

## Coordination

Tracked tree clean initially. Preserve existing untracked September 10 plans, docs/audits and output. Acquisition strategy stays paused in its own plan. No concurrent implementation reported. Port 3000 belongs to Norma; use 3100. Environment may reference production: public marketing browsing only, no submissions/database actions.

## Outcome

Implemented planned scope plus a focused About rewrite using existing founder story/portraits and accessible header links/Escape support. Existing 86% claim removed after checking the baseline audit. No durable application architecture change. Auth, billing, seller/packet functionality and legal text preserved. Final lint, TypeScript and production build pass; 8 focused unit tests and 10 desktop/mobile Chrome browser tests pass (2 desktop-only skips). 14 routes checked at 360/820/1440px without overflow. Safari unavailable locally; optional compatibility follow-up. All acceptance criteria addressed within this validation limit. No measured conversion uplift claimed. Complete recovery/validation notes and optional release steps are in CURRENT.
