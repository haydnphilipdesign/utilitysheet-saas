---
status: done
owner: claude
updated: 2026-10-21 21:35
scope: package.json, package-lock.json, lib/neon/auth.ts, eslint-suppressions.json, next.config.ts, AGENTS.md, .ai/tasks/2026-10-21-security-dependency-update.md
---
# Security-focused dependency update

## Goal

Clear the reachable npm audit findings with the smallest supported updates, in
reviewable groups. No commit, push, deploy, migration, or provider calls.

## Progress

Done. User authorized committing and pushing straight to main (no preview step); committed as three
groups (Next/React, runtime, dev tooling). npm audit: 73 (8 critical, 29 high, 34 moderate, 2 low)
-> 19 (0 critical, 12 high, 6 moderate, 1 low); 5 root advisories remain, all unreachable or dev-only.

1. Next 16.0.10 -> 16.4.2, eslint-config-next 16.4.2, React/React DOM 19.2.1 -> 19.3.1
   (Next 16.4.2 vendors React 19.3 for the App Router). eslint-plugin-react-hooks 7.1.1 (required by
   eslint-config-next) detects 29 existing set-state-in-effect / preserve-manual-memoization cases;
   recorded in `eslint-suppressions.json` so the rules stay errors for new code.
2. Runtime: jsPDF 4.2.1; @vercel/blob 2.0.1 (patch; undici 5 -> 6.29.1, no auth-flow change, unlike 2.5+
   which adds OIDC); removed unused `@neondatabase/auth` (+ dead `lib/neon/auth.ts`),
   `@neondatabase/toolkit`, `uuid` (117 packages gone incl. better-auth, kysely, axios). In-range refresh:
   protobufjs 7.6.6, ws 8.22.0, @aws-sdk/* (drops fast-xml-parser), js-cookie, dompurify, fflate,
   follow-redirects, ip-address, basic-ftp 5.3.1, bn.js, minimatch, brace-expansion, source-map-js.
3. Dev: vitest/@vitest/ui 4.1.12, vite 7.3.7, rollup 4.62.3, typescript-eslint 8.71.2, babel, js-yaml,
   flatted, ajv, browserslist, picomatch, @humanfs/node.
4. Speed Insights kept at 1.3.1: no advisory; 2.0 renames BeforeSendMiddleware and adds injected config.

Transitive refreshes used `npm update --before=2026-10-14` (7-day age floor). Rollup held at 4.62.3:
4.62.4+ adds an unused `@napi-rs/lzma-linux-x64-gnu` native optional dependency.
Held back: Puppeteer 25 / @sparticuz/chromium 153 (Node >= 22); Resend 6.34 (swaps webhook verifier);
Stack Auth 2.8.56 (findings fixed by transitive refresh).

Side effect found: `next dev` 16.4 appends a managed block to AGENTS.md on every start. User chose
to opt out: `agentRules: false` in next.config.ts, plus a hand-written pointer to
`node_modules/next/dist/docs/` in AGENTS.md (Repository Orientation). Verified `next dev` then leaves
AGENTS.md unchanged.

## Environment

Local only. Node 20.19.0 (cached validation folder) with npm 11.21.1 (session scratchpad). Build and dev
server ran with every .env credential overridden by synthetic values (CI-style disabled DATABASE_URL,
synthetic Stack keys, empty Stripe/Resend/Google keys, NEXT_TELEMETRY_DISABLED=1). Port 3000 used and
released. A temporary baseline worktree in the scratchpad was created and removed.

## Validation

- `tsc --noEmit`: pass (baseline pass).
- ESLint excluding local-only `.worktrees/`, `.qa-artifacts/`, `output/`, `.playwright-cli/`: 0 errors, 25 warnings
  (baseline 0/18; +7 new `@next/next/no-location-assign-relative-destination` warnings).
- `vitest run` full: 264 files / 2305 passed / 13 skipped (identical to baseline).
- `next build` (synthetic env): pass, 105 static pages.
- PDFs (template, sample, Simple Free, Advanced Pro via local Chrome): page counts, text, 54 form fields
  and pixels identical before/after.
- Playwright Desktop Chrome: 107 passed, 7 skipped, 6 failed; the same 6 fail on the original deps
  (2 need a real Stack project, 4 assert copy/layout that no longer matches). Telemetry harness: 3/3 passed.
- `npm audit signatures`: 923 verified signatures, 151 attestations (incl. next, react, vitest).
- `security:scan` pass; `git diff --check` clean.
- Not run: Mobile Safari/Chrome Playwright projects; hosted Chromium 143 PDF render; real Blob upload.

## Next

After the production deploy, smoke-test a packet PDF download (hosted Chromium 143) and a Branding
logo upload/delete. Optionally remove the unused NEXT_PUBLIC_NEON_AUTH_URL env var.
