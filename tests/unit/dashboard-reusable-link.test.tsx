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
    failStats?: boolean;
    // Requests the seller has started but not submitted (not in either list).
    inProgressRequests?: number;
    testDrive?: Record<string, unknown>;
    activeOrganization?: Record<string, unknown> | null;
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
            if (options.failStats) {
                return jsonResponse({ error: 'Unavailable' }, 503);
            }
            const inProgress = options.inProgressRequests || 0;
            return jsonResponse({
                total_requests: attentionRequests.length + submittedRequests.length + inProgress,
                draft: 0,
                sent: attentionRequests.length,
                in_progress: inProgress,
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
                activeOrganization: options.activeOrganization !== undefined
                    ? options.activeOrganization
                    : options.plan === 'team' ? { subscription_status: 'team' } : null,
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

        if (url === '/api/test-drive' && method === 'GET') {
            return jsonResponse(options.testDrive || { status: 'eligible' });
        }

        if (url.includes('/remind') && method === 'POST') {
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'Not found' }, 404);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
        configurable: true,
    });
});
describe('dashboard customer home', () => {
    it('guides a brand-new account through three steps instead of empty work cards', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'free',
            slug: 'free-slug-123',
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
        await screen.findByRole('heading', { name: 'Get your first utility sheet' });
        expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Dash' })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: /getting started progress/i })).toHaveAttribute('aria-valuenow', '0');
        expect(screen.getByText('0 of 3 done')).toBeInTheDocument();

        expect(screen.getByRole('heading', { name: /try it as your seller \(next step\)/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /send your link to a seller \(not started\)/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /get your first finished sheet \(not started\)/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Start seller test' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create a request for one property/i })).toHaveAttribute('href', '/dashboard/requests/new');
        expect(screen.getByRole('link', { name: /add your branding/i })).toHaveAttribute('href', '/onboarding');

        // Empty work cards and the separate test card wait until there is work.
        expect(screen.queryByRole('heading', { name: 'Needs your attention' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Recently submitted' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'See how UtilitySheet works' })).not.toBeInTheDocument();

        const copyLinkButton = screen.getByRole('button', { name: /copy reusable seller link$/i });
        const smsButton = screen.getByRole('button', { name: /copy a text message with your reusable seller link/i });
        const emailButton = screen.getByRole('button', { name: /open email with reusable seller link/i });
        const openButton = screen.getByRole('button', { name: /open reusable seller link$/i });

        expect(copyLinkButton).toHaveTextContent('Copy');
        expect(smsButton).toHaveTextContent('Text');
        expect(emailButton).toHaveTextContent('Email');
        expect(openButton).toHaveTextContent('Open');
        for (const action of [copyLinkButton, smsButton, emailButton, openButton]) {
            expect(action).toHaveClass('min-h-11');
        }

        fireEvent.click(copyLinkButton);
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://www.utilitysheet.com/i/free-slug-123');
        });

        expect(trackEventMock).toHaveBeenCalledWith('seller_link_copied', { source: 'dashboard_first_run_guide' });
        expect(screen.queryByLabelText(/branded link/i)).not.toBeInTheDocument();
    });

    it('marks steps done as the seller test finishes and a seller starts', async () => {
        vi.stubGlobal('fetch', createDashboardFetchMock({
            plan: 'free',
            slug: 'progress-slug',
            inProgressRequests: 1,
            testDrive: {
                status: 'completed',
                reviewUrl: '/packet/test-public',
                pdfUrl: '/api/packet/test-public/pdf',
                delivery: 'sent',
            },
        }));

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: /try it as your seller \(done\)/i });
        expect(screen.getByText('2 of 3 done')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /send your link to a seller \(done\)/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /get your first finished sheet \(next step\)/i })).toBeInTheDocument();
        expect(screen.getByText(/waiting on your seller/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open test sheet/i })).toHaveAttribute('href', '/packet/test-public');

        // With a request in flight, the work cards return under the guide.
        expect(screen.getByRole('heading', { name: 'Needs your attention' })).toBeInTheDocument();
    });

    it('lets the user hide the guide and bring it back', async () => {
        vi.stubGlobal('fetch', createDashboardFetchMock({ plan: 'free', slug: 'hide-slug' }));

        const { unmount } = render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Get your first utility sheet' });
        fireEvent.click(screen.getByRole('button', { name: 'Hide this guide' }));

        expect(screen.queryByRole('heading', { name: 'Get your first utility sheet' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Reusable seller link' })).toBeVisible();
        expect(trackEventMock).toHaveBeenCalledWith('first_run_guide_toggled', { hidden: true, completed_steps: 0 });

        // Remembered for this user on the next visit.
        unmount();
        render(<DashboardPage />);
        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.queryByRole('heading', { name: 'Get your first utility sheet' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /show the getting started guide/i }));
        expect(await screen.findByRole('heading', { name: 'Get your first utility sheet' })).toBeInTheDocument();
    });

    it('does not show the guide to an invited Teams member', async () => {
        vi.stubGlobal('fetch', createDashboardFetchMock({
            plan: 'team',
            slug: 'member-slug',
            activeOrganization: { id: 'org_1', name: 'Riverbend Closings', role: 'member', subscription_status: 'team' },
        }));

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.queryByRole('heading', { name: 'Get your first utility sheet' })).not.toBeInTheDocument();
    });

    it('falls back to the regular dashboard when stats cannot load', async () => {
        vi.stubGlobal('fetch', createDashboardFetchMock({ plan: 'free', slug: 'stats-slug', failStats: true }));

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.queryByRole('heading', { name: 'Get your first utility sheet' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Needs your attention' })).toBeInTheDocument();
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
            '/dashboard/requests?status=waiting'
        );
        expect(screen.getByRole('link', { name: /ready to review/i })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=submitted'
        );
        expect(screen.getByRole('link', { name: /needs attention summary/i })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=needs_attention'
        );
        expect(screen.getByText('2 of 3 free submitted sheets left this month')).toBeInTheDocument();
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
            submittedRequests: [createRequest({ id: 'done_1', status: 'submitted' })],
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.queryByRole('heading', { name: 'Get your first utility sheet' })).not.toBeInTheDocument();
        expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();

        const helpTrigger = screen.getByRole('button', { name: /how the reusable link works/i });
        fireEvent.click(helpTrigger);
        expect(await screen.findByText('Seller opens your link and enters the property address.')).toBeVisible();
        // One way to manage forms, not two.
        expect(screen.getAllByRole('link', { name: /manage (seller )?forms/i })).toHaveLength(1);
        expect(screen.queryByText('Start here')).not.toBeInTheDocument();
    });

    it('shows a retryable work-section error without hiding the share workflow', async () => {
        const fetchMock = createDashboardFetchMock({
            plan: 'pro',
            slug: 'pro-slug',
            onboardingCompleted: true,
            failAttention: true,
            submittedRequests: [createRequest({ id: 'done_1', status: 'submitted' })],
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<DashboardPage />);

        await screen.findByRole('heading', { name: 'Reusable seller link' });
        expect(screen.getByRole('alert')).toHaveTextContent('We could not load requests needing attention.');
        expect(screen.getByRole('button', { name: /try loading again/i })).toBeInTheDocument();
    });
});
