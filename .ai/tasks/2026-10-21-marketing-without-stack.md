---
status: done
owner: claude
updated: 2026-10-21 16:00
scope: app/layout.tsx, app/(marketing)/page.tsx, app/auth/layout.tsx, app/dashboard/layout.tsx, app/(admin)/layout.tsx, app/onboarding/layout.tsx, app/account-closed/layout.tsx, app/handler/[...stack]/layout.tsx, app/invite/[token]/layout.tsx, app/test-fixtures/settings/layout.tsx, components/marketing, components/landing/AuthenticatedRedirect.tsx, lib/stack/session-hint.ts, tests/unit/marketing-session-hint.test.tsx
---
# Marketing pages without Stack Auth; no signed-in redirect from home

## Goal

Approved by the owner on 2026-10-21: stop redirecting signed-in visitors from
`/` to `/dashboard`, and stop loading Stack Auth on public pages (it was ~45%
of the home page's startup JavaScript and the main cost in Lighthouse's
simulated LCP).

## Progress

Done on branch `claude/marketing-without-stack`:
- Removed `AuthenticatedRedirect` (only used on `/`).
- `StackAuthProvider` (with `AccountActivationSync`) moved from the root
  layout into the auth, dashboard, admin, onboarding, account-closed, Stack
  handler, and invite layouts, plus the settings test fixture. Public pages
  (marketing, /demo, seller /s /i /form, /packet) no longer load it; none of
  them used Stack client hooks. Server-side `stackServerApp` is unaffected.
- Marketing header: signed-in state is a hint from Stack's JS-readable
  refresh-token cookie (`lib/stack/session-hint.ts`), never used for
  authorization. Header is now server-rendered (was `ssr: false`), so its nav
  links are in the static HTML. Header CTA-view tracking waits for the hint
  so signed-in visitors aren't counted.
- Behavior change to know about: `AccountActivationSync` no longer runs when
  a signed-in user is on a public page; it still runs on every signed-in
  area, and the dashboard layout also activates accounts server-side.

## Environment

Local production build on 127.0.0.1:3123 and dev server on 127.0.0.1:3000
with the checkout's .env/.env.local. No hosted services or data touched.

## Validation

- `tsc --noEmit`: pass. ESLint on changed files: pass.
- Full Vitest: 263 files pass, 1 skipped (2285 tests).
- `next build`: pass.
- Lighthouse mobile, home, 3 runs each (simulated): LCP 5.8s -> 4.7s, TBT
  ~190ms -> ~110ms, score 76 -> 82. With applied throttling LCP stays ~2.2s
  (bound by first paint). Startup JS referenced by the home HTML: 415KB -> 230KB.
- Route smoke (prod build): /, /auth/login, /auth/signup, /handler/sign-in,
  /demo, /pricing, /onboarding, /account-closed, /invite/abc, /s/<bad> render;
  /dashboard signed out -> 307 /auth/login.
- Playwright Desktop Chrome (marketing-mobile, account-auth-responsive,
  invite, settings, test-drive-journey, seller-flow, packet-responsive):
  35 pass, 2 skipped, 2 fail. Both failures fail identically on main with
  these changes stashed (FAQ "How does PDF delivery work" button, and
  "Branding Profiles shared by the whole team" text): stale tests.
- Real browser: home renders without hydration warnings; with a fake
  `stack-refresh-…--default` cookie the visitor stays on `/` and the header
  shows Dashboard.
- Not verified: a real sign-in, because there are no credentials here. Owner to
  sign in once (preview or after deploy) and open dashboard, settings, and the
  home page.

## Next

Merged into `main` and pushed on 2026-10-21 at the owner's request. Live check
after deploy: /, /pricing, /auth/login, /auth/signup, /handler/sign-in, /demo,
/utility-sheet-template, and the IndexNow key return 200; /dashboard signed out
redirects to /auth/login; live header shows Sign in / Start free without a
session cookie and Dashboard with one, no console errors. Owner to sign in
once and open dashboard, settings, and the home page. The two stale
Playwright tests still need updating.
