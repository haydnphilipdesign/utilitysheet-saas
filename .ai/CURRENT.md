# Current task: Make saved forms release checks manual-only

- Date: 2026-10-05. Owner: Codex. Branch: main. Status: completed locally; not committed or pushed. User approved making the workflow manual-only. No formal plan needed for this small configuration change.
- Changed .github/workflows/saved-forms-release.yml: removed push triggers for main and codex/saved-forms-release; retained workflow_dispatch and all Node 20/24 validation jobs unchanged. Security Scan remains manual-only.
- Validation: parsed YAML with js-yaml, asserted workflow_dispatch is the sole trigger, compared job definitions against HEAD (unchanged), and ran git diff --check. No application tests needed for this trigger-only change.
- Prior diagnosis: run 37324973927 and Friday run 37061133329 failed before job steps started because GitHub reported an account billing lock. Exact billing cause remains unknown; manual runs will also require resolving that lock.
- Worktree on entry contained only the prior investigation update to this handoff. Final changed files: this handoff and the workflow. No concurrent editing identified; no commits, pushes, billing changes, or production actions performed.
- No required local implementation work remains. Next action: commit/push when authorized to make the manual-only trigger effective on GitHub. Optional separate follow-up: resolve GitHub billing if manual checks are wanted.
- Prior telemetry details remain in .ai/plans/2026-10-05-admin-telemetry.md; its implementation is committed in cf161d4. Previously recorded full-lint baseline errors were not reverified here.
