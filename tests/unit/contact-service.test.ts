import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/gemini-client', () => ({
    generateJSON: vi.fn(),
    isGeminiConfigured: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
}));

import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini-client';
import { getFromCache, setInCache } from '@/lib/cache';
import { hasValidContact, resolveContact } from '@/lib/providers/contact-service';

const generateJSONMock = vi.mocked(generateJSON);
const isGeminiConfiguredMock = vi.mocked(isGeminiConfigured);
const getFromCacheMock = vi.mocked(getFromCache);
const setInCacheMock = vi.mocked(setInCache);

describe('contact-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ALLOW_UNVERIFIED_AI_CONTACTS;
        getFromCacheMock.mockResolvedValue(null);
        setInCacheMock.mockResolvedValue(undefined);
        isGeminiConfiguredMock.mockReturnValue(true);
    });

    it('returns null in strict mode and does not query AI', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'false';
        generateJSONMock.mockResolvedValue({
            customer_service_phone: '1-800-555-1212',
            start_stop_service_url: 'https://example.com/start',
        });

        const result = await resolveContact('Example Utility');

        expect(result).toBeNull();
        expect(generateJSONMock).not.toHaveBeenCalled();
        expect(getFromCacheMock).not.toHaveBeenCalled();
        expect(setInCacheMock).not.toHaveBeenCalled();
    });

    it('resolves and sanitizes AI data when explicitly enabled', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONMock.mockResolvedValue({
            customer_service_phone: '1-800-555-1212',
            start_stop_service_url: 'ftp://not-allowed.example.com',
            main_website: 'https://example.com',
            hours: 'Mon-Fri 8am-5pm',
        });

        const result = await resolveContact('Example Utility');

        expect(generateJSONMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            customer_service_phone: '1-800-555-1212',
            start_stop_service_url: undefined,
            main_website: 'https://example.com/',
            hours: 'Mon-Fri 8am-5pm',
        });
        expect(hasValidContact(result)).toBe(true);
    });
});
