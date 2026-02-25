import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getRequestByIdMock: vi.fn(),
    updateRequestConfigurationMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getUser: mocks.getUserMock,
    },
}));

vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    getRequestById: mocks.getRequestByIdMock,
    updateRequestConfiguration: mocks.updateRequestConfigurationMock,
}));

import { PATCH } from '@/app/api/requests/[id]/configuration/route';

describe('PATCH /api/requests/[id]/configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'agent@example.com', displayName: 'Agent' });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
        });
        mocks.getOrganizationByIdMock.mockResolvedValue(null);
    });

    it('updates configuration when request is draft', async () => {
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            status: 'draft',
        });
        mocks.updateRequestConfigurationMock.mockResolvedValue({
            id: 'req_1',
            packet_mode: 'advanced',
            advanced_modules: ['lawn_exterior'],
        });

        const response = await PATCH(
            new Request('http://localhost/api/requests/req_1/configuration', {
                method: 'PATCH',
                body: JSON.stringify({
                    packetMode: 'advanced',
                    advancedModules: ['lawn_exterior'],
                }),
            }),
            { params: Promise.resolve({ id: 'req_1' }) }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.packet_mode).toBe('advanced');
        expect(mocks.updateRequestConfigurationMock).toHaveBeenCalled();
    });

    it('blocks updates after seller opened request', async () => {
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_2',
            account_id: 'acct_1',
            organization_id: null,
            status: 'in_progress',
        });

        const response = await PATCH(
            new Request('http://localhost/api/requests/req_2/configuration', {
                method: 'PATCH',
                body: JSON.stringify({
                    packetMode: 'simple',
                }),
            }),
            { params: Promise.resolve({ id: 'req_2' }) }
        );

        expect(response.status).toBe(409);
        expect(mocks.updateRequestConfigurationMock).not.toHaveBeenCalled();
    });
});
