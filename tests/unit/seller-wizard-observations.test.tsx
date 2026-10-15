import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSuggestion, UtilityCategory } from '@/types';
import { sellerObservationEventSchema } from '@/lib/validation/schemas';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
}));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));

// The wizard is tested against a recording observer; one test swaps in the real helper.
const observerMock = vi.hoisted(() => ({
    observed: [] as Array<Record<string, unknown>>,
    created: [] as Array<{ token: string; editVersion: number; enabled: boolean }>,
    useReal: false,
}));
vi.mock('@/lib/telemetry/seller-observer', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/telemetry/seller-observer')>();
    return {
        ...actual,
        createSellerObserver: (options: { token: string; editVersion: number; enabled: boolean }) => {
            observerMock.created.push(options);
            if (observerMock.useReal) return actual.createSellerObserver(options);
            return {
                observe: (event: Record<string, unknown>) => { if (options.enabled) observerMock.observed.push(event); },
                attach: () => () => undefined,
            };
        },
    };
});

import { SellerWizard } from '@/components/seller-form/SellerWizard';

const TOKEN = 'seller-wizard-observation-test-token';
const SUBMIT_URL = `/api/seller/${TOKEN}`;
const OBSERVATION_URL = `/api/seller/${TOKEN}/observations`;

const allSuggestions = {
    electric: [{ display_name: 'Sentinel Electric', confidence: 0.9 }, { display_name: 'Second Electric', confidence: 0.8 }],
    water: [{ display_name: 'Sentinel Water Authority', confidence: 0.9 }],
    internet: [], gas: [], sewer: [], trash: [], cable: [], propane: [], oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;

type Route = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let route: Route;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function renderWizard(props: Partial<React.ComponentProps<typeof SellerWizard>> = {}, suggestions = allSuggestions) {
    return render(
        <SellerWizard
            token={TOKEN}
            initialRequestData={{
                property_address: '12 Sentinel Street',
                utility_categories: ['electric', 'water'],
                collect_electric_meter_number: false,
                collect_hoa_questions: false,
                packet_mode: 'simple',
                advanced_modules: [],
                advanced_packet_data: {},
            }}
            initialSuggestions={suggestions}
            {...props}
        />
    );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const types = () => observerMock.observed.map((event) => event.type);
const ofType = (type: string) => observerMock.observed.filter((event) => event.type === type);
const stepLabel = (event: Record<string, unknown>) => [event.step, event.category].filter(Boolean).join(':');

function toReview() {
    click(/get started/i);
    click(/public water/i);
    click(/septic system/i);
    click(/^continue$/i);
    click(/sentinel electric/i);
    click(/sentinel water authority/i);
}

describe('SellerWizard diagnostic observations', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        observerMock.observed.length = 0;
        observerMock.created.length = 0;
        observerMock.useReal = false;
        route = () => undefined;
        fetchMock = vi.fn(async (url: string, init?: RequestInit) => (await route(String(url), init)) ?? json({ success: true }));
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reports each step once, in order, with counts and no answers', async () => {
        renderWizard();
        toReview();
        expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeInTheDocument();
        click(/submit/i);
        await waitFor(() => expect(ofType('seller_step_viewed').map(stepLabel)).toContain('success'));

        expect(ofType('seller_step_viewed').map(stepLabel)).toEqual(
            ['welcome', 'home_basics', 'utility:electric', 'utility:water', 'review', 'success']);
        expect(ofType('seller_step_completed').map(stepLabel)).toEqual(
            ['welcome', 'home_basics', 'utility:electric', 'utility:water']);
        expect(ofType('seller_suggestions_rendered')).toEqual([
            expect.objectContaining({ category: 'electric', source: 'initial', result_count: 2 }),
            expect.objectContaining({ category: 'water', source: 'initial', result_count: 1 }),
        ]);
        expect(ofType('seller_submission_attempted')).toEqual([{ type: 'seller_submission_attempted', attempt: 1 }]);
        expect(types()).not.toContain('seller_submission_failed');

        // Every observation satisfies the server contract once the helper adds its envelope.
        for (const event of observerMock.observed) {
            const withEnvelope = { ...event, id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', seq: 0, ...(event.type === 'seller_step_viewed' ? { visit: 'first' } : {}) };
            expect(sellerObservationEventSchema.safeParse(withEnvelope).success, JSON.stringify(event)).toBe(true);
        }
        expect(JSON.stringify(observerMock.observed)).not.toMatch(/sentinel|12 /i);
        expect(observerMock.created[0]).toEqual({ token: TOKEN, editVersion: 0, enabled: true });
    });

    it('reports going back as another view, not another completion', () => {
        renderWizard();
        toReview();
        click(/^back$/i);
        expect(ofType('seller_step_viewed').map(stepLabel)).toEqual(
            ['welcome', 'home_basics', 'utility:electric', 'utility:water', 'review', 'utility:water']);
        expect(ofType('seller_step_completed')).toHaveLength(4);

        fireEvent.click(screen.getByTestId('seller-utility-keep-water'));
        expect(ofType('seller_step_viewed').map(stepLabel).slice(-1)).toEqual(['review']);
        expect(ofType('seller_step_completed').map(stepLabel).slice(-1)).toEqual(['utility:water']);
    });

    it.each([
        ['a server error', () => json({ error: 'private sentinel detail' }, 500), 'server_error', 500],
        ['a rate limit', () => json({ error: 'Too many' }, 429), 'rate_limited', 429],
        ['a validation refusal', () => json({ code: 'INVALID_SELLER_SUBMISSION' }, 400), 'validation', 400],
        ['an unavailable limiter', () => json({ error: 'Temporarily unavailable' }, 503), 'unavailable', 503],
    ] as const)('reports %s on the original attempt and counts the retry', async (_label, respond, code, status) => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let calls = 0;
        route = (url) => (url === SUBMIT_URL && ++calls === 1 ? respond() : undefined);
        renderWizard();
        toReview();
        click(/submit/i);
        await screen.findByTestId('review-submit-error');
        expect(ofType('seller_submission_failed')).toEqual([
            { type: 'seller_submission_failed', attempt: 1, error_code: code, status, duration: expect.any(String) },
        ]);

        fireEvent.click(screen.getByTestId('review-submit-retry'));
        await waitFor(() => expect(ofType('seller_step_viewed').map(stepLabel)).toContain('success'));
        expect(ofType('seller_submission_attempted').map((event) => event.attempt)).toEqual([1, 2]);
        expect(ofType('seller_submission_failed')).toHaveLength(1);
        expect(JSON.stringify(observerMock.observed)).not.toContain('sentinel');
    });

    it.each([
        ['ALREADY_SUBMITTED', 'already_submitted'],
        ['STALE_SESSION', 'stale_session'],
    ] as const)('reports the terminal %s refusal and stops observing steps', async (refusal, code) => {
        route = (url) => (url === SUBMIT_URL ? json({ code: refusal }, 409) : undefined);
        renderWizard();
        toReview();
        click(/submit/i);
        await waitFor(() => expect(ofType('seller_submission_failed')).toHaveLength(1));
        expect(ofType('seller_submission_failed')[0]).toMatchObject({ error_code: code, status: 409, attempt: 1 });
        expect(ofType('seller_step_viewed').map(stepLabel)).not.toContain('success');
    });

    it('reports an offline submit, distinct from an interrupted one', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
        route = (url) => { if (url === SUBMIT_URL) throw new TypeError('Failed to fetch'); return undefined; };
        renderWizard();
        toReview();
        click(/submit/i);
        await screen.findByTestId('review-submit-error');
        onLine.mockReturnValue(true);
        fireEvent.click(screen.getByTestId('review-submit-retry'));
        await waitFor(() => expect(ofType('seller_submission_failed')).toHaveLength(2));
        expect(ofType('seller_submission_failed').map((event) => [event.attempt, event.error_code, event.status])).toEqual([
            [1, 'offline', undefined], [2, 'network', undefined],
        ]);
    });

    it('separates a failed suggestion load from an empty list', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        route = (url) => {
            if (url.includes('/suggestions?categories=electric')) return json({ error: 'private sentinel' }, 503);
            if (url.includes('/suggestions?categories=water')) return json({ suggestions: { water: [] } });
            return undefined;
        };
        renderWizard({}, {} as Record<UtilityCategory, ProviderSuggestion[]>);
        click(/get started/i);
        // Home Basics asks for the first provider step's suggestions in advance; electric is always first.
        await waitFor(() => expect(ofType('seller_suggestions_failed')).toHaveLength(1));
        expect(ofType('seller_suggestions_failed')[0]).toEqual({
            type: 'seller_suggestions_failed', category: 'electric', source: 'initial',
            error_code: 'unavailable', status: 503, duration: expect.any(String),
        });
        expect(types()).not.toContain('seller_suggestions_rendered');

        click(/public water/i);
        click(/septic system/i);
        click(/^continue$/i);
        await waitFor(() => expect(ofType('seller_suggestions_rendered')).toHaveLength(1));
        expect(ofType('seller_suggestions_rendered')[0]).toMatchObject({ category: 'electric', result_count: 0, empty_reason: 'load_failed' });

        fireEvent.click(screen.getByTestId('seller-utility-skip-electric'));
        await waitFor(() => expect(ofType('seller_suggestions_rendered')).toHaveLength(2));
        expect(ofType('seller_suggestions_rendered')[1]).toMatchObject({ category: 'water', result_count: 0, empty_reason: 'no_suggestions' });
        expect(ofType('seller_suggestions_failed')).toHaveLength(1);
    });

    it('reports search results by count and search failures by code, never the query', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const responses = [
            () => json([{ display_name: 'Sentinel Result One', confidence: 0.5 }, { display_name: 'Sentinel Result Two', confidence: 0.4 }]),
            () => json([]),
            () => json({ error: 'Too many attempts' }, 429),
        ];
        route = (url) => (url.includes('/suggestions/search') ? responses.shift()?.() : undefined);
        renderWizard();
        click(/get started/i);
        click(/public water/i);
        click(/septic system/i);
        click(/^continue$/i);
        click(/search for another/i);
        // Let the default loaded subset commit before replacing it with typed text.
        await waitFor(() => expect(observerMock.observed.filter(event => event.source === 'search')).toHaveLength(1));

        for (const query of ['zzsentinelone', 'zzsentineltwo', 'zzsentinelthree']) {
            fireEvent.change(screen.getByTestId('seller-provider-search-input'), { target: { value: query } });
            fireEvent.click(screen.getByTestId('seller-provider-search-run'));
            await waitFor(() => expect(screen.queryByTestId('seller-provider-search-run')).not.toBeInTheDocument());
        }
        await waitFor(() => expect(observerMock.observed.filter((event) => event.source === 'search')).toHaveLength(4));
        expect(observerMock.observed.filter((event) => event.source === 'search')).toEqual([
            { type: 'seller_suggestions_rendered', category: 'electric', source: 'search', result_count: 2, duration: expect.any(String) },
            { type: 'seller_suggestions_rendered', category: 'electric', source: 'search', result_count: 2, duration: expect.any(String) },
            { type: 'seller_suggestions_rendered', category: 'electric', source: 'search', result_count: 0, empty_reason: 'no_results', duration: expect.any(String) },
            { type: 'seller_suggestions_failed', category: 'electric', source: 'search', error_code: 'rate_limited', status: 429, duration: expect.any(String) },
        ]);
        expect(JSON.stringify(observerMock.observed)).not.toMatch(/sentinel/i);
    });

    it('does not report the step that was on screen before a saved draft loaded', async () => {
        localStorage.setItem(`us_seller_draft:${TOKEN}`, JSON.stringify({
            v: 2, editVersion: 0, currentStep: 1, utilityIndex: 0, advancedModuleIndex: 0, navigationMode: 'linear',
            reviewedAdvancedModules: [], submissionAttempt: null,
            state: { water_source: 'city', sewer_type: 'septic', fuels_present: [], optional_utilities: [], utilities: {} },
        }));
        renderWizard();
        await screen.findByRole('heading', { name: 'Home Basics' });
        await waitFor(() => expect(ofType('seller_step_viewed')).toHaveLength(1));
        expect(ofType('seller_step_viewed').map(stepLabel)).toEqual(['home_basics']);
    });

    it('creates a disabled observer for the public demo and previews', async () => {
        renderWizard({ isDemo: true });
        toReview();
        click(/submit/i);
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Review and Submit' })).not.toBeInTheDocument(), { timeout: 3000 });
        expect(observerMock.created.every((options) => options.enabled === false)).toBe(true);
        expect(observerMock.observed).toHaveLength(0);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/observations'))).toBe(false);
    });

    it.each(['rejects', 'never answers', 'answers 500'] as const)('still submits when the observation endpoint %s', async (failure) => {
        observerMock.useReal = true;
        route = (url) => {
            if (url !== OBSERVATION_URL) return undefined;
            if (failure === 'rejects') throw new TypeError('blocked by client');
            if (failure === 'never answers') return new Promise<Response>(() => {});
            return json({ error: 'down' }, 500);
        };
        renderWizard();
        toReview();
        // The real helper sends its first batch after a short pause.
        await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === OBSERVATION_URL)).toBe(true), { timeout: 4000 });

        click(/submit/i);
        await waitFor(() => {
            expect(screen.queryByText(/sending your info/i)).not.toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        });
        await waitFor(() => expect(localStorage.getItem(`us_seller_draft:${TOKEN}`)).toBeNull());
        expect(screen.queryByTestId('review-submit-error')).not.toBeInTheDocument();
        expect(screen.queryByText(/sending your info/i)).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => url === SUBMIT_URL)).toHaveLength(1);
    }, 10_000);
});
