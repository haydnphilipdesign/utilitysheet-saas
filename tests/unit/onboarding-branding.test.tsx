import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';

import OnboardingPage from '@/app/onboarding/page';

const routerPush = vi.fn();
const routerRefresh = vi.fn();
const mockedRouter = { push: routerPush, refresh: routerRefresh };

vi.mock('next/navigation', () => ({
    useRouter: () => mockedRouter,
}));

vi.mock('next/image', () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...props} alt={props.alt || ''} />;
    },
}));

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
            <div {...rest}>{children}</div>
        ),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

beforeEach(() => {
    routerPush.mockReset();
    routerRefresh.mockReset();
});

describe('onboarding branding step', () => {
    it('can skip onboarding from step 1 and go to dashboard', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : (input as Request).url;
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        onboarding_completed_at: null,
                        active_organization_id: null,
                    },
                    activeOrganization: null,
                    organizations: [],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/onboarding/complete' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1', onboarding_completed_at: new Date().toISOString() } }, 200);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByText('Welcome, Test!');
        fireEvent.click(screen.getByRole('button', { name: /skip setup and go straight to dashboard/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', expect.objectContaining({ method: 'POST' }));
            expect(routerPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('continues from branding by updating the default profile via PUT /api/branding/:id', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : (input as Request).url;
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        onboarding_completed_at: null,
                        active_organization_id: 'org_1',
                    },
                    activeOrganization: { id: 'org_1', name: 'Test Org' },
                    organizations: [{ id: 'org_1', name: 'Test Org', role: 'admin' }],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/branding' && method === 'GET') {
                return jsonResponse([
                    {
                        id: 'brand_1',
                        name: 'Test Org',
                        primary_color: '#10b981',
                        secondary_color: '#00a169',
                        is_default: true,
                    },
                ]);
            }

            if (url === '/api/branding/brand_1' && method === 'PUT') {
                return jsonResponse({
                    id: 'brand_1',
                    name: 'Test Org',
                    primary_color: '#10b981',
                    secondary_color: '#00a169',
                    is_default: true,
                });
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByLabelText('Brand Display Name');
        fireEvent.click(screen.getByRole('button', { name: /save & continue/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/branding/brand_1', expect.objectContaining({ method: 'PUT' }));
        });
        await screen.findByLabelText(/your name/i);

        expect(fetchMock).toHaveBeenCalledWith('/api/branding/brand_1', expect.objectContaining({ method: 'PUT' }));
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/onboarding/brand-profile'))).toBe(false);
    });

    it('skips branding without attempting to create a new profile', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : (input as Request).url;
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        onboarding_completed_at: null,
                        active_organization_id: 'org_1',
                    },
                    activeOrganization: { id: 'org_1', name: 'Test Org' },
                    organizations: [{ id: 'org_1', name: 'Test Org', role: 'admin' }],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/branding' && method === 'GET') {
                return jsonResponse([
                    {
                        id: 'brand_1',
                        name: 'Test Org',
                        primary_color: '#475569',
                        secondary_color: '#0ea5e9',
                        is_default: true,
                    },
                ]);
            }

            if (method === 'PUT' && url.startsWith('/api/branding/')) {
                return jsonResponse({ error: 'Unexpected PUT' }, 500);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByLabelText('Brand Display Name');
        fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/branding')).toBe(true);
        });
        await screen.findByLabelText(/your name/i);

        expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/onboarding/brand-profile'))).toBe(false);
    });

    it('can skip onboarding from the branding step and go to dashboard', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : (input as Request).url;
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        onboarding_completed_at: null,
                        active_organization_id: 'org_1',
                    },
                    activeOrganization: { id: 'org_1', name: 'Test Org' },
                    organizations: [{ id: 'org_1', name: 'Test Org', role: 'admin' }],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/branding' && method === 'GET') {
                return jsonResponse([
                    {
                        id: 'brand_1',
                        name: 'Test Org',
                        primary_color: '#10b981',
                        secondary_color: '#00a169',
                        is_default: true,
                    },
                ]);
            }

            if (url === '/api/onboarding/complete' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1', onboarding_completed_at: new Date().toISOString() } }, 200);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);
        await screen.findByLabelText('Brand Display Name');

        fireEvent.click(screen.getByRole('button', { name: /exit setup/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', expect.objectContaining({ method: 'POST' }));
            expect(routerPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('can skip onboarding from step 3 and go to dashboard', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : (input as Request).url;
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acc_1',
                        full_name: 'Test User',
                        email: 'test@example.com',
                        onboarding_completed_at: null,
                        active_organization_id: 'org_1',
                    },
                    activeOrganization: { id: 'org_1', name: 'Test Org' },
                    organizations: [{ id: 'org_1', name: 'Test Org', role: 'admin' }],
                    usage: { used: 0, limit: 3, plan: 'free' },
                });
            }

            if (url === '/api/branding' && method === 'GET') {
                return jsonResponse([
                    {
                        id: 'brand_1',
                        name: 'Test Org',
                        primary_color: '#475569',
                        secondary_color: '#0ea5e9',
                        is_default: true,
                    },
                ]);
            }

            if (url === '/api/onboarding/complete' && method === 'POST') {
                return jsonResponse({ account: { id: 'acc_1', onboarding_completed_at: new Date().toISOString() } }, 200);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByLabelText('Brand Display Name');
        fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

        await screen.findByLabelText(/your name/i);
        fireEvent.click(screen.getByRole('button', { name: /exit setup/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', expect.objectContaining({ method: 'POST' }));
            expect(routerPush).toHaveBeenCalledWith('/dashboard');
        });
    });
});
