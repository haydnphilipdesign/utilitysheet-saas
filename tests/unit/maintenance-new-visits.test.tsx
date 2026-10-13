import React, { Suspense } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import SellerFormPage from '@/app/s/[token]/page';
import { DashboardMaintenanceBanner } from '@/components/maintenance/DashboardMaintenanceBanner';
import { IntakeLinkScreen } from '@/components/intake/IntakeLinkScreen';

const TOKEN = 'maintenance-new-visit-test-token';
const SELLER_URL = `/api/seller/${TOKEN}`;
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let status: { maintenance: boolean; expectedBackAt: string | null } | 'error';
let sellerResponse: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const openRequest = () => json({
    request: { property_address: '12 Sentinel Street', utility_categories: ['electric'], status: 'in_progress', edit_version: 0 },
    brandProfile: { name: 'Sentinel Realty', contact_email: 'team@example.test' },
    suggestions: {},
});
const answer = (url: string): Response => {
    const path = String(url).split('?')[0];
    if (path === '/api/maintenance') return status === 'error' ? json({ error: 'down' }, 500) : json(status);
    if (path === SELLER_URL) return sellerResponse();
    return json({ suggestions: {} });
};
const callsTo = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).split('?')[0] === path);

async function renderPage() {
    const params = Promise.resolve({ token: TOKEN });
    await act(async () => {
        render(<Suspense fallback={null}><SellerFormPage params={params} /></Suspense>);
    });
}

beforeEach(() => {
    localStorage.clear();
    status = { maintenance: true, expectedBackAt: null };
    sellerResponse = openRequest;
    fetchMock = vi.fn(async (url: string) => answer(url));
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('opening a seller form during a maintenance pause', () => {
    it('shows a paused screen instead of the form, and no invalid-link wording', async () => {
        await renderPage();
        const screenNotice = await screen.findByTestId('seller-maintenance-screen');
        expect(screen.getByRole('heading', { name: 'This form is paused for maintenance' })).toBeInTheDocument();
        expect(screenNotice).toHaveTextContent('Nothing is wrong with your link.');
        expect(screenNotice).toHaveTextContent('Please open this same link again a little later.');
        expect(screenNotice).not.toHaveTextContent('We expect to be back');
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByText(/This link isn’t working/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
        // No draft in this browser, so nothing is said about saved answers.
        expect(screen.queryByTestId('seller-maintenance-draft')).not.toBeInTheDocument();
        // The agent's contact details are still offered.
        expect(screen.getByText('team@example.test')).toBeInTheDocument();
        // The wizard never started, so no paused endpoint was called.
        expect(callsTo(`${SELLER_URL}/suggestions`)).toHaveLength(0);
    });

    it('mentions answers already in this browser, and keeps them', async () => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 2, editVersion: 0, state: { water_source: 'city' }, currentStep: 1 }));
        await renderPage();
        expect(await screen.findByTestId('seller-maintenance-draft')).toHaveTextContent('stored in this browser on this device, not on our servers');
        expect(localStorage.getItem(DRAFT_KEY)).toContain('water_source');
    });

    it('shows the configured estimate', async () => {
        status = { maintenance: true, expectedBackAt: '2099-01-01T00:00:00.000Z' };
        await renderPage();
        expect(await screen.findByTestId('seller-maintenance-screen')).toHaveTextContent(/We expect to be back around /);
    });

    it('stays paused on "Check again" until the pause is over, then opens the form', async () => {
        await renderPage();
        fireEvent.click(await screen.findByTestId('seller-maintenance-screen-check'));
        await waitFor(() => expect(screen.getByTestId('seller-maintenance-screen-check-result')).toHaveTextContent('Still paused.'));
        expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();

        status = 'error';
        fireEvent.click(screen.getByTestId('seller-maintenance-screen-check'));
        await waitFor(() => expect(screen.getByTestId('seller-maintenance-screen-check-result')).toHaveTextContent('We couldn’t check just now.'));

        status = { maintenance: false, expectedBackAt: null };
        fireEvent.click(screen.getByTestId('seller-maintenance-screen-check'));
        expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-screen')).not.toBeInTheDocument();
    });

    it('opens the form as usual when there is no pause or the status cannot be read', async () => {
        status = { maintenance: false, expectedBackAt: null };
        await renderPage();
        expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-screen')).not.toBeInTheDocument();
    });

    it('does not hide the form when the status endpoint fails', async () => {
        status = 'error';
        await renderPage();
        expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('still reports a link that really is invalid, and a form that was already sent', async () => {
        sellerResponse = () => json({ error: 'Request not found' }, 404);
        await renderPage();
        expect(await screen.findByText(/We couldn’t find this form/)).toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-screen')).not.toBeInTheDocument();
    });

    it('shows a sent form as sent, not as paused', async () => {
        sellerResponse = () => json({ request: { property_address: '12 Sentinel Street', status: 'submitted', edit_version: 0, is_demo: false }, brandProfile: null, suggestions: {} });
        await renderPage();
        expect(await screen.findByTestId('seller-notice-submitted')).toBeInTheDocument();
        expect(screen.queryByTestId('seller-maintenance-screen')).not.toBeInTheDocument();
    });
});

describe('opening a reusable seller link during a maintenance pause', () => {
    const INTAKE_API = '/api/intake/sentinel-realty';
    const withIntake = () => {
        fetchMock.mockImplementation(async (url: string) => (String(url) === INTAKE_API
            ? json({ accepting: true, brandProfile: { name: 'Sentinel Realty' }, sellerHeading: null, sellerIntro: null })
            : answer(url)));
    };

    it('shows the paused screen instead of the address form and starts nothing', async () => {
        withIntake();
        render(<IntakeLinkScreen apiPath={INTAKE_API} />);
        const notice = await screen.findByTestId('intake-maintenance-screen');
        expect(notice).toHaveTextContent('this form can’t be started right now');
        expect(notice).toHaveTextContent('Nothing is wrong with your link.');
        expect(screen.queryByText(/This link isn’t working/)).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(callsTo(`${INTAKE_API}/start`)).toHaveLength(0);

        fireEvent.click(screen.getByTestId('intake-maintenance-screen-check'));
        await waitFor(() => expect(screen.getByTestId('intake-maintenance-screen-check-result')).toHaveTextContent('Still paused.'));

        status = { maintenance: false, expectedBackAt: null };
        fireEvent.click(screen.getByTestId('intake-maintenance-screen-check'));
        await waitFor(() => expect(screen.queryByTestId('intake-maintenance-screen')).not.toBeInTheDocument());
        expect(callsTo(`${INTAKE_API}/start`)).toHaveLength(0);
    });

    it('still reports a paused or unknown link as such', async () => {
        fetchMock.mockImplementation(async (url: string) => (String(url) === INTAKE_API
            ? json({ error: 'Not found' }, 404)
            : json({ maintenance: true, expectedBackAt: null })));
        render(<IntakeLinkScreen apiPath={INTAKE_API} />);
        expect(await screen.findByText(/This link isn’t working/)).toBeInTheDocument();
        expect(screen.queryByTestId('intake-maintenance-screen')).not.toBeInTheDocument();
    });
});

describe('dashboard maintenance banner', () => {
    it('tells signed-in users what is paused, only during a pause', async () => {
        const { unmount } = render(<DashboardMaintenanceBanner />);
        const banner = await screen.findByTestId('dashboard-maintenance-banner');
        expect(banner).toHaveAttribute('role', 'status');
        expect(banner).toHaveTextContent('Sellers can’t send their forms and PDF downloads are paused');
        expect(banner).not.toHaveTextContent('We expect to be back');
        unmount();

        status = { maintenance: false, expectedBackAt: null };
        render(<DashboardMaintenanceBanner />);
        await waitFor(() => expect(callsTo('/api/maintenance').length).toBe(2));
        expect(screen.queryByTestId('dashboard-maintenance-banner')).not.toBeInTheDocument();
    });
});
