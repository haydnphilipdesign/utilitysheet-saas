# Task files

One file per task, named `YYYY-MM-DD-short-name.md` (lowercase, hyphens). Keep
the file after the task ends; together they are the project's work history.

Statuses: `active`, `paused`, `blocked`, `ready` (finished on its branch, waiting
to merge), `done`, `dropped`.

`scope` is a comma-separated list of repository-relative files or folders. A
folder covers everything inside it; `.` means the whole repository. Use local
time for `updated`.

```md
---
status: active
owner: codex
updated: 2026-10-15 14:30
scope: src/components/seller-form, tests/seller
---
# Short task title

## Goal

What "done" means, in a sentence or two. Link the plan if there is one.

## Progress

What is done, what is half-done (name the files), choices made along the way.

## Environment

Ports, databases, services, or .env files this task uses. "None" is fine.

## Validation

Exact commands run and their results. "Not run yet" is fine.

## Next

The next concrete action.
```
