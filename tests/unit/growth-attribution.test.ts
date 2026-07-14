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
