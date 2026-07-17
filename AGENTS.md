# Shared Repository Instructions

This file is the primary repository guidance for OpenAI Codex, Claude Code, and other coding agents. Apply any more-specific nested `AGENTS.md` if one is added later.

## Repository Orientation

UtilitySheet is an address-first SaaS product for transaction coordinators and real-estate agents. They create seller utility-information requests, sellers complete a public mobile flow without an account, and the product produces trackable web/PDF handoff packets.

This is a single Next.js application, not a monorepo.

- `app/(marketing)/`: public marketing pages.
- `app/dashboard/`: authenticated customer workspace.
- `app/(admin)/admin/`: privileged support and operations UI.
- `app/api/`: server routes for account, request, seller, packet, billing, growth, cron, and admin workflows.
- `app/s/[token]/`: per-request seller form; `app/i/[slug]/`: reusable seller intake; `app/packet/[token]/`: public completed packet.
- `components/`: shared UI grouped by product area.
- `lib/neon/`: Neon Postgres client and domain queries.
- `lib/stack/`: Stack Auth server/client setup.
- `lib/validation/schemas.ts`: primary request-payload validation.
- `lib/pdf/`, `lib/packet/`, and `lib/branding/`: packet data, rendering, and branding boundaries.
- `tests/unit/`: Vitest and Testing Library coverage; `tests/*.spec.ts`: Playwright flows.
- `schema.sql`: current schema snapshot; root `migrations-*.sql` files are focused deployable changes.

Use `PRD.md` for product intent, `ADMIN.md` for verified admin guardrails, `docs/pdf-system-reference.md` for the production PDF architecture, and `docs/ai-telemetry.md` for AI telemetry/privacy rules. Treat `docs/superpowers/` as historical design and implementation records; verify them against current code before reuse.

## Toolchain and Commands

The repository uses npm (`package-lock.json`). CI currently uses Node.js 20. Match that runtime unless the manifest or CI is deliberately updated.

```powershell
npm ci                         # clean dependency install
npm run dev                    # local Next.js server
npm run lint                   # ESLint
npm exec tsc -- --noEmit       # TypeScript type-check
npm test -- --run              # complete Vitest run, once
npm test -- path/to/test.ts    # focused Vitest file(s)
npm run test:e2e               # all Playwright projects; starts/reuses dev server
npm run test:e2e:desktop       # Desktop Chrome Playwright project
npm run test:e2e:mobile        # Mobile Safari and Mobile Chrome projects
npm run build                  # production Next.js build
npm run security:scan          # tracked-artifact and secret-pattern scan
```

There is no separate formatting script or dedicated `typecheck` package script. Do not invent one.

Local configuration belongs in ignored `.env*` files or the deployment environment. `.env.example` is a starting point, not a complete list of every optional feature flag. Verify variables at their call sites. Never print or copy real values into code, logs, plans, decisions, or handoffs.

## Repository Conventions and High-Risk Boundaries

- Keep request validation in Zod schemas and keep authorization on the server. Authenticated server paths use `stackServerApp`; never trust client-supplied account, organization, role, plan, or admin identity.
- Public seller/intake/packet routes use capability tokens and include rate-limit, privacy, and plan-gating behavior. Preserve read/write token boundaries and do not expose private request or seller data.
- Database access is centralized under `lib/neon/` and domain query modules. For an authorized schema change, create or update a focused root migration and mirror the final shape in `schema.sql`. Creating a migration does not authorize running it; confirm before any live database action.
- Stripe billing and referral-credit flows affect money and entitlements. Preserve webhook signature checks, idempotency, transaction boundaries, and server-side plan enforcement; use focused billing/referral tests.
- The production PDF builder is authoritative. Read `docs/pdf-system-reference.md` before modifying packet, PDF, or Branding Profile behavior, and preserve pagination, selectable text, Free/paid gating, and safe asset handling unless the task explicitly changes them.
- AI provider suggestion and telemetry code must degrade safely and follow the redaction rules in `docs/ai-telemetry.md`. Telemetry failures must not block the seller flow.
- Admin writes require a reason and audit logging; `ADMIN_WRITES_DISABLED=true` is the production safety catch. Impersonation remains explicitly gated.
- Generated or local-only artifacts include `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`, `next-env.d.ts`, screenshots, PDFs, HAR/trace files, `.superpowers/`, `.worktrees/`, and `.claude/settings.local.json`. Do not edit or commit them as source.
- `scripts/security/scan-artifacts.mjs` scans tracked files only. Before staging new files, also inspect them directly for secrets and sensitive data.
- No repository-wide branch, commit-message, or pull-request convention is currently enforced. Do not create commits, push, deploy, run migrations, or modify production data unless the user explicitly authorizes that action.

## Shared Coordination System (Required)

The files under `.ai/` are the durable cross-agent communication system for Claude Code, OpenAI Codex, and any other coding agent. Maintaining them is part of the task, not optional cleanup. Chat messages, private reasoning, and model-specific session history are not durable handoffs and must never be the only record of important repository state.

- `.ai/CURRENT.md` is the required concise handoff for the active or most recently paused/completed task.
- `.ai/plans/` contains implementation-ready plans when a task warrants one.
- `.ai/decisions/` contains only durable decisions future contributors need to understand.
- Keep these files factual and concise. Do not paste transcripts, raw logs, or a chronological diary into them.

### Required Startup Behavior

Before beginning substantial work, every agent must:

1. Read all applicable `AGENTS.md` files, including any more-specific nested instructions.
2. Read `.ai/CURRENT.md`.
3. Read the relevant active or approved plan under `.ai/plans/`, when one exists.
4. Inspect `git status` and the current diff, including untracked files relevant to the task.
5. Confirm from `.ai/CURRENT.md`, the worktree, and available coordination context whether another agent has active or unfinished work.
6. Identify concurrent editing warnings, owned files/areas, partially modified files, and scope conflicts before editing.
7. Verify that `.ai/CURRENT.md` and any active plan still match the actual repository state.

If `.ai/CURRENT.md` is stale, incomplete, contradictory, or inconsistent with the repository, correct it before relying on it or beginning the next substantial workstream. Treat existing uncommitted changes as intentional, preserve unrelated work, and never revert a change merely because another agent made it.

For a tiny, obvious, low-risk task without a formal plan, a full startup audit is not required, but the agent must still read `.ai/CURRENT.md` and inspect the relevant worktree state before modifying files.

### Required Updates During Work

For substantial, multi-step, risky, delegated, or long-running work, every agent must update `.ai/CURRENT.md` at meaningful milestones so another session can recover the current state. Required milestone examples include:

- planning completed or a plan approved;
- implementation begun;
- a major workstream completed;
- the approach, scope, or ownership materially changed;
- a blocker or important risk was discovered;
- validation failed in a meaningful way;
- work was paused or handed to another agent;
- the agent is about to end its session or enter another major workstream when interruption is reasonably possible.

Do not update `.ai/CURRENT.md` after every tool call, minor edit, or routine command. Update it when the durable task state changes.

### Implementation Workflow

- Understand current behavior and its callers before editing.
- Prefer the smallest coherent change that fully solves the approved task.
- Follow existing domain boundaries and patterns; do not create competing abstractions without first understanding the current ones.
- Do not silently change unrelated behavior or expand scope.
- Keep maintained documentation synchronized with meaningful behavior or workflow changes.
- Stop and report a conflict instead of guessing when a decision is irreversible, security-sensitive, financially consequential, or affects production data, schema, infrastructure, or deployment.
- Run validation proportional to risk: focused tests first, lint/type-check for affected TypeScript, broader Vitest/Playwright/build checks for cross-cutting or release-sensitive changes.

### Plan Creation and Maintenance

Create an implementation-ready plan under `.ai/plans/` before work that is substantial, multi-step, cross-cutting, architecturally meaningful, high-risk, difficult to reverse, affects several product areas, or requires coordination between agents. Tiny, obvious, low-risk changes do not need a separate plan.

Plans must be grounded in the current repository, distinguish verified facts from assumptions, define acceptance criteria and validation, identify expected files or areas, and have a current status. When a task has an active plan, the implementing agent must update it when:

- its status changes or implementation begins;
- the approved approach materially changes;
- scope is added or removed;
- an important risk, edge case, or blocker is discovered;
- acceptance criteria or required validation changes;
- the task is completed, superseded, blocked, abandoned, or otherwise stopped.

Do not rewrite a plan merely to make the original proposal appear correct. Record material deviations honestly. When a deviation affects the current handoff, update both the plan and `.ai/CURRENT.md`.

### Durable Decision Records

Create or update a record under `.ai/decisions/` only when a durable decision is made that future contributors or agents need to understand, such as an architectural boundary, technology/provider selection, data-model convention, authentication/authorization approach, long-term API behavior, durable product behavior, or a rejected alternative likely to be reconsidered.

Do not create a decision record for minor implementation details, routine refactors, temporary debugging choices, ordinary progress, or every file/function change.

When a durable decision is made, the responsible agent must:

1. Create or update the relevant decision record.
2. Record its context, decision, rationale, alternatives when relevant, and consequences.
3. Link or reference it from the active plan when relevant.
4. Mention it in `.ai/CURRENT.md`.

### Delegation and Cross-Agent Handoffs

Before Claude delegates implementation to Codex, Codex hands work back to Claude, or any agent transfers responsibility, the delegating agent must update the shared files before the receiving agent begins. A chat message alone is not a durable handoff.

The durable handoff must include, as applicable:

- approved task scope and intended outcome;
- relevant plan and current plan status;
- current implementation status;
- files already changed and files/areas expected to change;
- acceptance criteria and required validation;
- known risks, blockers, assumptions, and uncertainties;
- areas that must not be edited concurrently;
- the next concrete action.

The receiving agent must read the shared files, verify the handoff against the repository, correct stale or contradictory information, record that it has taken over the task, update `.ai/CURRENT.md` at later meaningful milestones, and leave a final handoff before stopping.

### Interruptions, Usage Limits, and Blockers

Whenever an agent can reasonably anticipate that a session may end, it should update `.ai/CURRENT.md` before continuing into another major workstream. If work stops because of a usage limit, tool failure, interruption, unresolved blocker, pause, or changed user direction, the agent must record before ending whenever possible:

- the last successfully completed step;
- the exact current state and current status;
- every partially modified file relevant to the task;
- commands already run and their meaningful results;
- commands and validation still required;
- the next concrete action;
- assumptions the next agent must verify;
- blockers, risks, and concurrent editing warnings.

This recovery state must be sufficient for a fresh Claude, Codex, or other agent session to resume safely without reconstructing important context from chat history.

### Required End-of-Session Handoff

Before ending any substantial work session, every agent must update `.ai/CURRENT.md`, whether the task is completed, partially completed, blocked, paused, handed off, stopped by a usage limit, stopped because the conversation is ending, or stopped because the user changed direction.

The final handoff must record, as applicable:

- current task, intended outcome, status, current/last agent, branch, date, relevant plan, and issue/PR;
- verified repository state and constraints;
- work completed, files changed, and important implementation details;
- decisions, rationale, and verified assumptions;
- commands run, tests/validation performed, and results;
- remaining required work, known bugs, blockers, risks, and uncertainties;
- concurrent editing warnings and files/areas to avoid;
- the recommended next concrete action.

For a tiny task, the update may be brief. It is still required before ending when the work changed repository state or left anything unfinished.

### Completion Cleanup and Cross-Agent Definition of Done

When a task is completed, the agent must:

1. Mark the relevant plan completed, when a plan exists.
2. Update `.ai/CURRENT.md` with the final outcome and validation results.
3. State clearly that no required work remains.
4. Separate optional follow-up from required remaining work.
5. Remove obsolete concurrent editing warnings.
6. Ensure the recommended next action matches the actual repository state.

Do not delete completed plans merely because work is finished. Do not turn `.ai/CURRENT.md` into a permanent archive; replace completed task details when a new task begins while retaining completed plans and durable decision records where useful.

A substantial task is not complete, and an agent must not report it as complete, until:

- required implementation work is finished;
- appropriate validation has been performed;
- the relevant plan status is current;
- any required durable decision record is current;
- `.ai/CURRENT.md` accurately reflects the final state;
- remaining work and risks are stated clearly; and
- the next agent can resume without relying on private chat history.

## Safety

- Never expose, commit, or copy secrets, tokens, passwords, private keys, credentials, production data, or unnecessary personal data.
- Avoid destructive git commands and never discard unrelated user or agent work.
- Confirm before irreversible data, schema, infrastructure, billing, deployment, or production actions.
- Use least privilege and do not disable security, authorization, validation, audit, or rate-limit checks merely to make a test pass.
- Report security-sensitive findings clearly and avoid reproducing sensitive values in the report.
