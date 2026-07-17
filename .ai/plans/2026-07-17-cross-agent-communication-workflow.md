# Plan: Strengthen Cross-Agent Communication Workflow

## Status

Completed

## Objective

Make repository-based coordination a required part of normal work for Claude Code, OpenAI Codex, and other coding agents, so substantial work can be resumed safely without private chat history.

## Background

The repository already has a shared `AGENTS.md`, a thin `CLAUDE.md`, and a `.ai/` coordination directory. The user requested an audit because the existing language does not yet make all startup, milestone, delegation, interruption, plan-maintenance, decision-record, and completion duties explicit and mandatory.

## In Scope

- Audit root and nested agent instructions and shared coordination documentation.
- Strengthen `AGENTS.md` as the primary permanent instruction source.
- Keep `CLAUDE.md` as a thin Claude-specific layer that imports `AGENTS.md`.
- Align `.ai/README.md`, `.ai/plans/README.md`, `.ai/decisions/README.md`, and `.ai/CURRENT.md` with the permanent rules.
- Add an explicit cross-agent definition of done.

## Out of Scope

- Product code, tests, dependencies, runtime configuration, infrastructure, schemas, and application behavior.
- Commits, pushes, deployments, migrations, or production changes.
- Cleanup or modification of unrelated product edits and local audit artifacts already in the worktree.

## Relevant Existing Behavior

- `AGENTS.md` already requires reading `.ai/CURRENT.md`, preserving unrelated work, planning substantial changes, and updating the handoff before ending a substantial session.
- `CLAUDE.md` already imports `AGENTS.md` and mentions milestone and delegation duties.
- The `.ai/` README files describe current state, plans, and decisions, but update triggers and cross-file obligations are incomplete.
- `.ai/CURRENT.md` incorrectly describes the prior coordination setup task as complete and must be replaced with this active task before it can be relied on.

## Proposed Approach

1. Replace the weak shared workflow sections in `AGENTS.md` with explicit mandatory startup, work-in-progress, plan, decision, delegation, interruption, small-task, completion, and definition-of-done rules.
2. Tighten `CLAUDE.md` only where Claude-specific delegation and independent-review duties need emphasis.
3. Make each `.ai/` README describe its artifact's purpose, mandatory or conditional update triggers, and relationship to the other shared files.
4. Keep `.ai/CURRENT.md` concise and update it at planning, implementation, and completion milestones for this task.
5. Review the complete documentation diff for contradictions, scope leakage, and missing required scenarios.

## Files or Areas Expected to Change

- `AGENTS.md`
- `CLAUDE.md`
- `.ai/README.md`
- `.ai/CURRENT.md`
- `.ai/plans/README.md`
- `.ai/decisions/README.md`
- `.ai/plans/2026-07-17-cross-agent-communication-workflow.md`

## Data, API, or Schema Impact

None.

## Risks and Edge Cases

- Overly repetitive rules could become hard to follow; `AGENTS.md` should remain authoritative and supporting files should clarify artifact-specific responsibilities.
- Rules must distinguish mandatory `CURRENT.md` maintenance from conditional plan and decision-record maintenance.
- Tiny tasks need proportionate documentation without allowing repository changes or unfinished work to lose durable context.
- Existing unrelated modified and untracked files must remain untouched.

## Validation Plan

- Read every affected file after editing.
- Confirm `CLAUDE.md` still begins with `@AGENTS.md`.
- Search the final guidance for startup, milestone, delegation, interruption, usage-limit, plan, decision, completion, and definition-of-done coverage.
- Confirm plan updates are conditional on an active plan and decision records are conditional on durable decisions.
- Review `git diff` and `git diff --stat`, including untracked coordination files through direct content review.
- Run `git status --short` and confirm no product file was changed by this task.
- Scan changed coordination files for obvious secret patterns and trailing whitespace.

## Acceptance Criteria

- Every coding agent is explicitly required to verify and maintain `.ai/CURRENT.md` at startup, meaningful milestones, delegation, interruption, and session end as applicable.
- Active plans have explicit honest update triggers; completed plans are retained.
- Durable decision records have explicit conditional creation/update triggers, rationale, consequences, and cross-references.
- Claude-to-Codex and Codex-to-Claude handoffs require durable shared-file updates before transfer and takeover verification by the receiver.
- Usage-limit and unexpected-interruption recovery records the exact resumable state.
- A substantial task cannot be reported complete until all required shared communication artifacts are current.
- No product or unrelated files are changed by this task.

## Handoff Notes

The user supplied and approved the detailed requirements in the attached request. Existing product edits and audit artifacts have unknown ownership and must not be edited or reverted.

## Completion Notes

- Strengthened `AGENTS.md` with mandatory startup, milestone, delegation, interruption, end-of-session, completion-cleanup, small-task, plan-maintenance, decision-record, and definition-of-done requirements.
- Kept `CLAUDE.md` as a thin layer that imports `AGENTS.md` and made Claude's pre-delegation, post-review, pause, and session-end duties explicit.
- Aligned the `.ai/` README files with the permanent rules and clearly separated mandatory `CURRENT.md` maintenance from conditional plan and decision-record maintenance.
- Reviewed every affected file in full and found no material deviation from this plan.
- Confirmed the pre-existing tracked product diff remained unchanged at 4 files, 18 insertions, and 16 deletions; all task-authored changes are limited to agent instructions and `.ai/` coordination documentation.
- No required work remains for this task.
