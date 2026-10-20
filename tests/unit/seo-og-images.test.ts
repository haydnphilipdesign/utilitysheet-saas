import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import { ogImagePathFor, ogPages } from '@/lib/seo/og-pages';
import { createPageMetadata } from '@/lib/seo/site';

const legalPaths = ['/privacy', '/terms', '/cookie-policy'];

describe('social preview images', () => {
    it('gives every non-legal sitemap page its own image', () => {
        const ogPaths: string[] = Object.values(ogPages).map((page) => page.path);
        for (const entry of sitemap()) {
            const path = new URL(entry.url).pathname;
            if (!legalPaths.includes(path)) {
                expect(ogPaths).toContain(path);
            }
        }
    });

    it('falls back to the home image for pages without their own', () => {
        expect(ogImagePathFor('/pricing')).toBe('/og/pricing');
        expect(ogImagePathFor('/privacy')).toBe('/og/home');
    });

    it('uses the page image for both Open Graph and X cards', () => {
        const metadata = createPageMetadata({ title: 'Pricing', description: 'd', path: '/pricing' });
        expect(metadata.openGraph?.images).toEqual([expect.objectContaining({ url: '/og/pricing' })]);
        expect(metadata.twitter?.images).toEqual(['/og/pricing']);
    });
});
