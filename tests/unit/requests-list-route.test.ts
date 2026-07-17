import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    ensureAccountActivation: vi.fn(),
    getOrganizationById: vi.fn(),
    getRequests: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUser,
    },
}));

vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: mocks.ensureAccountActivation,
}));

vi.mock('@/lib/neon/queries', () => ({
    getRequests: mocks.getRequests,
    createRequest: vi.fn(),
    getDashboardStats: vi.fn(),
    getMonthlyUsage: vi.fn(),
    getBrandProfile: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    updateRequestStatus: vi.fn(),
    createEventLog: vi.fn(),
    getRequestCountForAccount: vi.fn(),
    getOrganizationById: mocks.getOrganizationById,
}));

vi.mock('@/lib/email/email-service', () => ({
    sendSellerNotificationEmail: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    requestCreationRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: vi.fn(),
}));

import { GET } from '@/app/api/requests/route';

describe('GET /api/requests list contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'agent@example.com',
            displayName: 'Agent',
        });
        mocks.ensureAccountActivation.mockResolvedValue({
            account: {
                id: 'acct_1',
                active_organization_id: null,
                subscription_status: 'free',
            },
            activeOrganization: null,
        });
        mocks.getOrganizationById.mockResolvedValue(null);
        mocks.getRequests.mockResolvedValue({
            data: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
        });
    });

    it('passes normalized server list state and unpaid locked-search protection to the account-scoped query', async () => {
        const response = await GET(new Request(
            'http://localhost/api/requests?page=2&limit=20&q=%20Oak%20&status=needs_attention&sort=closing_date_asc'
        ));

        expect(response.status).toBe(200);
        expect(mocks.getRequests).toHaveBeenCalledWith('acct_1', undefined, {
            page: 2,
            limit: 20,
            search: 'Oak',
            status: 'needs_attention',
            sort: 'closing_date_asc',
            canViewLockedDetails: false,
        });
        await expect(response.json()).resolves.toMatchObject({
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
        });
    });

    it('whitelists invalid pagination, status, and sort values to canonical defaults', async () => {
        const response = await GET(new Request(
            'http://localhost/api/requests?page=-8&limit=500&status=deleted&sort=seller_email_desc'
        ));

        expect(response.status).toBe(200);
        expect(mocks.getRequests).toHaveBeenCalledWith('acct_1', undefined, {
            page: 1,
            limit: 20,
            search: undefined,
            status: 'all',
            sort: 'last_activity_desc',
            canViewLockedDetails: false,
        });
    });

    it('passes the active organization scope and paid locked-detail access without accepting scope from the URL', async () => {
        mocks.ensureAccountActivation.mockResolvedValue({
            account: {
                id: 'acct_1',
                active_organization_id: 'org_1',
                subscription_status: 'free',
            },
            activeOrganization: {
                id: 'org_1',
                subscription_status: 'team',
            },
        });

        const response = await GET(new Request(
            'http://localhost/api/requests?accountId=acct_other&organizationId=org_other&q=Maple'
        ));

        expect(response.status).toBe(200);
        expect(mocks.getRequests).toHaveBeenCalledWith('acct_1', 'org_1', {
            page: 1,
            limit: 20,
            search: 'Maple',
            status: 'all',
            sort: 'last_activity_desc',
            canViewLockedDetails: true,
        });
    });

    it('sanitizes locked rows while preserving pagination metadata', async () => {
        mocks.getRequests.mockResolvedValue({
            data: [{
                id: 'req_locked',
                account_id: 'acct_1',
                organization_id: null,
                property_address: 'Secret address',
                seller_name: 'Private seller',
                seller_email: 'private@example.com',
                seller_phone: '555-0100',
                public_token: 'public-secret',
                seller_token: 'seller-secret',
                status: 'submitted',
                is_locked: true,
            }],
            total: 21,
            page: 2,
            limit: 20,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
        });

        const response = await GET(new Request('http://localhost/api/requests?page=2'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            total: 21,
            page: 2,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
        });
        expect(body.data[0]).toMatchObject({
            property_address: 'Locked — upgrade to view',
            seller_name: null,
            seller_email: null,
            seller_phone: null,
            public_token: '',
            seller_token: null,
            can_edit_submitted_sheet: false,
        });
    });

    it('does not query any account scope for an unauthenticated request', async () => {
        mocks.getUser.mockResolvedValue(null);

        const response = await GET(new Request('http://localhost/api/requests?q=Oak'));

        expect(response.status).toBe(401);
        expect(mocks.getRequests).not.toHaveBeenCalled();
    });
});
