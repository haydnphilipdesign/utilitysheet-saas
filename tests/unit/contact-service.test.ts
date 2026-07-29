import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/gemini-client', () => ({
    generateJSONWithMeta: vi.fn(),
    getGeminiModelName: () => 'gemini-test',
    isGeminiConfigured: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
}));

import { generateJSONWithMeta, isGeminiConfigured } from '@/lib/ai/gemini-client';
import { PROVIDER_CONTACT_RESPONSE_SCHEMA } from '@/lib/ai/response-schemas';
import { getFromCache, setInCache } from '@/lib/cache';
import {
    hasValidContact,
    resolveContact,
    resolveContactFresh,
} from '@/lib/providers/contact-service';

const generateJSONWithMetaMock = vi.mocked(generateJSONWithMeta);
const isGeminiConfiguredMock = vi.mocked(isGeminiConfigured);
const getFromCacheMock = vi.mocked(getFromCache);
const setInCacheMock = vi.mocked(setInCache);

describe('contact-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ALLOW_UNVERIFIED_AI_CONTACTS;
        getFromCacheMock.mockResolvedValue(null);
        setInCacheMock.mockResolvedValue(true);
        isGeminiConfiguredMock.mockReturnValue(true);
    });

    it('returns null in strict mode and does not query AI', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'false';
        generateJSONWithMetaMock.mockResolvedValue({
            data: {
                customer_service_phone: '1-800-555-1212',
                start_stop_service_url: 'https://example.com/start',
            },
            failure: null,
            groundingSourceUrls: [],
        });

        const result = await resolveContact('Example Utility');

        expect(result).toBeNull();
        expect(generateJSONWithMetaMock).not.toHaveBeenCalled();
        expect(getFromCacheMock).not.toHaveBeenCalled();
        expect(setInCacheMock).not.toHaveBeenCalled();
    });

    it('resolves and sanitizes AI data when explicitly enabled', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONWithMetaMock.mockResolvedValue({
            data: {
                customer_service_phone: '1-800-555-1212',
                start_stop_service_url: 'ftp://not-allowed.example.com',
                main_website: 'https://example.com',
                hours: 'Mon-Fri 8am-5pm',
            },
            failure: null,
            groundingSourceUrls: [],
        });

        const result = await resolveContact('Example Utility');

        expect(generateJSONWithMetaMock).toHaveBeenCalledWith(
            expect.any(String),
            { responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA }
        );
        expect(result).toEqual({
            customer_service_phone: '1-800-555-1212',
            start_stop_service_url: undefined,
            main_website: 'https://example.com/',
            hours: 'Mon-Fri 8am-5pm',
        });
        expect(hasValidContact(result)).toBe(true);
        expect(setInCacheMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.anything(),
            90 * 24 * 60 * 60
        );
    });

    it('scopes cache and prompt context by utility category and locality', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONWithMetaMock.mockResolvedValue({
            data: {
                customer_service_phone: '1-800-555-1212',
                start_stop_service_url: 'https://example.com/start',
                main_website: 'https://example.com',
            },
            failure: null,
            groundingSourceUrls: [],
        });

        await resolveContact('Silver Spring Township', {
            category: 'sewer',
            address: '29 Clover Lane, Mechanicsburg, PA 17050',
        });

        expect(getFromCacheMock).toHaveBeenCalledWith(
            expect.stringContaining('contact:v2:gemini-test:structured-json-v2:ai:sewer:pa:170')
        );
        expect(generateJSONWithMetaMock).toHaveBeenCalledWith(
            expect.stringMatching(/Utility Category: sewer[\s\S]*Mechanicsburg/),
            { responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA }
        );
        expect(setInCacheMock).toHaveBeenCalledWith(
            expect.stringContaining('contact:v2:gemini-test:structured-json-v2:ai:sewer:pa:170'),
            expect.anything(),
            expect.any(Number)
        );
    });

    it('caches a failed contact lookup for only five minutes', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONWithMetaMock.mockResolvedValue({
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
        });

        await expect(resolveContact('Unknown Utility')).resolves.toBeNull();

        expect(setInCacheMock).toHaveBeenCalledWith(
            expect.any(String),
            { v: null },
            5 * 60
        );
    });

    it('returns fresh contact diagnostics without reading or writing cache', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONWithMetaMock.mockResolvedValue({
            data: {
                customer_service_phone: '1-800-777-9898',
                start_stop_service_url: 'https://duke-energy.com/start',
                main_website: 'https://duke-energy.com',
                hours: '24/7',
            },
            failure: null,
            groundingSourceUrls: ['https://duke-energy.com/contact'],
        });

        const result = await resolveContactFresh('Duke Energy', {
            category: 'electric',
            address: '123 Main St, Raleigh, NC 27601',
        });

        expect(result).toEqual({
            contact: {
                customer_service_phone: '1-800-777-9898',
                start_stop_service_url: 'https://duke-energy.com/start',
                main_website: 'https://duke-energy.com/',
                hours: '24/7',
            },
            failure: null,
            groundingSourceUrls: ['https://duke-energy.com/contact'],
        });
        expect(getFromCacheMock).not.toHaveBeenCalled();
        expect(setInCacheMock).not.toHaveBeenCalled();
    });
});
