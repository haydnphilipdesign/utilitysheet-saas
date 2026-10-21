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

Next.js documentation matching the installed version is in `node_modules/next/dist/docs/`. Check it before relying on remembered Next.js APIs or conventions.

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
- Admin writes require audit logging, and a reason when they change a customer record or send email (the reason is optional for Product Updates, Operations triage and feedback status; see `ADMIN.md` Guardrails); `ADMIN_WRITES_DISABLED=true` is the production safety catch. Impersonation remains explicitly gated.
- Generated or local-only artifacts include `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`, `next-env.d.ts`, screenshots, PDFs, HAR/trace files, `.superpowers/`, `.worktrees/`, and `.claude/settings.local.json`. Do not edit or commit them as source.
- `scripts/security/scan-artifacts.mjs` scans tracked files only. Before staging new files, also inspect them directly for secrets and sensitive data.
- No repository-wide branch, commit-message, or pull-request convention is currently enforced. Do not create commits, push, deploy, run migrations, or modify production data unless the user explicitly authorizes that action.

<!-- shared-agent-coordination-kit -->
## Shared agent coordination

At the start of each session, read [.ai/WORKFLOW.md](.ai/WORKFLOW.md) and follow it.
It explains where tasks, plans, decisions, and project context live, and how to
work alongside other agents. The rest of this file still applies.
<!-- /shared-agent-coordination-kit -->

## Safety

- Never expose, commit, or copy secrets, tokens, passwords, private keys, credentials, production data, or unnecessary personal data.
- Avoid destructive git commands and never discard unrelated user or agent work.
- Confirm before irreversible data, schema, infrastructure, billing, deployment, or production actions.
- Use least privilege and do not disable security, authorization, validation, audit, or rate-limit checks merely to make a test pass.
- Report security-sensitive findings clearly and avoid reproducing sensitive values in the report.
