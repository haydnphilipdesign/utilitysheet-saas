import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
    searchParams: new URLSearchParams(),
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard/requests',
    useRouter: () => navigation.router,
    useSearchParams: () => navigation.searchParams,
}));

vi.mock('@/lib/pdf-generator', () => ({
    generatePacketPdf: vi.fn(),
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

import RequestsPage from '@/app/dashboard/requests/page';

const requests = [
    {
        id: 'req_draft',
        account_id: 'acct_1',
        organization_id: null,
        brand_profile_id: null,
        property_address: '101 Draft Lane',
        property_address_structured: null,
        seller_name: 'Drew Draft',
        seller_email: 'draft@example.com',
        seller_phone: null,
        closing_date: '2026-08-01',
        status: 'draft',
        public_token: 'public-draft',
        seller_token: 'seller-draft',
        packet_mode: 'simple',
        created_at: '2026-07-01T12:00:00.000Z',
        updated_at: '2026-07-02T12:00:00.000Z',
        last_activity_at: '2026-07-02T12:00:00.000Z',
    },
    {
        id: 'req_sent',
        account_id: 'acct_1',
        organization_id: null,
        brand_profile_id: null,
        property_address: '202 Sent Street',
        property_address_structured: null,
        seller_name: 'Sam Sent',
        seller_email: 'sent@example.com',
        seller_phone: null,
        closing_date: null,
        status: 'sent',
        public_token: 'public-sent',
        seller_token: 'seller-sent',
        packet_mode: 'simple',
        needs_attention: true,
        created_at: '2026-07-01T12:00:00.000Z',
        updated_at: '2026-07-02T12:00:00.000Z',
        last_activity_at: '2026-07-02T12:00:00.000Z',
    },
    {
        id: 'req_progress',
        account_id: 'acct_1',
        organization_id: null,
        brand_profile_id: null,
        property_address: '303 Progress Place',
        property_address_structured: null,
        seller_name: 'Indy Progress',
        seller_email: null,
        seller_phone: null,
        closing_date: '2026-09-15',
        status: 'in_progress',
        public_token: 'public-progress',
        seller_token: 'seller-progress',
        packet_mode: 'advanced',
        created_at: '2026-07-03T12:00:00.000Z',
        updated_at: '2026-07-04T12:00:00.000Z',
        last_activity_at: '2026-07-04T12:00:00.000Z',
    },
    {
        id: 'req_submitted',
        account_id: 'acct_1',
        organization_id: null,
        brand_profile_id: null,
        property_address: '404 Complete Court',
        property_address_structured: null,
        seller_name: 'Sasha Submitted',
        seller_email: 'submitted@example.com',
        seller_phone: null,
        closing_date: '2026-10-20',
        status: 'submitted',
        public_token: 'public-submitted',
        seller_token: 'seller-submitted',
        packet_mode: 'simple',
        can_edit_submitted_sheet: true,
        created_at: '2026-07-05T12:00:00.000Z',
        updated_at: '2026-07-06T12:00:00.000Z',
        last_activity_at: '2026-07-06T12:00:00.000Z',
    },
];

function responseWith(data = requests, overrides: Record<string, unknown> = {}) {
    return Promise.resolve(new Response(JSON.stringify({
        data,
        total: data.length,
        page: 1,
        limit: 20,
        totalPages: data.length > 0 ? 1 : 0,
        hasPreviousPage: false,
        hasNextPage: false,
        ...overrides,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));
}

describe('Requests workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        navigation.searchParams = new URLSearchParams();
        vi.stubGlobal('fetch', vi.fn(() => responseWith()));
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it('fetches the complete server list state from the URL and renders navigable property links', async () => {
        navigation.searchParams = new URLSearchParams(
            'page=2&q=Oak&status=sent&sort=created_desc'
        );
        vi.mocked(fetch).mockImplementation(() => responseWith([requests[1]], {
            total: 21,
            page: 2,
            totalPages: 2,
            hasPreviousPage: true,
        }));

        render(<RequestsPage />);

        expect(await screen.findAllByRole('link', { name: '202 Sent Street' })).not.toHaveLength(0);
        expect(fetch).toHaveBeenCalledWith(
            '/api/requests?page=2&limit=20&q=Oak&status=sent&sort=created_desc',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(screen.getByText('21 requests')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });

    it('writes filter, sort, and debounced search changes to predictable URLs', async () => {
        render(<RequestsPage />);
        await screen.findAllByText('101 Draft Lane');

        fireEvent.change(screen.getByLabelText('Filter by status'), {
            target: { value: 'needs_attention' },
        });
        expect(navigation.router.push).toHaveBeenCalledWith(
            '/dashboard/requests?status=needs_attention',
            { scroll: false }
        );

        fireEvent.change(screen.getByLabelText('Sort requests'), {
            target: { value: 'closing_date_asc' },
        });
        expect(navigation.router.push).toHaveBeenCalledWith(
            '/dashboard/requests?sort=closing_date_asc',
            { scroll: false }
        );

        fireEvent.change(screen.getByRole('searchbox', { name: 'Search requests' }), {
            target: { value: 'Maple' },
        });
        await waitFor(() => {
            expect(navigation.router.replace).toHaveBeenCalledWith(
                '/dashboard/requests?q=Maple',
                { scroll: false }
            );
        }, { timeout: 1000 });
    });

    it('shows status-specific actions on mobile cards using only existing capabilities', async () => {
        render(<RequestsPage />);
        await screen.findAllByText('101 Draft Lane');

        const draftCard = screen.getByTestId('request-mobile-req_draft');
        expect(within(draftCard).getByRole('link', { name: 'Continue' })).toHaveAttribute(
            'href',
            '/dashboard/requests/req_draft'
        );

        const sentCard = screen.getByTestId('request-mobile-req_sent');
        expect(within(sentCard).getByRole('button', { name: 'Copy seller link' })).toBeEnabled();
        expect(within(sentCard).getByRole('button', { name: 'Send reminder' })).toBeEnabled();
        expect(within(sentCard).getByText('Needs attention')).toBeInTheDocument();

        const progressCard = screen.getByTestId('request-mobile-req_progress');
        expect(within(progressCard).getByRole('button', { name: 'Copy seller link' })).toBeEnabled();
        expect(within(progressCard).queryByRole('button', { name: 'Send reminder' })).not.toBeInTheDocument();

        const submittedCard = screen.getByTestId('request-mobile-req_submitted');
        expect(within(submittedCard).getByRole('link', { name: 'Review' })).toHaveAttribute(
            'href',
            '/dashboard/requests/req_submitted'
        );
        expect(within(submittedCard).getByRole('link', { name: 'Open packet' })).toHaveAttribute(
            'href',
            '/packet/public-submitted'
        );
        expect(within(submittedCard).getByRole('button', { name: 'Download PDF' })).toBeEnabled();
        expect(within(submittedCard).getByRole('link', { name: 'Edit submitted sheet' })).toHaveAttribute(
            'href',
            '/dashboard/requests/req_submitted/edit'
        );
    });

    it('distinguishes no-data and filtered-zero states and offers a clear-filter action', async () => {
        vi.mocked(fetch).mockImplementation(() => responseWith([]));
        const { unmount } = render(<RequestsPage />);

        expect(await screen.findByText('No requests yet')).toBeInTheDocument();
        unmount();

        navigation.searchParams = new URLSearchParams('q=Missing&status=submitted');
        render(<RequestsPage />);

        expect(await screen.findByText('No matching requests')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(navigation.router.push).toHaveBeenCalledWith('/dashboard/requests', { scroll: false });
    });

    it('renders an accessible error state and retries the same server query', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Failed' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockImplementationOnce(() => responseWith());

        render(<RequestsPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load requests');
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findAllByText('101 Draft Lane')).not.toHaveLength(0);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
