---
status: done
owner: codex
updated: 2026-10-21 15:44
scope: package.json, package-lock.json, components/providers/telemetry-collectors.tsx, tests/unit/telemetry-collectors.test.tsx, tests/telemetry-boundaries.spec.ts, tests/fixtures/telemetry-navigation.ts, docs/telemetry-privacy.md
---
# Update Analytics and restore safe route labels

## Goal
Update Vercel Analytics and populate route reporting without exposing private paths.

## Progress
Updated Analytics 1.6.1 to 2.0.1. Verified route metadata is separate from the documented URL-only beforeSend hook, which remains unchanged. React SDK now receives explicit safe path/route labels from Next usePathname. Remount on pathname changes preserves pageviews within a single coarse family. npm 10 failed with edgesOut; npm 11 on Node 20 succeeded. Kept only Analytics changes in lockfile, removing unrelated resolver churn.

## Environment
Local dependencies and isolated synthetic browser harness only. No deployment, database or real telemetry calls.

## Validation
All final checks ran through `npx --yes --package=node@20 -c`:
- `npm test -- --run tests/unit/telemetry-collectors.test.tsx tests/unit/telemetry-boundaries.test.ts`: 26 passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js components/providers/telemetry-collectors.tsx tests/unit/telemetry-collectors.test.tsx tests/telemetry-boundaries.spec.ts tests/fixtures/telemetry-navigation.ts`: passed.
- `node node_modules/@playwright/test/cli.js test --config tests/telemetry.playwright.config.ts tests/telemetry-boundaries.spec.ts`: 3 passed, including safe route metadata and navigation within a coarse family.
- Initial nested npm exec check invocations failed with EUSAGE; direct CLI commands above succeeded.

## Next
User authorized committing and pushing this fix to GitHub main. Pre-push fetch confirmed main matched origin/main; `npm run security:scan` passed and the new task file was inspected directly. After deployment, verify new traffic populates Vercel Routes; synthetic harness does not prove hosted collector/dashboard behavior. No historical backfill claimed.
