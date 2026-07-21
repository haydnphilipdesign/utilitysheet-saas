import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: vi.fn(),
}));

vi.mock('@/components/branding/UtilitySheetPdfPreview', () => ({
    default: () => <div data-testid="branding-preview">Preview</div>,
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
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
        configurable: true,
    });
});

function createFetchMock() {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/account' && method === 'GET') {
            return jsonResponse({
                account: {
                    id: 'acc_1',
                    full_name: 'Test User',
                    email: 'test@example.com',
                    onboarding_completed_at: null,
                    active_organization_id: 'org_1',
                    phone: '555-555-5555',
                },
                activeOrganization: { id: 'org_1', name: 'Test Org' },
            });
        }

        if (url === '/api/branding' && method === 'GET') {
            return jsonResponse([
                {
                    id: 'brand_1',
                    name: 'Test Org',
                    primary_color: '#10b981',
                    secondary_color: '#059669',
                    contact_name: 'Test User',
                    contact_email: 'test@example.com',
                    contact_phone: '555-555-5555',
                    contact_website: '',
                    logo_url: null,
                    is_default: true,
                },
            ]);
        }

        if (url === '/api/intake-link' && method === 'GET') {
            return jsonResponse({
                intakeLink: {
                    slug: 'test-link',
                    url: 'https://utilitysheet.com/i/test-link',
                    is_active: true,
                },
            });
        }

        if (url === '/api/onboarding/complete' && method === 'POST') {
            return jsonResponse({ account: { id: 'acc_1', onboarding_completed_at: new Date().toISOString() } }, 200);
        }

        if (url === '/api/branding/brand_1' && method === 'PUT') {
            return jsonResponse({ id: 'brand_1' });
        }

        if (url === '/api/test-drive' && method === 'GET') {
            return jsonResponse({ status: 'eligible' });
        }

        return jsonResponse({ error: 'Not found' }, 404);
    });
}

describe('progressive onboarding', () => {
    it('centers the seller link and does not show manual request creation', async () => {
        const fetchMock = createFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByText(/your seller link is ready/i);
        expect(screen.queryByText(/create my first request/i)).not.toBeInTheDocument();
    });

    it('copies the seller link and marks onboarding complete', async () => {
        const fetchMock = createFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByDisplayValue('https://utilitysheet.com/i/test-link');
        fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://utilitysheet.com/i/test-link');
            expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', expect.objectContaining({ method: 'POST' }));
        });
    });

    it('saves branding via the existing brand profile endpoint', async () => {
        const fetchMock = createFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        const brandInput = await screen.findByLabelText('Brand Display Name');
        fireEvent.change(brandInput, { target: { value: 'Updated Org' } });
        fireEvent.click(screen.getByRole('button', { name: /save branding/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/branding/brand_1', expect.objectContaining({ method: 'PUT' }));
        });
    });

    it('can finish setup and go to the dashboard', async () => {
        const fetchMock = createFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        render(<OnboardingPage />);

        await screen.findByText(/your seller link is ready/i);
        fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', expect.objectContaining({ method: 'POST' }));
            expect(routerPush).toHaveBeenCalledWith('/dashboard');
        });
    });
});
