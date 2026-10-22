import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    GROWTH_ATTRIBUTION_STORAGE_KEY,
    captureFirstTouchAttribution,
    parseGrowthAttribution,
    persistPendingGrowthAttribution,
    readPendingGrowthAttribution,
} from '@/lib/growth/attribution';

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('growth attribution', () => {
    it('removes capabilities, free-text campaign values and unknown properties from old storage and posted data', async () => {
        localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, JSON.stringify({
            source: 'facebook', medium: 'synthetic-secret', campaign: '123 Sentinel Street',
            content: 'private-account', referralCode: null,
            landingPath: '/s/synthetic-secret?password=synthetic-password#private', token: 'synthetic-secret',
        }));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
        await persistPendingGrowthAttribution();
        const stored = localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY)!;
        const sent = vi.mocked(fetch).mock.calls[0][1]?.body as string;
        expect(JSON.parse(sent)).toEqual({ source: 'facebook', medium: null, campaign: null, content: null, referralCode: null, landingPath: '/s/[token]' });
        expect(stored).toBe(sent);
        for (const sentinel of ['synthetic-secret', 'synthetic-password', '123 Sentinel Street', 'private-account']) expect(sent).not.toContain(sentinel);
    });

    it('does not collect arbitrary campaign text or transform malformed referrals into codes', () => {
        expect(parseGrowthAttribution(new URL('https://utilitysheet.com/?utm_campaign=synthetic-secret&ref=seller%40example.com'))).toBeNull();
    });

    it('continues safely with malformed or blocked browser storage', () => {
        localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, 'not-json');
        expect(readPendingGrowthAttribution()).toBeNull();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(() => captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'))).not.toThrow();
    });

    it('normalizes allow-listed campaign fields', () => {
        const result = parseGrowthAttribution(new URL(
            'https://utilitysheet.com/auth/signup?utm_source=TC%20Collective&utm_medium=facebook&utm_campaign=handoff-kit&utm_content=case-study&ref=team-slug'
        ));

        expect(result).toEqual({
            source: 'tc collective',
            medium: 'facebook',
            campaign: 'handoff-kit',
            content: 'case-study',
            referralCode: 'team-slug',
            landingPath: '/auth/signup',
        });
    });

    it('keeps the Facebook group placement from posted group links', () => {
        expect(parseGrowthAttribution(new URL(
            'https://www.utilitysheet.com/utility-sheet-template?utm_source=facebook&utm_medium=group&utm_content=re-tc'
        ))).toEqual({
            source: 'facebook',
            medium: 'group',
            campaign: null,
            content: 're-tc',
            referralCode: null,
            landingPath: '/utility-sheet-template',
        });
    });

    it('returns null for a visit with no attribution fields', () => {
        expect(parseGrowthAttribution(new URL('https://utilitysheet.com/pricing'))).toBeNull();
    });

    it('keeps the first attributable visit', () => {
        captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'));
        captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=partner'));

        expect(readPendingGrowthAttribution()?.source).toBe('facebook');
        expect(localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY)).toContain('facebook');
    });

    it('removes pending attribution only after successful persistence', async () => {
        captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

        await persistPendingGrowthAttribution();

        expect(fetch).toHaveBeenCalledWith('/api/growth/attribution', expect.objectContaining({ method: 'POST' }));
        expect(readPendingGrowthAttribution()).toBeNull();
    });

    it('retains pending attribution when persistence fails', async () => {
        captureFirstTouchAttribution(new URL('https://utilitysheet.com/?utm_source=facebook'));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

        await persistPendingGrowthAttribution();

        expect(readPendingGrowthAttribution()?.source).toBe('facebook');
    });
});
