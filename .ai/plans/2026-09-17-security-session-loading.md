# Fix settings security session loading

Status: completed locally, 2026-09-17, OpenAI Codex. Uncommitted; no required local implementation work remains.

Verified cause: production logs show Stack server-user getActiveSessions crashes with `.map is not a function`. Installed SDK server method assumes an array, while its client method understands the response.items envelope. The server listing also lacks current-session context.

Approach: keep server-user authorization and account checks. Use a server-only StackClientApp inheriting project configuration, with explicit tokens obtained from the authenticated server user, to list session-aware sessions. Verify matching user identity and fail closed if unavailable. Keep server-side session revocation and all existing recent-auth gates.

Files: lib/stack/session-client.ts (new), lib/account/security.ts, tests/unit/account-security-context.test.ts (new), related existing tests only if needed.

Acceptance: GET no longer calls broken server session listing; current session is identified from the authenticated session API, expired/missing sessions still require reauthentication, failures cannot unlock controls. Closure and export retain shared guard behavior.

Validation: regression tests for adapter wiring and context gates; existing account security, export and closure route/UI tests; affected-file ESLint and TypeScript. No live account mutation or deployment. Production verification after deployment remains outside this local fix.

Results: 6 focused Vitest files / 31 tests passed; affected-file ESLint, TypeScript and git diff --check passed. Added explicit missing-token rejection after TypeScript identified nullable auth tokens. Validation used local Node 22.22.2 rather than CI Node 20. No production mutation or deployment. Next: authorized publication and live Settings smoke check.

