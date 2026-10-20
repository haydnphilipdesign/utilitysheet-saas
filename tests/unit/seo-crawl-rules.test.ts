import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';
import { capabilityLinkPrefixes, crawlBlockedPrefixes, noIndexHeaderSources } from '@/lib/seo/private-routes';

function disallowed(): string[] {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    return ([] as string[]).concat(rule.disallow ?? []);
}

describe('robots.txt', () => {
    it('blocks signed-in and admin areas without blocking public pages', () => {
        expect(disallowed()).toEqual(expect.arrayContaining(['/api', '/auth', '/dashboard', '/admin', '/onboarding']));
        expect(disallowed()).not.toContain('/');
        expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
    });

    it('leaves capability links crawlable so crawlers can read their noindex', () => {
        for (const prefix of capabilityLinkPrefixes) {
            expect(disallowed()).not.toContain(prefix);
            expect(disallowed()).not.toContain(`${prefix}/`);
        }
    });
});

describe('noindex header sources', () => {
    it('covers every blocked and capability-link prefix, including the bare path', () => {
        for (const prefix of [...crawlBlockedPrefixes, ...capabilityLinkPrefixes]) {
            expect(noIndexHeaderSources).toContain(`${prefix}/:path*`);
        }
    });
});
