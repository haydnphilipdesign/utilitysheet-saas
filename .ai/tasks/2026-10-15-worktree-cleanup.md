---
status: blocked
owner: user
updated: 2026-10-15 18:10
scope: .worktrees
---
# Decide what to do with the old worktrees

Reminder for the user; blocked on the user's decision. Agents: do not remove,
merge, reset, push, or start new work in these worktrees. Each still holds an
uncommitted v2.2 copy of the coordination kit, so an agent started inside one
would follow outdated rules.

## Goal

Every worktree under `.worktrees/` is either removed or deliberately kept, and
the unmerged telemetry-slice-8 commits are either merged or knowingly dropped.

## Progress

Checked 2026-10-15 against local Git data (last fetch 2026-10-15 17:23).

| Worktree (branch) | Commits not in main | Other uncommitted changes | Suggestion |
| --- | --- | --- | --- |
| `.worktrees/maintenance-mode` (codex/maintenance-mode) | none | kit files only | remove |
| `.worktrees/slice-6` (telemetry-slice-6) | none | kit files; `scripts/demo-seed.mjs` differs only in line endings | remove |
| `.worktrees/slice-7` (telemetry-slice-7) | none | kit files only | remove |
| `.worktrees/slice-8` (telemetry-slice-8) | 2, pushed to `origin/telemetry-slice-8`, never merged | kit files only | decide first |
| `.worktrees/slice-9` (telemetry-slice-9) | none | kit files; `scripts/demo-seed.mjs` line endings only | remove |

The telemetry-slice-8 commits (2026-10-14):

- `977d6c9` Add AI generation exposure and accepted-choice lineage
- `c049efd` Record Slice 8 live migration and branch publication

They are safe on GitHub, so removing the local worktree loses nothing.

**The live database is ahead of main.** The branch's own CURRENT.md records
that the owner authorized it, and that `migrations-ai-exposure-lineage.sql` was
applied to the live Neon database on 2026-10-14. That migration only adds
things: columns on `ai_generation_runs` and new tables such as
`ai_result_exposures`. So production keeps working, but main has neither the
migration file nor the `schema.sql` changes, and the lineage feature is not live.

Commit `977d6c9` is the full feature: about 40 files across seller routes,
SellerWizard/UtilityStep, provider services, telemetry, admin telemetry, docs
and tests. A trial merge (`git merge-tree`, 2026-10-15) found main only 10
commits ahead of the branch point and just two conflicts: `.ai/CURRENT.md`
(take main's v3 version) and `tests/telemetry.playwright.config.ts` (a
two-line change). Merging is feasible; dropping the branch would leave live
database tables that no code in main describes.

## Environment

None. Removing a worktree deletes only its folder; branches stay until deleted.

## Validation

Not applicable (no code change). Findings from `git log main..<branch>`,
`git cherry`, and `git diff --ignore-cr-at-eol`.

## Next

1. Slice-8: merged and deployed (`9ab7423`, 2026-10-15); see
   [the merge task](2026-10-15-merge-telemetry-slice-8.md). Both `.worktrees/slice-8`
   and `.worktrees/merge-slice-8` can now be removed.
2. Run `powershell -NoProfile -File .ai/tools/status.ps1`. It prints the exact
   remove commands. `--force` is needed only because of the uncommitted kit files.
3. Mark this task done.
