// Shared by app/robots.ts and next.config.ts, so keep this file free of
// path aliases and runtime imports.

/**
 * Signed-in, admin, and machine routes. robots.txt disallows them, and the
 * pages also send noindex. Prefixes have no trailing slash so `/dashboard`
 * itself is covered as well as everything under it.
 */
export const crawlBlockedPrefixes = [
    '/api',
    '/auth',
    '/dashboard',
    '/admin',
    '/onboarding',
    '/handler',
    '/account-closed',
    '/test-fixtures',
] as const;

/**
 * Capability-link routes (seller forms, reusable intake links, packets,
 * invites). These stay crawlable on purpose: a crawler that is blocked by
 * robots.txt never sees noindex, and can still list a publicly posted link as
 * "Indexed, though blocked by robots.txt". They send an X-Robots-Tag header
 * instead, which also covers responses that cannot carry a meta tag.
 */
export const capabilityLinkPrefixes = ['/s', '/i', '/form', '/packet', '/invite'] as const;

/** Header sources that must always answer with `X-Robots-Tag: noindex`. */
export const noIndexHeaderSources = [...crawlBlockedPrefixes, ...capabilityLinkPrefixes].map(
    (prefix) => `${prefix}/:path*`,
);
