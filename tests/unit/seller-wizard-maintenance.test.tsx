import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSuggestion, UtilityCategory } from '@/types';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
}));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/telemetry/seller-observer', () => ({
    createSellerObserver: () => ({ observe: () => undefined, attach: () => () => undefined }),
}));

import { SellerWizard } from '@/components/seller-form/SellerWizard';

const TOKEN = 'seller-wizard-maintenance-test-token';
const SUBMIT_URL = `/api/seller/${TOKEN}`;
const SUGGESTIONS_URL = `/api/seller/${TOKEN}/suggestions`;
const SEARCH_URL = `/api/seller/${TOKEN}/suggestions/search`;
const SEND_LINK_URL = `/api/seller/${TOKEN}/send-link`;
const STATUS_URL = '/api/maintenance';
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;

const allSuggestions = {
    electric: [{ display_name: 'Sentinel Electric', confidence: 0.9 }],
    water: [{ display_name: 'Sentinel Water Authority', confidence: 0.9 }],
    internet: [], gas: [], sewer: [], trash: [], cable: [], propane: [], oil: [],
} as Record<UtilityCategory, ProviderSuggestion[]>;
const electricOnly = { electric: allSuggestions.electric } as Record<UtilityCategory, ProviderSuggestion[]>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });
const paused = (expectedBackAt: string | null = null) =>
    json({ error: 'server wording', code: 'MAINTENANCE', maintenance: true, expectedBackAt }, 503, { 'X-UtilitySheet-Maintenance': '1', 'Retry-After': '1800' });

type Route = (url: string, init?: RequestInit) => Response | undefined;
let route: Route;
let status: 'paused' | 'open';
let fetchMock: ReturnType<typeof vi.fn>;
const pathOf = (url: unknown) => String(url).split('?')[0];
const callsTo = (path: string, method = 'GET') =>
    fetchMock.mock.calls.filter(([url, init]) => pathOf(url) === path && ((init as RequestInit | undefined)?.method ?? 'GET') === method);

function renderWizard(suggestions = allSuggestions) {
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
        />
    );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function toWaterStep() {
    click(/get started/i);
    click(/public water/i);
    click(/septic system/i);
    click(/^continue$/i);
    click(/sentinel electric/i);
}
function toReview() {
    toWaterStep();
    click(/sentinel water authority/i);
}

describe('SellerWizard during a maintenance pause', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        status = 'open';
        route = () => undefined;
        fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            if (pathOf(url) === STATUS_URL) return json({ maintenance: status === 'paused', expectedBackAt: null });
            return route(pathOf(url), init) ?? json({ success: true });
        });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps the answers when a submit is refused, never resends, and sends once the seller submits again', async () => {
        let refuse = true;
        route = (url, init) => (url === SUBMIT_URL && init?.method === 'POST' && refuse ? paused() : undefined);
        status = 'paused';
        renderWizard();
        toReview();
        click(/submit/i);

        const banner = await screen.findByTestId('seller-maintenance-banner');
        expect(banner).toHaveAttribute('role', 'alert');
        expect(banner).toHaveTextContent('Not sent yet: paused for maintenance');
        expect(banner).toHaveTextContent('They are still on this page.');
        expect(banner).toHaveTextContent('Nothing is sent until you do.');
        expect(banner).not.toHaveTextContent('server wording');
        expect(banner).not.toHaveTextContent('We expect to be back');
        // Not presented as a failure, and the answers are still on screen.
        expect(screen.queryByTestId('review-submit-error')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeInTheDocument();
        expect(screen.getByText('Sentinel Electric')).toBeInTheDocument();
        expect(screen.getByText('Sentinel Water Authority')).toBeInTheDocument();

        // The draft was written, so the guidance says so.
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toContain('Sentinel Water Authority'));
        await waitFor(() => expect(screen.getByTestId('seller-maintenance-draft')).toHaveTextContent('stored in this browser on this device, not on our servers'));
        expect(callsTo(SUBMIT_URL, 'POST')).toHaveLength(1);

        // Checking while still paused changes nothing and sends nothing.
        fireEvent.click(screen.getByTestId('seller-maintenance-banner-check'));
        await waitFor(() => expect(screen.getByTestId('seller-maintenance-banner-check-result')).toHaveTextContent('Still paused.'));
        expect(callsTo(SUBMIT_URL, 'POST')).toHaveLength(1);

        // Once it is over the notice clears, and the submit is still the seller's to make.
        status = 'open';
        refuse = false;
        fireEvent.click(screen.getByTestId('seller-maintenance-banner-check'));
        await waitFor(() => expect(screen.queryByTestId('seller-maintenance-banner')).not.toBeInTheDocument());
        expect(screen.getByTestId('seller-maintenance-over')).toHaveTextContent('We’re back. Tap Submit to send your answers.');
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(callsTo(SUBMIT_URL, 'POST')).toHaveLength(1);
        expect(screen.getByText('Sentinel Electric')).toBeInTheDocument();

        click(/submit/i);
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Review and Submit' })).not.toBeInTheDocument());
        const submissions = callsTo(SUBMIT_URL, 'POST').map(([, init]) => JSON.parse(String((init as RequestInit).body)));
        expect(submissions).toHaveLength(2);
        // Same answers, same idempotency key: the server would recognize a repeat.
        expect(submissions[1].submission_key).toBe(submissions[0].submission_key);
        expect(submissions[1].utilities.water.display_name).toBe('Sentinel Water Authority');
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it('says to keep the page open when this browser cannot store the answers', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
        route = (url, init) => (url === SUBMIT_URL && init?.method === 'POST' ? paused() : undefined);
        renderWizard();
        toReview();
        click(/submit/i);

        await screen.findByTestId('seller-maintenance-banner');
        await waitFor(() => expect(screen.getByTestId('seller-maintenance-draft')).toHaveTextContent('Keep this page open'));
        expect(screen.getByTestId('seller-maintenance-banner')).not.toHaveTextContent('stored in this browser');
        expect(screen.getByText('Sentinel Water Authority')).toBeInTheDocument();
    });

    it('shows the estimate only when the server sent one', async () => {
        route = (url, init) => (url === SUBMIT_URL && init?.method === 'POST' ? paused('2099-01-01T00:00:00.000Z') : undefined);
        renderWizard();
        toReview();
        click(/submit/i);
        expect(await screen.findByTestId('seller-maintenance-banner')).toHaveTextContent(/We expect to be back around /);
    });

    it('recognizes a pause enforced in front of the app, which cannot mark its refusal', async () => {
        route = (url, init) => (url === SUBMIT_URL && init?.method === 'POST' ? new Response('Forbidden', { status: 403 }) : undefined);
        status = 'paused';
        renderWizard();
        toReview();
        click(/submit/i);
        expect(await screen.findByTestId('seller-maintenance-banner')).toHaveTextContent('Not sent yet');
        expect(screen.queryByTestId('review-submit-error')).not.toBeInTheDocument();
    });

    it('keeps the ordinary failure message, with retry, for an ordinary server error', async () => {
        route = (url, init) => (url === SUBMIT_URL && init?.method === 'POST' ? json({ error: 'boom' }, 500) : undefined);
        renderWizard();
        toReview();
        click(/submit/i);
        expect(await screen.findByTestId('review-submit-error')).toHaveTextContent('We couldn’t send your info.');
        expect(screen.queryByTestId('seller-maintenance-banner')).not.toBeInTheDocument();
        expect(screen.getByTestId('review-submit-retry')).toBeInTheDocument();
    });

    it('shows paused suggestions as paused, not as an empty list, and loads them once the pause ends', async () => {
        let refuse = true;
        route = (url) => {
            if (url !== SUGGESTIONS_URL) return undefined;
            return refuse ? paused() : json({ suggestions: { water: allSuggestions.water } });
        };
        status = 'paused';
        renderWizard(electricOnly);
        toWaterStep();

        const banner = await screen.findByTestId('seller-maintenance-banner');
        expect(banner).toHaveAttribute('role', 'status');
        expect(banner).toHaveTextContent('you can keep filling in your answers');
        expect(await screen.findByTestId('seller-suggestions-paused')).toHaveTextContent('we can’t suggest providers right now');
        expect(screen.getByRole('heading', { name: 'Provider suggestions are paused' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Help us find your provider' })).not.toBeInTheDocument();
        // The seller is not blocked: a typed name or "not sure" still works.
        expect(screen.getByRole('button', { name: 'Type provider name' })).toBeEnabled();
        expect(screen.getByTestId('seller-utility-skip-water')).toBeEnabled();
        const before = callsTo(SUGGESTIONS_URL).length;

        status = 'open';
        refuse = false;
        fireEvent.click(screen.getByTestId('seller-maintenance-banner-check'));
        expect(await screen.findByRole('button', { name: /sentinel water authority/i })).toBeInTheDocument();
        expect(screen.queryByTestId('seller-suggestions-paused')).not.toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-banner')).not.toBeInTheDocument();
        expect(screen.getByTestId('seller-maintenance-over')).toHaveTextContent('We’re back.');
        expect(callsTo(SUGGESTIONS_URL).length).toBe(before + 1);
        expect(callsTo(SUBMIT_URL, 'POST')).toHaveLength(0);
    });

    it.each([
        ['an empty list', () => json({ suggestions: { water: [] } })],
        ['a failed request', () => json({ error: 'Failed to fetch suggestions' }, 500)],
    ])('keeps the ordinary wording for %s', async (_label, respond) => {
        route = (url) => (url === SUGGESTIONS_URL ? respond() : undefined);
        renderWizard(electricOnly);
        toWaterStep();
        expect(await screen.findByRole('heading', { name: 'Help us find your provider' })).toBeInTheDocument();
        expect(screen.queryByTestId('seller-suggestions-paused')).not.toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-banner')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Search Providers' })).toBeInTheDocument();
    });

    it('shows a paused lookup as paused, not as no matches, and still accepts the typed name', async () => {
        route = (url) => {
            if (url === SUGGESTIONS_URL) return json({ suggestions: { water: [] } });
            if (url === SEARCH_URL) return paused();
            return undefined;
        };
        renderWizard(electricOnly);
        toWaterStep();
        fireEvent.click(await screen.findByRole('button', { name: 'Search Providers' }));
        fireEvent.change(screen.getByTestId('seller-provider-search-input'), { target: { value: 'zzqx waterworks' } });
        fireEvent.click(screen.getByTestId('seller-provider-search-run'));

        expect(await screen.findByTestId('seller-search-paused')).toHaveTextContent('Provider lookup is paused for a short planned update. You can still use this name.');
        expect(screen.queryByText(/no matches in our directory/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('seller-maintenance-banner')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('seller-provider-use-typed'));
        expect(await screen.findByRole('heading', { name: 'Review and Submit' })).toBeInTheDocument();
        expect(screen.getByText('zzqx waterworks')).toBeInTheDocument();
    });

    it('keeps "no matches" for a lookup that ran and found nothing', async () => {
        route = (url) => {
            if (url === SUGGESTIONS_URL) return json({ suggestions: { water: [] } });
            if (url === SEARCH_URL) return json([]);
            return undefined;
        };
        renderWizard(electricOnly);
        toWaterStep();
        fireEvent.click(await screen.findByRole('button', { name: 'Search Providers' }));
        fireEvent.change(screen.getByTestId('seller-provider-search-input'), { target: { value: 'zzqx waterworks' } });
        fireEvent.click(screen.getByTestId('seller-provider-search-run'));
        expect(await screen.findByText(/no matches in our directory/i)).toBeInTheDocument();
        expect(screen.queryByTestId('seller-search-paused')).not.toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-banner')).not.toBeInTheDocument();
    });

    it('explains a paused return-link email and how to come back without it', async () => {
        route = (url, init) => (url === SEND_LINK_URL && init?.method === 'POST' ? paused() : undefined);
        renderWizard();
        click(/get started/i);
        fireEvent.click(screen.getByTestId('seller-save-link-open'));
        fireEvent.change(screen.getByTestId('seller-save-link-email'), { target: { value: 'seller@example.test' } });
        fireEvent.click(screen.getByTestId('seller-save-link-send'));

        const alert = await screen.findByText(/Emailing this link is paused for a short planned update, so nothing was sent\./);
        expect(alert).toHaveAttribute('role', 'alert');
        expect(alert).toHaveTextContent('bookmark or copy it to come back later');
        expect(screen.queryByText(/Sent! Check your inbox/)).not.toBeInTheDocument();
        expect(callsTo(SEND_LINK_URL, 'POST')).toHaveLength(1);
    });
});
