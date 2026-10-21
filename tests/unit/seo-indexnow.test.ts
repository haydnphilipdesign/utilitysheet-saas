import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    INDEXNOW_KEY,
    KEY_LOCATION,
    assertDateArg,
    buildIndexNowPayload,
    normalizeSiteUrl,
    parseSitemap,
    selectChangedUrls,
} from '@/scripts/seo/indexnow-core.mjs';
import sitemap from '@/app/sitemap';

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://www.utilitysheet.com/</loc>
<lastmod>2026-10-20</lastmod>
</url>
<url>
<loc>https://www.utilitysheet.com/utility-sheet-template</loc>
<lastmod>2026-10-21</lastmod>
</url>
<url>
<loc>https://www.utilitysheet.com/no-date</loc>
</url>
</urlset>`;

describe('IndexNow key file', () => {
    it('is served from public/ with the key as its only content', () => {
        const keyFile = readFileSync(path.join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`), 'utf8');
        expect(keyFile.trim()).toBe(INDEXNOW_KEY);
        expect(KEY_LOCATION).toBe(`https://www.utilitysheet.com/${INDEXNOW_KEY}.txt`);
    });
});

describe('IndexNow URL selection', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('reads loc and lastmod from the sitemap', () => {
        expect(parseSitemap(sitemapXml)).toEqual([
            { url: 'https://www.utilitysheet.com/', lastModified: '2026-10-20' },
            { url: 'https://www.utilitysheet.com/utility-sheet-template', lastModified: '2026-10-21' },
            { url: 'https://www.utilitysheet.com/no-date', lastModified: null },
        ]);
    });

    it('keeps pages changed on or after the date, and undated pages', () => {
        expect(selectChangedUrls(parseSitemap(sitemapXml), '2026-10-21')).toEqual([
            'https://www.utilitysheet.com/utility-sheet-template',
            'https://www.utilitysheet.com/no-date',
        ]);
        expect(selectChangedUrls(parseSitemap(sitemapXml), null)).toHaveLength(3);
    });

    it('rejects malformed dates', () => {
        expect(assertDateArg('2026-10-21')).toBe('2026-10-21');
        expect(() => assertDateArg('10/21/2026')).toThrow(/--since/);
    });

    it('only lists public pages from our own sitemap', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.utilitysheet.com');
        const urls = sitemap().map((entry) => entry.url);
        const payload = buildIndexNowPayload(urls);
        expect(payload.host).toBe('www.utilitysheet.com');
        for (const url of payload.urlList) {
            expect(url).toMatch(/^https:\/\/www\.utilitysheet\.com\//);
            expect(url).not.toMatch(/\/(auth|dashboard|admin|api|onboarding|s|i|form|packet|invite)(\/|$)/);
        }
    });
});

describe('IndexNow payload', () => {
    it('normalizes paths to www URLs and drops duplicates', () => {
        expect(buildIndexNowPayload(['/pricing', 'pricing', 'https://www.utilitysheet.com/pricing#plans'])).toEqual({
            host: 'www.utilitysheet.com',
            key: INDEXNOW_KEY,
            keyLocation: KEY_LOCATION,
            urlList: ['https://www.utilitysheet.com/pricing'],
        });
    });

    it('refuses other hosts, including the apex domain', () => {
        expect(() => normalizeSiteUrl('https://example.com/')).toThrow(/not on www\.utilitysheet\.com/);
        expect(() => normalizeSiteUrl('https://utilitysheet.com/pricing')).toThrow(/not on/);
    });

    it('refuses an empty list', () => {
        expect(() => buildIndexNowPayload([])).toThrow(/No URLs/);
    });
});
