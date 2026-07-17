import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/dashboard/page';
import type { Request } from '@/types';

vi.mock('@/lib/pdf-generator', () => ({
    generatePacketPdf: vi.fn(),
}));

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        id: 'user_dash',
        displayName: 'Dash User',
        primaryEmail: 'dash@example.com',
    }),
}));

vi.mock('@/components/referrals/referral-credit-card', () => ({
    ReferralCreditCard: () => <div data-testid="dashboard-referral-card">Referral promotion</div>,
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

function createRequest(overrides: Partial<Request>): Request {
    return {
        id: 'request_1',
        account_id: 'account_1',
        organization_id: null,
        brand_profile_id: null,
        property_address: '101 Main Street',
        property_address_structured: null,
        seller_name: 'Seller One',
        seller_email: 'seller@example.com',
        seller_phone: null,
        closing_date: '2026-08-01T12:00:00.000Z',
        status: 'sent',
        public_token: 'public_1',
        seller_token: 'seller_1',
        created_at: '2026-07-01T12:00:00.000Z',
        updated_at: '2026-07-10T12:00:00.000Z',
        last_activity_at: '2026-07-10T12:00:00.000Z',
        ...overrides,
    };
}

type FetchOptions = {
    plan: 'free' | 'pro' | 'team';
    slug: string;
    onboardingCompleted?: boolean;
    attentionRequests?: Request[];
    submittedRequests?: Request[];
    failAttention?: boolean;
};

function createDashboardFetchMock(options: FetchOptions) {
    const attentionRequests = options.attentionRequests || [];
    const submittedRequests = options.submittedRequests || [];

    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/requests?status=needs_attention&sort=last_activity_desc&page=1&limit=4' && method === 'GET') {
            if (options.failAttention) {
                return jsonResponse({ error: 'Unavailable' }, 503);
            }
            return jsonResponse({
                data: attentionRequests,
                total: attentionRequests.length,
                page: 1,
                totalPages: 1,
                limit: 4,
            });
        }

        if (url === '/api/requests?status=submitted&sort=last_activity_desc&page=1&limit=4' && method === 'GET') {
            return jsonResponse({
                data: submittedRequests,
                total: submittedRequests.length,
                page: 1,
                totalPages: 1,
                limit: 4,
            });
        }

        if (url === '/api/requests?stats=true' && method === 'GET') {
            return jsonResponse({
                total_requests: attentionRequests.length + submittedRequests.length,
                draft: 0,
                sent: attentionRequests.length,
                in_progress: 0,
                submitted: submittedRequests.length,
                needs_attention: attentionRequests.length,
            });
        }

        if (url === '/api/account' && method === 'GET') {
            return jsonResponse({
                usage: {
                    used: options.plan === 'free' ? 1 : 0,
                    limit: options.plan === 'free' ? 3 : 999999,
                    plan: options.plan,
                },
                account: {
                    subscription_status: options.plan === 'pro' ? 'pro' : 'free',
                    onboarding_completed_at: options.onboardingCompleted ? '2026-05-04T12:00:00.000Z' : null,
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
            });
        }

        if (url === '/api/updates?limit=3' && method === 'GET') {
            return jsonResponse([]);
        }

        if (url.includes('/remind') && method === 'POST') {
            return jsonResponse({ success: true });
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
describe('dashboard customer home', () => {
    it('shows a compact first-run share workflow with all essential actions', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'free',
            slug: 'free-slug-123',
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
        await screen.findByRole('heading', { name: 'Your seller link is ready' });

        expect(screen.getByRole('button', { name: /copy reusable seller link$/i })).toHaveTextContent('Copy');
        expect(screen.getByRole('button', { name: /copy reusable seller link sms message/i })).toHaveTextContent('SMS');
        expect(screen.getByRole('button', { name: /open email with reusable seller link/i })).toHaveTextContent('Email');
        expect(screen.getByRole('button', { name: /open reusable seller link$/i })).toHaveTextContent('Open');

        fireEvent.click(screen.getByRole('button', { name: /copy reusable seller link$/i }));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://www.utilitysheet.com/i/free-slug-123');
        });

        expect(screen.getByText('Seller enters the property address')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /finish optional setup/i })).toHaveAttribute('href', '/onboarding');
        expect(screen.getByRole('link', { name: /manage seller link settings/i })).toHaveAttribute(
            'href',
            '/dashboard/settings?tab=link'
        );
        expect(screen.queryByLabelText(/branded link/i)).not.toBeInTheDocument();
    });

    it('puts active work before promotion and links summaries to canonical request filters', async () => {
        const attentionRequest = createRequest({
            id: 'attention_1',
            property_address: '12 Attention Avenue',
            status: 'sent',
            needs_attention: true,
        });
        const submittedRequest = createRequest({
            id: 'submitted_1',
            property_address: '44 Submitted Street',
            status: 'submitted',
            public_token: 'submitted_public',
            seller_token: 'submitted_seller',
        });
        const fetchMock = createDashboardFetchMock({
            plan: 'free',
            slug: 'pro-link',
            onboardingCompleted: true,
            attentionRequests: [attentionRequest],
            submittedRequests: [submittedRequest],
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        const attentionHeading = await screen.findByRole('heading', { name: 'Needs your attention' });
        const recentHeading = screen.getByRole('heading', { name: 'Recently submitted' });
        const referral = screen.getByTestId('dashboard-referral-card');

        expect(attentionHeading.compareDocumentPosition(recentHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(recentHeading.compareDocumentPosition(referral)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        expect(screen.getByRole('link', { name: /12 attention avenue/i })).toHaveAttribute(
            'href',
            '/dashboard/requests/attention_1'
        );
        expect(screen.getByRole('link', { name: /44 submitted street/i })).toHaveAttribute(
            'href',
            '/dashboard/requests/submitted_1'
        );
        expect(screen.getByRole('button', { name: /copy seller link/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^review$/i })).toHaveAttribute(
            'href',
            '/dashboard/requests/submitted_1'
        );

        expect(screen.getByRole('link', { name: /waiting on seller/i })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=sent'
        );
        expect(screen.getByRole('link', { name: /ready to review/i })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=submitted'
        );
        expect(screen.getByRole('link', { name: /needs attention summary/i })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=needs_attention'
        );
        expect(screen.getByText('2 of 3 requests remaining this month')).toBeInTheDocument();
        expect(screen.queryByTestId('dashboard-new-request')).not.toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/requests?status=needs_attention&sort=last_activity_desc&page=1&limit=4'
        );
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/requests?status=submitted&sort=last_activity_desc&page=1&limit=4'
        );
    });

    it('keeps ongoing help collapsed and uses deliberate empty states', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'pro',
            slug: 'pro-slug',
            onboardingCompleted: true,
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
        expect(screen.getByText('No submitted sheets yet')).toBeInTheDocument();

        const helpTrigger = screen.getByRole('button', { name: /how the reusable link works/i });
        fireEvent.click(helpTrigger);
        expect(await screen.findByText('Seller opens your link and enters the property address.')).toBeVisible();
        expect(screen.getByRole('link', { name: /manage seller link settings/i })).toHaveAttribute(
            'href',
            '/dashboard/settings?tab=link'
        );
    });

    it('shows a retryable work-section error without hiding the share workflow', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'pro',
            slug: 'pro-slug',
            onboardingCompleted: true,
            failAttention: true,
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.getByRole('alert')).toHaveTextContent('We could not load requests needing attention.');
        expect(screen.getByRole('button', { name: /retry dashboard work/i })).toBeInTheDocument();
    });
});
