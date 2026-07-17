import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BrandingPage from '@/app/dashboard/branding/page';
import type { BrandProfileWithUsage } from '@/types';

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
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

function createProfile(overrides: Partial<BrandProfileWithUsage>): BrandProfileWithUsage {
    return {
        id: 'profile_1',
        account_id: 'acct_1',
        organization_id: null,
        name: 'Acme Realty',
        logo_url: null,
        primary_color: '#123456',
        secondary_color: '#654321',
        contact_name: 'Jane Smith',
        contact_phone: null,
        contact_email: 'jane@acme.test',
        contact_website: null,
        disclaimer_text: null,
        company_name: null,
        professional_title: null,
        license_number: null,
        license_state: null,
        compliance_line: null,
        message_templates: {},
        is_default: true,
        buyer_next_steps: null,
        next_steps_title: null,
        show_powered_by: true,
        show_generation_date: true,
        welcome_message: null,
        created_at: '2026-07-01T12:00:00.000Z',
        request_count: 0,
        is_intake_default: false,
        ...overrides,
    };
}

function mockFetch(profiles: BrandProfileWithUsage[]) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method || 'GET';

        if (url === '/api/branding' && method === 'GET') {
            return jsonResponse(profiles);
        }
        if (url === '/api/account' && method === 'GET') {
            return jsonResponse({
                account: { subscription_status: 'pro' },
                activeOrganization: null,
            });
        }
        if (url.endsWith('/duplicate') && method === 'POST') {
            return jsonResponse(createProfile({ id: 'profile_copy', name: 'Acme Realty (Copy)', is_default: false }), 201);
        }
        if (method === 'DELETE') {
            return jsonResponse({ success: true });
        }
        return jsonResponse({ error: 'Unexpected request' }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('BrandingPage list', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('gives each profile overflow menu an accessible name', async () => {
        mockFetch([createProfile({})]);
        render(<BrandingPage />);

        expect(await screen.findByRole('button', { name: 'Actions for Acme Realty' })).toBeTruthy();
    });

    it('shows usage and default context for each profile', async () => {
        mockFetch([
            createProfile({ request_count: 3, is_intake_default: true }),
            createProfile({ id: 'profile_2', name: 'Second Brand', is_default: false, request_count: 1 }),
        ]);
        render(<BrandingPage />);

        expect(await screen.findByText('Used by 3 requests · preselected for new requests · used by your reusable seller form')).toBeTruthy();
        expect(screen.getByText('Used by 1 request')).toBeTruthy();
        expect(screen.getByText('Seller form')).toBeTruthy();
    });

    it('duplicates a profile from the overflow menu', async () => {
        const fetchMock = mockFetch([createProfile({})]);
        render(<BrandingPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Actions for Acme Realty' }));
        fireEvent.click(await screen.findByText('Duplicate'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/branding/profile_1/duplicate', expect.objectContaining({ method: 'POST' }));
        });
        await waitFor(() => {
            expect(toastSuccessMock).toHaveBeenCalledWith('Duplicated "Acme Realty"');
        });
    });

    it('explains fallback behavior in the delete dialog and deletes on confirm', async () => {
        const fetchMock = mockFetch([
            createProfile({ request_count: 2, is_intake_default: true }),
            createProfile({ id: 'profile_2', name: 'Second Brand', is_default: false }),
        ]);
        render(<BrandingPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Actions for Acme Realty' }));
        fireEvent.click(await screen.findByText('Delete'));

        expect(await screen.findByText('Delete "Acme Realty"?')).toBeTruthy();
        expect(screen.getByText(/2 requests use this profile/)).toBeTruthy();
        expect(screen.getByText(/reusable seller form uses this profile/)).toBeTruthy();
        expect(screen.getByText(/oldest remaining profile will take over/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Delete profile/ }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/branding/profile_1', expect.objectContaining({ method: 'DELETE' }));
        });
    });
});
