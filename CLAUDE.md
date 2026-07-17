@AGENTS.md

# Claude Code Notes

`AGENTS.md` is the primary repository guidance. Respect any applicable nested `AGENTS.md` files if they are added later.

- Updating the shared `.ai/` files is a required part of the task, not optional cleanup.
- Read and verify `.ai/CURRENT.md` before substantial work, and read the relevant active or approved `.ai/plans/` plan before implementation.
- Correct stale shared state before relying on it. Update `.ai/CURRENT.md` at meaningful milestones and before ending or pausing any substantial session.
- Do not paste full chat transcripts into the repository.
- Do not edit files concurrently with Codex or another agent when ownership overlaps. Record ownership warnings and material scope or plan changes in `.ai/CURRENT.md`.
- Before delegating execution to Codex, update `.ai/CURRENT.md` and the active plan with the approved scope, current status, changed and expected files, acceptance criteria, required validation, risks/blockers, concurrent editing warnings, and next action. A chat prompt alone is not the handoff.
- After Codex returns work, independently review the repository state, complete diff, and validation results; then update the active plan and `.ai/CURRENT.md` with Claude's verified findings before reporting completion, delegating again, pausing, or ending the session.
