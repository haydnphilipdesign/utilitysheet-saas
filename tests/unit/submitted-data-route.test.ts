import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    getRequestByIdMock: vi.fn(),
    getUtilityEntriesByRequestIdMock: vi.fn(),
    updateSubmittedRequestDataMock: vi.fn(),
    buildStructuredPropertyAddressMock: vi.fn(),
    getClientIpOrNullMock: vi.fn(),
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
    getUtilityEntriesByRequestId: mocks.getUtilityEntriesByRequestIdMock,
    updateSubmittedRequestData: mocks.updateSubmittedRequestDataMock,
}));

vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: mocks.buildStructuredPropertyAddressMock,
}));

vi.mock('@/lib/network/client-ip', () => ({
    getClientIpOrNull: mocks.getClientIpOrNullMock,
}));

import { GET, PATCH } from '@/app/api/requests/[id]/submitted-data/route';

describe('submitted sheet editor route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_1',
            primaryEmail: 'agent@example.com',
            displayName: 'Agent',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'pro',
            active_organization_id: null,
            notification_preferences: {
                collect_electric_meter_number: true,
            },
        });
        mocks.getOrganizationByIdMock.mockResolvedValue(null);
        mocks.getClientIpOrNullMock.mockReturnValue('127.0.0.1');
        mocks.buildStructuredPropertyAddressMock.mockResolvedValue({
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
            full: '123 Main St, Austin, TX 78701',
            confidence: 'high',
            issues: [],
            source: 'local',
        });
    });

    it('returns submitted editor data for a paid user', async () => {
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            property_address: '123 Main St',
            seller_name: 'Seller',
            seller_email: 'seller@example.com',
            seller_phone: '555-111-2222',
            closing_date: '2026-04-12',
            status: 'submitted',
            updated_at: '2026-03-31T12:00:00.000Z',
            packet_mode: 'simple',
            utility_categories: ['electric', 'water'],
            advanced_modules: [],
            advanced_module_exclusions: {},
            advanced_packet_data: {},
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'electric',
        });
        mocks.getUtilityEntriesByRequestIdMock.mockResolvedValue([
            {
                id: 'entry_1',
                request_id: 'req_1',
                category: 'electric',
                entry_mode: 'free_text',
                display_name: 'Austin Energy',
                raw_text: 'Austin Energy',
                meter_number: 'ABC-123',
                canonical_id: null,
                confidence_score: null,
                contact_phone: '(555) 111-2222',
                contact_url: 'https://utility.example.com',
                extra: {},
                created_at: '',
                updated_at: '',
            },
        ]);

        const response = await GET(
            new Request('http://localhost/api/requests/req_1/submitted-data'),
            { params: Promise.resolve({ id: 'req_1' }) }
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.request.propertyAddress).toBe('123 Main St');
        expect(body.editor.utilities.electric.providerName).toBe('Austin Energy');
        expect(body.editor.utilities.electric.meterNumber).toBe('ABC-123');
    });

    it('blocks free users from editing submitted sheets', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_1',
            subscription_status: 'free',
            active_organization_id: null,
            notification_preferences: {},
        });
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            status: 'submitted',
        });

        const response = await PATCH(
            new Request('http://localhost/api/requests/req_1/submitted-data', {
                method: 'PATCH',
                body: JSON.stringify({
                    updatedAt: '2026-03-31T12:00:00.000Z',
                    propertyAddress: '123 Main St',
                    advanced: {},
                    utilities: {},
                }),
            }),
            { params: Promise.resolve({ id: 'req_1' }) }
        );

        expect(response.status).toBe(403);
        expect(mocks.updateSubmittedRequestDataMock).not.toHaveBeenCalled();
    });

    it('preserves excluded advanced fields and records changed summary when saving', async () => {
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            property_address: '123 Main St',
            seller_name: 'Seller',
            seller_email: 'seller@example.com',
            seller_phone: null,
            closing_date: '2026-04-12',
            status: 'submitted',
            updated_at: '2026-03-31T12:00:00.000Z',
            packet_mode: 'advanced',
            utility_categories: ['electric'],
            advanced_modules: ['mailbox_access'],
            advanced_module_exclusions: { mailbox_access: ['breaker_box_location'] },
            advanced_packet_data: {
                mailbox_access: {
                    mailbox_number: '12',
                    breaker_box_location: 'Basement storage room',
                },
            },
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'electric',
        });
        mocks.getUtilityEntriesByRequestIdMock
            .mockResolvedValueOnce([
                {
                    id: 'entry_1',
                    request_id: 'req_1',
                    category: 'electric',
                    entry_mode: 'free_text',
                    display_name: 'Old Power',
                    raw_text: 'Old Power',
                    meter_number: 'ABC-123',
                    canonical_id: null,
                    confidence_score: null,
                    contact_phone: '',
                    contact_url: '',
                    extra: {},
                    created_at: '',
                    updated_at: '',
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'entry_2',
                    request_id: 'req_1',
                    category: 'electric',
                    entry_mode: 'free_text',
                    display_name: 'New Power',
                    raw_text: 'New Power',
                    meter_number: 'ABC-123',
                    canonical_id: null,
                    confidence_score: null,
                    contact_phone: '(555) 123-4567',
                    contact_url: 'https://newpower.example.com',
                    extra: {},
                    created_at: '',
                    updated_at: '',
                },
            ]);
        mocks.updateSubmittedRequestDataMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            property_address: '123 Main Street',
            seller_name: 'Seller',
            seller_email: 'seller@example.com',
            seller_phone: null,
            closing_date: '2026-04-12',
            status: 'submitted',
            updated_at: '2026-03-31T12:10:00.000Z',
            packet_mode: 'advanced',
            utility_categories: ['electric'],
            advanced_modules: ['mailbox_access'],
            advanced_module_exclusions: { mailbox_access: ['breaker_box_location'] },
            advanced_packet_data: {
                mailbox_access: {
                    mailbox_number: '48B',
                    breaker_box_location: 'Basement storage room',
                },
            },
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'electric',
        });

        const response = await PATCH(
            new Request('http://localhost/api/requests/req_1/submitted-data', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: '2026-03-31T12:00:00.000Z',
                    propertyAddress: '123 Main Street',
                    advanced: {
                        mailbox_access: {
                            mailbox_number: '48B',
                        },
                    },
                    utilities: {
                        electric: {
                            providerName: 'New Power',
                            contactPhone: '(555) 123-4567',
                            contactUrl: 'newpower.example.com',
                            meterNumber: 'ABC-123',
                            trashDetails: {
                                hasRecycling: '',
                                trashPickupDay: '',
                                recyclingPickupDay: '',
                            },
                        },
                    },
                }),
            }),
            { params: Promise.resolve({ id: 'req_1' }) }
        );

        expect(response.status).toBe(200);
        expect(mocks.updateSubmittedRequestDataMock).toHaveBeenCalledTimes(1);

        const updateCall = mocks.updateSubmittedRequestDataMock.mock.calls[0][1];
        expect(updateCall.advancedPacketData).toEqual({
            mailbox_access: {
                mailbox_number: '48B',
                breaker_box_location: 'Basement storage room',
            },
        });
        expect(updateCall.eventData.changed_fields).toEqual([
            'property_address',
            'utility_electric',
            'advanced_mailbox_access',
        ]);
    });

    it('returns conflict when the request was edited elsewhere', async () => {
        mocks.getRequestByIdMock.mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            property_address: '123 Main St',
            seller_name: 'Seller',
            seller_email: 'seller@example.com',
            seller_phone: null,
            closing_date: '2026-04-12',
            status: 'submitted',
            updated_at: '2026-03-31T12:00:00.000Z',
            packet_mode: 'simple',
            utility_categories: ['electric'],
            advanced_modules: [],
            advanced_module_exclusions: {},
            advanced_packet_data: {},
            water_source: 'city',
            sewer_type: 'public',
            heating_type: 'electric',
        });
        mocks.getUtilityEntriesByRequestIdMock.mockResolvedValue([
            {
                id: 'entry_1',
                request_id: 'req_1',
                category: 'electric',
                entry_mode: 'free_text',
                display_name: 'Old Power',
                raw_text: 'Old Power',
                meter_number: '',
                canonical_id: null,
                confidence_score: null,
                contact_phone: '',
                contact_url: '',
                extra: {},
                created_at: '',
                updated_at: '',
            },
        ]);
        mocks.updateSubmittedRequestDataMock.mockResolvedValue(null);

        const response = await PATCH(
            new Request('http://localhost/api/requests/req_1/submitted-data', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: '2026-03-31T12:00:00.000Z',
                    propertyAddress: '123 Main Street',
                    advanced: {},
                    utilities: {
                        electric: {
                            providerName: 'New Power',
                            contactPhone: '',
                            contactUrl: '',
                            meterNumber: '',
                            trashDetails: {
                                hasRecycling: '',
                                trashPickupDay: '',
                                recyclingPickupDay: '',
                            },
                        },
                    },
                }),
            }),
            { params: Promise.resolve({ id: 'req_1' }) }
        );

        expect(response.status).toBe(409);
    });
});
