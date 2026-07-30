# Shared Agent Context

This directory is the durable coordination context shared by Claude Code,
OpenAI Codex, other coding agents, and human contributors. Maintaining it is
part of normal repository work; private chat history is not a substitute.

- `CURRENT.md` contains the latest concise state for active, paused, handed-off,
  blocked, or most recently completed work. Replace stale state rather than
  appending a diary.
- `plans/` contains implementation-ready plans for work that warrants one.
- `decisions/` contains durable decisions whose rationale future contributors
  need to understand.

## Required Lifecycle

1. At startup, read and verify `CURRENT.md` against the worktree and read the
   relevant plan when one exists.
2. During substantial work, update `CURRENT.md` at meaningful milestones and
   keep an active plan honest.
3. Before delegation, pause, interruption, usage-limit stop, blocker stop, or
   session end, write a recoverable handoff.
4. When a durable decision is made, create or update its record, connect it to
   the active plan when relevant, and mention it in `CURRENT.md`.
5. At completion, record exact validation, give the plan an honest terminal
   status, remove obsolete warnings, separate required work from optional
   follow-up, and state when no required work remains.

See `AGENTS.md` for authoritative requirements. For cross-suite work, also
consult the parent suite coordination files when available.

Normal product, API, architecture, operations, and contributor documentation
belongs in the repository's regular documentation. Do not store transcripts,
private reasoning, raw logs, generated artifacts, secrets, credentials, tokens,
private keys, personal data, or production data here.

These files should normally be committed because they provide the shared
repository memory needed to resume work across agents and fresh sessions.
