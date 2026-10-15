---
status: ready
owner: claude-code
updated: 2026-10-15 18:30
scope: .
---
# Merge telemetry-slice-8 into main

## Goal

Bring the finished telemetry Slice 8 work (AI exposure and accepted-choice
lineage) into main, so main's code and `schema.sql` match the live database,
which already has `migrations-ai-exposure-lineage.sql` applied (2026-10-14,
owner-authorized; see the branch's plan). The user reviews and pushes; nothing
is deployed from this task.

## Progress

- Merged on branch `merge/telemetry-slice-8` in the temporary worktree
  `.worktrees/merge-slice-8`, created from main `5845479`.
- Two conflicts resolved:
  - `.ai/CURRENT.md`: kept main's v3 version. The branch's v2 handoff stays in
    history at `c049efd`.
  - `tests/telemetry.playwright.config.ts`: kept both new specs
    (`ai-exposure-lineage.spec.ts` from slice-8, `seller-pinned-actions.spec.ts` from main).
- Everything else merged automatically, including `schema.sql`,
  `components/seller-form/*` and `lib/validation/schemas.ts`.

## Environment

`npm ci` in the worktree. No `.env` files are present, so no hosted database,
AI provider or email access is possible. The telemetry Playwright config uses
an isolated browser bundle with no Next server, auth or database.

## Validation

Run once each in the merge worktree on 2026-10-15 (Windows, Node 22.22.2, no `.env`):

- `npm exec tsc -- --noEmit`: passed.
- `npx playwright test -c tests/telemetry.playwright.config.ts`: 93 passed,
  including `ai-exposure-lineage.spec.ts`.
- `npm test -- --run`: 2238 passed, 1 failed, 13 skipped; plus 1 suite failed to load.
- `npm run lint`: 1 error, 19 warnings.

The three failures already fail on plain main (`5845479`, same dependencies).
They are not caused by this merge:

- `tests/unit/demo-seed-script.test.ts`: "SyntaxError: Invalid or unexpected
  token". `scripts/demo-seed.mjs` starts with `#!/` and is checked out with CRLF
  on Windows. Likely Windows-only; not investigated further.
- `tests/unit/admin-operations-ui.test.tsx` "distinguishes no observations yet
  from a genuinely quiet service": cannot find /no open service issues/.
- ESLint `no-explicit-any` in `components/admin/EventLogTable.tsx:8`.

Not run: `npm run build` (Vercel builds on push; a failed build does not
replace production), full `npm run test:e2e`, and any hosted or live checks.

## Next

The user reviews the merge, then from the main checkout runs
`git merge --ff-only merge/telemetry-slice-8` and `git push origin main`
(pushing main deploys). Afterwards, remove `.worktrees/merge-slice-8` and
`.worktrees/slice-8`, and mark this task done.
