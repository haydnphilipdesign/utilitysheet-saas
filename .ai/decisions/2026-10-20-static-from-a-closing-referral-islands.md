# Decision: Static /from-a-closing with client referral islands

## Status

Accepted (2026-10-20, implemented on `claude/ecstatic-davinci-yb2nwn`).

## Context

`/from-a-closing` read `searchParams` and looked up the sender's brand on the
server, so it was a dynamic route. Next 16 streams metadata for dynamic
routes: browsers and Googlebot got `<meta name="description">` in `<body>`,
only HTML-limited bots (Bingbot) got it in `<head>`. Lighthouse mobile scored
the page SEO 92 (`meta-description`); every other marketing page scored 100.

## Decision

The page is static (prerendered). Referral personalization runs in client
islands (`app/(marketing)/from-a-closing/referral.tsx`) that read the query
string with `useSearchParams`, each inside a `Suspense` whose fallback is the
generic copy and default signup link:

- `SenderIntro` fetches `GET /api/growth/sender-brand?ref=` and swaps in the
  branded sentence when a name comes back.
- `ReferralSignupCta` builds the signup href (`ref` + utm passthrough) with
  `buildFromAClosingSignupHref` (`lib/growth/from-a-closing.ts`).

The API route is IP rate-limited (`growthSenderBrandRatelimit`, 30/min),
`no-store`, and answers only `{ brandName }`, `null` for malformed, unknown,
inactive or banned-account codes. The lookup (`lib/growth/sender-brand.ts`)
is the page's earlier server logic, unchanged: active intake links only, and
only the brand name the seller already sees on that public link.

## Rationale

- Fixes the audit for every user agent, not just the ones Lighthouse uses.
- The indexable copy is the generic copy, which is what search should show
  anyway; a sender's brand name is per-visit social proof.
- The page is served from cache with no database round trip per visit.

## Alternatives Considered

- **`htmlLimitedBots` matching all user agents** (rejected). Site-wide: every
  dynamic route (dashboard, `/s`, `/packet`, `/i`, `/form`) would block its
  shell on metadata. Cheap today because no route uses `generateMetadata`,
  but a later `generateMetadata` with a database call would silently add that
  latency to TTFB for every signed-in and seller page. It also repurposes a
  bot list as a rendering switch. A Lighthouse-only regex would just game
  the score.
- **Dynamic island via Cache Components / PPR** (not taken). Would need
  `cacheComponents` enabled site-wide, a much larger change.

## Consequences

- Branded copy appears after hydration and one small fetch. The sentence
  swap is within the hero paragraph; Lighthouse CLS stayed 0.
- Tests: `tests/unit/from-a-closing-page.test.tsx` (islands, href, fallbacks)
  and `tests/unit/growth-sender-brand.test.ts` (lookup boundaries, route,
  rate limit).
- Marketing pages should stay static. Per-visit personalization on them
  belongs in client islands, not in `searchParams` on the page.

## Related Files, Plans, Issues, or Pull Requests

- `app/(marketing)/from-a-closing/page.tsx`, `referral.tsx`
- `app/api/growth/sender-brand/route.ts`
- `lib/growth/from-a-closing.ts`, `lib/growth/sender-brand.ts`, `lib/rate-limit.ts`
- `components/marketing/page-shell.tsx` (`description` widened to `ReactNode`)
