# Shared agent coordination (v3)

These files are shared memory for the AI agents and humans working on this
project. The user's instructions always win. Nothing here grants permission to
commit, push, merge, deploy, or touch production data.

## Where things live

- `PROJECT.md`: verified facts about the project (purpose, layout, commands, constraints).
- `CURRENT.md`: short project-wide priorities and warnings.
- `tasks/`: one file per task (owner, scope, status, progress, next step).
- `plans/`: only for substantial, multi-step, or risky work.
- `decisions/`: choices whose reasoning should outlive the task.

Each folder's README holds its template. Read it only when creating that kind of file.

## Starting a session

1. Read `PROJECT.md`, `CURRENT.md`, and the task file you are working on.
2. Run `git status`. If `git worktree list` shows more than one worktree, run
   `powershell -NoProfile -File .ai/tools/status.ps1`. It lists open tasks in
   every worktree and flags overlapping scope. Task files on other branches are
   not visible in your checkout, so this is how you see them.
3. Trust the code over the notes. If a note is wrong or stale, fix it.

## Claiming work

Before work that will take more than a few minutes, create a task file (template
in `tasks/README.md`) with status `active`, yourself as owner, and the files or
folders you expect to change as scope. A quick fix finished in the same session
does not need one.

If someone else's open task overlaps your scope, do not edit those files; ask the
user. Task files are a courtesy, not a lock.

To continue another agent's task, read it, check its claims against the code,
then make yourself owner and note the takeover in the file.

## Working alongside other agents

- Agents working at the same time should each use their own worktree, or clearly
  separate files. Never edit, reset, or remove another agent's worktree.
- Worktrees share databases, ports, and external services. Note any you use in
  the task file.
- Each task has its own file, so branches rarely conflict. Edit `CURRENT.md`
  only for news that affects the whole project.

## While working

Update the task file at milestones: scope changes, blockers, failed validation.
Not after every step. Keep `updated:` current.

## Validation

Run the checks that fit the change, once, before handing off or finishing.
Record the exact command and result in the task file. Do not rerun a passing
check unless you have since changed code it covers. For docs-only changes a
careful reread is enough. Never report a check you did not run.

## Stopping or handing off

Leave the task file so another agent could resume without your chat history:
what is done, what is half-done (name the files), validation results, and the
next concrete action. Set the status to `active`, `paused`, `blocked`, `ready`
(finished on its branch, waiting to merge), `done`, or `dropped`.

## Plans and decisions

Write a plan before work that is multi-step, cross-cutting, or hard to reverse.
Write a decision record when a choice will need explaining later; supersede old
decisions rather than rewriting them.

## Keep out of .ai/

Secrets, credentials, customer data, chat transcripts, raw logs, and bulky
generated output.
