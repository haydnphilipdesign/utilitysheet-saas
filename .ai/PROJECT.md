# utility-sheet — coordination context

## Purpose and authority

Protected specialized utility-information product. Preserve users, revenue, public capabilities, packet/PDF, billing and privacy boundaries.

Read [local instructions](../AGENTS.md) for authoritative product, safety and
validation rules. [WORKFLOW.md](WORKFLOW.md) owns coordination; task records own
detailed handoffs; CURRENT holds project-wide priorities and warnings. Historical claims need verification.

## Tooling inventory

The package manifest and package-lock.json identify npm. Script names below
were checked against package.json during migration; they are an inventory, not
a claim that application validation was run. Follow AGENTS.md for runtime and
which commands are safe/appropriate.

- `npm run dev`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

For cross-suite work, read the suite guidance from the known owning checkout;
relative parent paths from a linked worktree can differ.

## Environment/isolation

Registration does not authorize hosted data, migrations, real messages, provider
calls, production flags, commits, pushes or deployment. Record ports, fixtures,
database strategy and shared/linked dependencies per task before executing code.
Unknown isolation must stay explicit; never infer .env is local.

## Migration and current constraints

Existing seller-form/application/schema/test edits are preserved. Telemetry Slice 8 remains in its separate worktree; read its handoff before implementation. Historical retention checks remain historical; no hosted checks occurred here.

Pre-v2 state: [exact historical handoff](history/pre-v2-CURRENT.md). Original
plans/decisions/evidence and local product documentation remain available.
