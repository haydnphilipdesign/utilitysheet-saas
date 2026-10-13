import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/gemini-client', () => ({
    generateJSONWithMeta: vi.fn(),
    getGeminiModelName: () => 'gemini-test',
    getGeminiThinkingLevelName: () => 'low',
    isGeminiConfigured: vi.fn(),
}));

vi.mock('@/lib/neon/queries/ai-telemetry', () => ({
    createAiSuggestionRun: vi.fn(async () => 'run_1'),
}));

vi.mock('@/lib/cache', () => ({
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
}));

import { generateJSONWithMeta, isGeminiConfigured } from '@/lib/ai/gemini-client';
import { PROVIDER_CONTACT_RESPONSE_SCHEMA } from '@/lib/ai/response-schemas';
import { getFromCache, setInCache } from '@/lib/cache';
import { createAiSuggestionRun } from '@/lib/neon/queries/ai-telemetry';
import {
    hasValidContact,
    resolveContact,
    resolveContactFresh,
} from '@/lib/providers/contact-service';

const generateJSONWithMetaMock = vi.mocked(generateJSONWithMeta);
const isGeminiConfiguredMock = vi.mocked(isGeminiConfigured);
const getFromCacheMock = vi.mocked(getFromCache);
const setInCacheMock = vi.mocked(setInCache);
const createAiSuggestionRunMock = vi.mocked(createAiSuggestionRun);

describe('contact-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ALLOW_UNVERIFIED_AI_CONTACTS;
        getFromCacheMock.mockResolvedValue(null);
        setInCacheMock.mockResolvedValue(true);
        isGeminiConfiguredMock.mockReturnValue(true);
    });

    it('returns contact despite telemetry failure without logging provider free text or SQL errors', async () => {
        const sinks = ['log', 'warn', 'error'].map(level => vi.spyOn(console, level as 'log' | 'warn' | 'error').mockImplementation(() => undefined));
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
        generateJSONWithMetaMock.mockResolvedValue({ data: { customer_service_phone: '1-800-555-1212' }, failure: null, groundingSourceUrls: [], usage: null, failureKind: null });
        createAiSuggestionRunMock.mockRejectedValueOnce(new Error(privateText));
        expect(await resolveContact(privateText)).toMatchObject({ customer_service_phone: '1-800-555-1212' });
        const logged = JSON.stringify(sinks.flatMap(sink => sink.mock.calls));
        for (const sentinel of ['Sentinel', 'seller@example.test', 'token-sentinel', 'password-sentinel', 'postgres://sentinel']) expect(logged).not.toContain(sentinel);
        expect(logged).toContain('contact_resolved');
        expect(logged).toContain('contact_telemetry_failed');
        sinks.forEach(sink => sink.mockRestore());
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
            usage: null,
            failureKind: null,
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
            usage: null,
            failureKind: null,
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
            usage: null,
            failureKind: null,
        });

        await resolveContact('Silver Spring Township', {
            category: 'sewer',
            address: '29 Clover Lane, Mechanicsburg, PA 17050',
        });

        expect(getFromCacheMock).toHaveBeenCalledWith(
            expect.stringContaining('contact:v3:gemini-test:structured-json-v2:ai:sewer:pa:17050:mechanicsburg:')
        );
        expect(generateJSONWithMetaMock).toHaveBeenCalledWith(
            expect.stringMatching(/Utility Category: sewer[\s\S]*Mechanicsburg/),
            { responseJsonSchema: PROVIDER_CONTACT_RESPONSE_SCHEMA }
        );
        expect(setInCacheMock).toHaveBeenCalledWith(
            expect.stringContaining('contact:v3:gemini-test:structured-json-v2:ai:sewer:pa:17050:mechanicsburg:'),
            expect.anything(),
            expect.any(Number)
        );
    });

    it('keeps the same provider name in two cities of one ZIP3 in separate cache entries', async () => {
        generateJSONWithMetaMock.mockResolvedValue({
            data: { customer_service_phone: '1-800-555-1212' },
            failure: null,
            groundingSourceUrls: [],
            usage: null,
            failureKind: null,
        });

        await resolveContact('Borough Water Department', {
            category: 'water',
            address: '29 Clover Lane, Mechanicsburg, PA 17050',
        });
        await resolveContact('Borough Water Department', {
            category: 'water',
            address: '14 High St, Carlisle, PA 17013',
        });
        await resolveContact('Borough Water Department', {
            category: 'water',
            address: '410 Market St, Mechanicsburg, PA 17050',
        });

        const keys = getFromCacheMock.mock.calls.map(([key]) => key);
        expect(keys[0]).not.toBe(keys[1]);
        expect(keys[0]).toBe(keys[2]);
    });

    it('caches a failed contact lookup for only five minutes', async () => {
        process.env.ALLOW_UNVERIFIED_AI_CONTACTS = 'true';
        generateJSONWithMetaMock.mockResolvedValue({
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: null,
            failureKind: null,
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
            usage: null,
            failureKind: null,
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
        expect(createAiSuggestionRunMock).not.toHaveBeenCalled();
    });

    it('records a found contact with its usage and no provider name', async () => {
        generateJSONWithMetaMock.mockResolvedValue({
            data: { customer_service_phone: '1-800-555-1212' },
            failure: null,
            groundingSourceUrls: ['https://example.com/a'],
            usage: { promptTokens: 300, outputTokens: 40, thinkingTokens: 20, toolPromptTokens: 900, searchQueryCount: 2, sourceCount: 1 },
            failureKind: null,
        });

        await resolveContact('Borough Water Department', {
            category: 'water',
            address: '29 Clover Lane, Mechanicsburg, PA 17050',
            requestId: 'req_1',
            accountId: 'acct_1',
            organizationId: 'org_1',
        });

        expect(createAiSuggestionRunMock).toHaveBeenCalledTimes(1);
        const run = createAiSuggestionRunMock.mock.calls[0][0];
        expect(run).toMatchObject({
            feature: 'provider_contact',
            category: 'water',
            requestId: 'req_1',
            accountId: 'acct_1',
            organizationId: 'org_1',
            model: 'gemini-test',
            promptVersion: 'provider-contact-v1',
            source: 'ai_primary',
            status: 'success',
            reasonCode: null,
            attemptCount: 1,
            suggestionCount: 1,
            cacheHit: false,
            thinkingLevel: 'low',
            errorKind: null,
            localityState: 'PA',
            localityZip3: '170',
            localityCity: 'Mechanicsburg',
            usage: { promptTokens: 300, outputTokens: 40, thinkingTokens: 20, toolPromptTokens: 900, searchQueryCount: 2, sourceCount: 1 },
            suggestions: [],
        });
        const serialized = JSON.stringify(run);
        expect(serialized).not.toContain('Borough Water');
        expect(serialized).not.toContain('Clover');
        expect(serialized).not.toContain('555-1212');
    });

    it('records a contact that was not found as an empty answer, not as an error', async () => {
        generateJSONWithMetaMock.mockResolvedValue({
            data: { main_website: 'https://example.com' },
            failure: null,
            groundingSourceUrls: [],
            usage: null,
            failureKind: null,
        });

        await resolveContact('Unknown Utility', { category: 'gas' });

        expect(createAiSuggestionRunMock.mock.calls[0][0]).toMatchObject({
            feature: 'provider_contact', status: 'success', reasonCode: 'ai_empty', suggestionCount: 0, usage: null,
        });
    });

    it('records a timed-out lookup as an error with its kind', async () => {
        generateJSONWithMetaMock.mockResolvedValue({
            data: null,
            failure: 'provider_error',
            groundingSourceUrls: [],
            usage: null,
            failureKind: 'timeout',
        });

        await resolveContact('Slow Utility', { category: 'gas' });

        expect(createAiSuggestionRunMock.mock.calls[0][0]).toMatchObject({
            status: 'error', reasonCode: 'ai_provider_error', errorKind: 'timeout', suggestionCount: 0,
        });
    });

    it('records a cached contact as a cache hit with no model call', async () => {
        getFromCacheMock.mockResolvedValue({ v: { customer_service_phone: '1-800-555-1212' } });

        await resolveContact('Example Utility', { category: 'electric' });

        expect(generateJSONWithMetaMock).not.toHaveBeenCalled();
        expect(createAiSuggestionRunMock.mock.calls[0][0]).toMatchObject({
            source: 'cache', cacheHit: true, attemptCount: 0, latencyMs: 0, suggestionCount: 1, usage: null, thinkingLevel: null,
        });
    });

    it('still returns the contact when telemetry cannot be written', async () => {
        createAiSuggestionRunMock.mockRejectedValueOnce(new Error('column "prompt_tokens" does not exist'));
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        generateJSONWithMetaMock.mockResolvedValue({
            data: { customer_service_phone: '1-800-555-1212' },
            failure: null,
            groundingSourceUrls: [],
            usage: null,
            failureKind: null,
        });

        await expect(resolveContact('Example Utility')).resolves.toMatchObject({ customer_service_phone: '1-800-555-1212' });
    });
});
