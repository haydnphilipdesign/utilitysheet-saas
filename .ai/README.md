# Shared AI Context

The `.ai` directory is the required durable coordination context shared by Claude Code, OpenAI Codex, other coding agents, and contributors. Maintaining it is part of normal repository work; private chat history is not a substitute.

- `CURRENT.md` contains the latest concise state for the active, paused, handed-off, blocked, or most recently completed task. Its updates are mandatory at the triggers defined in `AGENTS.md`. Replace stale state; do not append a permanent diary.
- `plans/` contains implementation-ready, task-specific plans for work that warrants one. Plan creation and maintenance are conditional on task complexity and whether an active plan exists.
- `decisions/` contains durable architecture, technology, data, security, API, or product decisions whose rationale future contributors need to understand. Decision records are conditional on a durable decision being made.

## Required Lifecycle

1. At startup, read and verify `CURRENT.md` against the worktree and read the relevant active plan when one exists. Correct stale or contradictory state before relying on it.
2. During substantial work, update `CURRENT.md` at meaningful milestones. Keep an active plan current when its status, scope, approach, risks, acceptance criteria, or outcome changes.
3. Before delegation, pause, interruption, usage-limit stop, blocker stop, or session end, write a concise recoverable handoff to `CURRENT.md` and update the active plan when applicable.
4. When a durable decision is made, create or update the relevant decision record, connect it to the active plan when relevant, and mention it in `CURRENT.md`.
5. At completion, record final validation, mark the active plan completed, remove obsolete editing warnings, distinguish optional follow-up from required work, and state when no required work remains.

See `AGENTS.md` for the authoritative requirements and the README in each subdirectory for artifact-specific triggers and templates.

Normal product, API, architecture, operations, and contributor documentation should remain in the repository's regular documentation locations. Temporary debugging output, raw logs, generated artifacts, model transcripts, and full chat histories do not belong here.

Never store secrets, credentials, tokens, private keys, personal data, production data, or unnecessary generated output in `.ai/`.

These files should normally be committed because they provide the shared repository memory needed to resume work across agents and fresh sessions.
