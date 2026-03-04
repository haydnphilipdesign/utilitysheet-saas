import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/dashboard/page';

vi.mock('@/lib/pdf-generator', () => ({
    generatePacketPdf: vi.fn(),
}));

const { trackEventMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    trackEventMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: trackEventMock,
}));

vi.mock('sonner', () => ({
    toast: {
        success: toastSuccessMock,
        error: toastErrorMock,
    },
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

type FetchOptions = {
    plan: 'free' | 'pro' | 'team';
    canCustomize: boolean;
    slug: string;
};

function createDashboardFetchMock(options: FetchOptions) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url.startsWith('/api/requests?page=') && method === 'GET') {
            return jsonResponse({ data: [], total: 0, page: 1, totalPages: 1, limit: 10 });
        }

        if (url === '/api/requests?stats=true' && method === 'GET') {
            return jsonResponse({
                total_requests: 0,
                draft: 0,
                sent: 0,
                in_progress: 0,
                submitted: 0,
                needs_attention: 0,
            });
        }

        if (url === '/api/account' && method === 'GET') {
            return jsonResponse({
                usage: {
                    used: 0,
                    limit: options.plan === 'free' ? 3 : 999999,
                    plan: options.plan,
                },
                account: {
                    subscription_status: options.plan === 'pro' ? 'pro' : 'free',
                },
                activeOrganization: options.plan === 'team' ? { subscription_status: 'team' } : null,
            });
        }

        if (url === '/api/intake-link' && method === 'GET') {
            return jsonResponse({
                intakeLink: {
                    slug: options.slug,
                    url: `https://www.utilitysheet.com/i/${options.slug}`,
                    is_active: true,
                },
                canCustomize: options.canCustomize,
            });
        }

        if (url === '/api/intake-link' && method === 'POST') {
            const body = JSON.parse(String(init?.body || '{}'));
            const nextSlug = String(body.slug || options.slug);
            return jsonResponse({
                intakeLink: {
                    slug: nextSlug,
                    url: `https://www.utilitysheet.com/i/${nextSlug}`,
                    is_active: true,
                },
            });
        }

        if (url === '/api/billing/checkout' && method === 'POST') {
            return jsonResponse({ error: 'Checkout unavailable for this test.' });
        }

        if (url === '/api/updates?limit=3' && method === 'GET') {
            return jsonResponse([]);
        }

        return jsonResponse({ error: 'Not found' }, 404);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
        configurable: true,
    });
});

describe('dashboard reusable seller link', () => {
    it('shows free-plan upgrade CTA and starts checkout request', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'free',
            canCustomize: false,
            slug: 'free-slug-123',
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        await screen.findByText('Reusable Seller Link');

        fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://www.utilitysheet.com/i/free-slug-123');
        });

        expect(screen.queryByRole('button', { name: /save slug/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /upgrade to pro/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({ method: 'POST' }));
        });
    });

    it('allows Pro users to edit and save slug inline', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'pro',
            canCustomize: true,
            slug: 'pro-slug',
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        const slugInput = await screen.findByDisplayValue('pro-slug');
        fireEvent.change(slugInput, { target: { value: 'updated-pro-slug' } });

        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/intake-link', expect.objectContaining({ method: 'POST' }));
        });

        const saveCall = fetchMock.mock.calls.find(
            ([url, init]) => url === '/api/intake-link' && (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(saveCall).toBeTruthy();
        const body = JSON.parse(String((saveCall?.[1] as RequestInit).body));
        expect(body.slug).toBe('updated-pro-slug');
    });
});
