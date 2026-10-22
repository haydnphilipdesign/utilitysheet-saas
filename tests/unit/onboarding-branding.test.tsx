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

describe('branding setup page', () => {
    it('focuses on branding and leaves the seller link and test to the dashboard', async () => {
        vi.stubGlobal('fetch', createFetchMock());
        render(<OnboardingPage />);

        expect(await screen.findByRole('heading', { level: 1, name: 'Put your brand on every sheet' })).toBeInTheDocument();
        expect(screen.getByLabelText('Brand name')).toHaveValue('Test Org');
        expect(screen.getByRole('button', { name: 'Upload logo' })).toBeInTheDocument();
        expect(screen.getByTestId('branding-preview')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
        expect(screen.getByRole('link', { name: /more branding options/i })).toHaveAttribute('href', '/dashboard/branding/brand_1');

        expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /start seller test/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/shares these branding settings/i)).not.toBeInTheDocument();
    });

    it('saves everything in one request, marks setup complete, and returns to the dashboard', async () => {
        const fetchMock = createFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        render(<OnboardingPage />);

        const brandName = await screen.findByLabelText('Brand name');
        fireEvent.change(brandName, { target: { value: 'Rivera Closings' } });
        fireEvent.click(screen.getByRole('button', { name: 'Amber' }));
        fireEvent.change(screen.getByLabelText(/website/i), { target: { value: 'rivera.example' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save and go to dashboard' }));

        await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/dashboard'));

        const putCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/branding/brand_1' && init?.method === 'PUT');
        expect(putCall).toBeDefined();
        const body = JSON.parse(String(putCall?.[1]?.body));
        expect(body).toMatchObject({
            name: 'Rivera Closings',
            primary_color: '#d97706',
            contact_name: 'Test User',
            contact_email: 'test@example.com',
            contact_website: 'https://rivera.example',
        });
        // The logo was not touched, so the stored one is left alone.
        expect(body).not.toHaveProperty('logo_url');
        expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/complete', { method: 'POST' });
    });

    it('uploads a logo and saves it with the profile', async () => {
        const fetchMock = createFetchMock();
        const base = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input) === '/api/branding/upload' && init?.method === 'POST') {
                return jsonResponse({ url: 'https://blob.example/logo.png' });
            }
            return base(input, init);
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<OnboardingPage />);

        await screen.findByRole('button', { name: 'Upload logo' });
        const file = new File(['png'], 'logo.png', { type: 'image/png' });
        fireEvent.change(screen.getByLabelText('Logo'), { target: { files: [file] } });

        expect(await screen.findByRole('img', { name: 'Current brand logo' })).toHaveAttribute('src', 'https://blob.example/logo.png');
        fireEvent.click(screen.getByRole('button', { name: 'Save and go to dashboard' }));

        await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/dashboard'));
        const putCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/branding/brand_1' && init?.method === 'PUT');
        expect(JSON.parse(String(putCall?.[1]?.body)).logo_url).toBe('https://blob.example/logo.png');
    });

    it('warns Teams members that branding is shared with the workspace', async () => {
        const base = createFetchMock();
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input) === '/api/account') {
                return jsonResponse({
                    account: { id: 'acc_1', full_name: 'Test User', email: 'test@example.com', onboarding_completed_at: null },
                    activeOrganization: { id: 'org_1', name: 'Riverbend Closings', role: 'member', subscription_status: 'team' },
                });
            }
            return base(input, init);
        }));
        render(<OnboardingPage />);

        expect(await screen.findByText(/everyone in riverbend closings shares these branding settings/i)).toBeInTheDocument();
    });
});
