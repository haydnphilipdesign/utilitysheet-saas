import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getRequestByToken: vi.fn(),
    getRequestById: vi.fn(),
    getBrandProfile: vi.fn(),
    getDefaultBrandProfile: vi.fn(),
    getUtilityEntriesByRequestId: vi.fn(),
    getAccountById: vi.fn(),
    getOrganizationById: vi.fn(),
}));

import {
    getPacketDataByPublicToken,
    getPacketDataByRequestId,
    PACKET_LOCKED_MESSAGE,
} from '@/lib/packet/packet-data';
import {
    getAccountById,
    getBrandProfile,
    getDefaultBrandProfile,
    getOrganizationById,
    getRequestById,
    getRequestByToken,
    getUtilityEntriesByRequestId,
} from '@/lib/neon/queries';

beforeEach(() => {
    vi.clearAllMocks();
    (getOrganizationById as Mock).mockResolvedValue(null);
    (getDefaultBrandProfile as Mock).mockResolvedValue(null);
    (getUtilityEntriesByRequestId as Mock).mockResolvedValue([]);
});

describe('packet-data builder', () => {
    it('returns advanced branding fields for Pro accounts', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_1',
            account_id: 'acct_1',
            organization_id: null,
            brand_profile_id: 'brand_1',
            property_address: '123 Main St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
            water_source: 'city',
            sewer_type: 'city',
            heating_type: 'gas',
        });

        (getBrandProfile as Mock).mockResolvedValue({
            id: 'brand_1',
            name: 'My Brand',
            logo_url: null,
            primary_color: '#10b981',
            contact_name: 'Taylor Agent',
            contact_email: 'me@example.com',
            contact_phone: '555-555-5555',
            contact_website: 'https://example.com',
            disclaimer_text: 'My disclaimer',
            buyer_next_steps: ['  Step A  ', 'Step B'],
            next_steps_title: 'Next for Buyers',
            show_powered_by: false,
            show_generation_date: false,
            welcome_message: 'Hi!',
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });

        const result = await getPacketDataByPublicToken('token_1');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.brand?.show_generation_date).toBe(false);
        expect(result.data.brand?.next_steps_title).toBe('Next for Buyers');
        expect(result.data.brand?.buyer_next_steps).toEqual(['Step A', 'Step B']);
        expect(result.data.brand?.show_powered_by).toBe(false);
        expect(result.data.brand?.disclaimer_text).toBe('My disclaimer');
        expect(result.data.meta.show_powered_by).toBe(false);
    });

    it('forces powered-by and strips advanced fields for non-Pro accounts', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_2',
            account_id: 'acct_2',
            organization_id: null,
            brand_profile_id: 'brand_2',
            property_address: '456 Oak St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getBrandProfile as Mock).mockResolvedValue({
            id: 'brand_2',
            name: 'My Brand',
            logo_url: null,
            primary_color: '#10b981',
            contact_name: 'Taylor Agent',
            contact_email: 'me@example.com',
            contact_phone: '555-555-5555',
            contact_website: 'https://example.com',
            disclaimer_text: 'Non-pro disclaimer',
            buyer_next_steps: ['Custom A'],
            next_steps_title: 'Custom Title',
            show_powered_by: false,
            show_generation_date: false,
            welcome_message: 'Custom welcome',
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'free' });

        const result = await getPacketDataByPublicToken('token_2');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.brand?.show_powered_by).toBe(true);
        expect(result.data.meta.show_powered_by).toBe(true);
        expect(result.data.brand?.show_generation_date).toBe(true);
        expect(result.data.brand?.buyer_next_steps).toBe(null);
        expect(result.data.brand?.next_steps_title).toBe(null);
        expect(result.data.brand?.welcome_message).toBe(null);
        expect(result.data.brand?.disclaimer_text).toBe('Non-pro disclaimer');
    });

    it('returns locked when request is overage-locked and user is not paid', async () => {
        (getRequestById as Mock).mockResolvedValue({
            id: 'req_locked',
            account_id: 'acct_locked',
            organization_id: null,
            brand_profile_id: null,
            property_address: '789 Pine St',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
            is_locked: true,
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'free' });

        const result = await getPacketDataByRequestId('req_locked');

        expect(result).toEqual({ status: 'locked', message: PACKET_LOCKED_MESSAGE });
    });

    it('returns not_submitted when request has not been submitted yet', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_3',
            account_id: 'acct_3',
            organization_id: null,
            brand_profile_id: null,
            property_address: '111 Birch St',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'sent',
        });

        const result = await getPacketDataByPublicToken('token_3');
        expect(result).toEqual({ status: 'not_submitted' });
    });

    it('maps meter_number for electric utility entries', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_4',
            account_id: 'acct_4',
            organization_id: null,
            brand_profile_id: null,
            property_address: '222 Cedar St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });
        (getUtilityEntriesByRequestId as Mock).mockResolvedValue([
            {
                category: 'electric',
                display_name: 'Grid Power',
                contact_phone: '555-111-2222',
                contact_url: 'https://grid.example.com',
                meter_number: 'MTR-9988',
            },
            {
                category: 'water',
                display_name: 'City Water',
                contact_phone: null,
                contact_url: null,
                meter_number: null,
            },
        ]);

        const result = await getPacketDataByPublicToken('token_4');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        const electric = result.data.utilities.find((utility) => utility.category === 'electric');
        const water = result.data.utilities.find((utility) => utility.category === 'water');

        expect(electric?.meter_number).toBe('MTR-9988');
        expect(water?.meter_number).toBeNull();
    });

    it('maps structured trash recycling schedule from utility entry extra', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_5',
            account_id: 'acct_5',
            organization_id: null,
            brand_profile_id: null,
            property_address: '333 Birch St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });
        (getUtilityEntriesByRequestId as Mock).mockResolvedValue([
            {
                category: 'trash',
                display_name: 'City Waste',
                contact_phone: '555-333-1111',
                extra: {
                    has_recycling: 'yes',
                    trash_pickup_day: 'thu',
                    recycling_pickup_day: 'fri',
                },
            },
        ]);

        const result = await getPacketDataByPublicToken('token_5');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.utilities[0]).toMatchObject({
            category: 'trash',
            trash_details: {
                has_recycling: 'yes',
                trash_pickup_day: 'thu',
                recycling_pickup_day: 'fri',
            },
        });
    });

    it('maps multiple trash pickup days from utility entry extra', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_7',
            account_id: 'acct_7',
            organization_id: null,
            brand_profile_id: null,
            property_address: '777 Cedar St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
        });

        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });
        (getUtilityEntriesByRequestId as Mock).mockResolvedValue([
            {
                category: 'trash',
                display_name: 'City Waste',
                extra: {
                    has_recycling: 'yes',
                    trash_pickup_days: ['mon', 'thu'],
                    trash_pickup_day: 'mon',
                    recycling_pickup_day: 'fri',
                },
            },
        ]);

        const result = await getPacketDataByPublicToken('token_7');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        expect(result.data.utilities[0].trash_details).toEqual({
            has_recycling: 'yes',
            trash_pickup_days: ['mon', 'thu'],
            trash_pickup_day: 'mon',
            recycling_pickup_day: 'fri',
        });
    });

    it('omits excluded advanced fields and drops advanced sections with zero included fields', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_6',
            account_id: 'acct_6',
            organization_id: null,
            brand_profile_id: null,
            property_address: '555 Elm St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
            packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: {
                mailbox_access: [
                    'mailbox_number',
                    'mailbox_location',
                    'parking_instructions',
                    'breaker_box_location',
                    'main_water_shutoff_location',
                ],
                service_providers: ['service_provider_notes'],
            },
            advanced_packet_data: {
                mailbox_access: {
                    mailbox_number: '12B',
                },
                service_providers: {
                    hvac_provider_name: 'Comfort Air',
                    hvac_provider_phone: '555-200-1000',
                    service_provider_notes: 'Do not include this note',
                },
            },
        });
        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });

        const result = await getPacketDataByPublicToken('token_6');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        const sections = result.data.advanced_sections || [];
        expect(sections).toHaveLength(1);
        expect(sections[0].key).toBe('service_providers');
        const fieldKeys = sections[0].fields.map((field) => field.key);
        expect(fieldKeys).toContain('hvac_provider_name');
        expect(fieldKeys).toContain('hvac_provider_phone');
        expect(fieldKeys).not.toContain('service_provider_notes');
    });

    it('normalizes advanced fields in metadata order with canonical labels and values', async () => {
        (getRequestByToken as Mock).mockResolvedValue({
            id: 'req_advanced_order',
            account_id: 'acct_advanced_order',
            organization_id: null,
            brand_profile_id: null,
            property_address: '888 Maple St, Town, ST 00000',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'submitted',
            packet_mode: 'advanced',
            advanced_modules: ['smart_home_security', 'irrigation_seasonal_controls'],
            advanced_packet_data: {
                smart_home_security: {
                    smart_home_notes: '  Keep Existing Capitalization  ',
                    smart_doorbell_brand: 'Ring',
                    security_system_brand: 'yEs',
                    smart_thermostat_brand: 'Nest',
                },
                irrigation_seasonal_controls: {
                    has_irrigation_system: 'no',
                    watering_days: [' Monday ', 'THURSDAY'],
                    irrigation_notes: ['no'],
                },
            },
        });
        (getAccountById as Mock).mockResolvedValue({ subscription_status: 'pro' });

        const result = await getPacketDataByPublicToken('token_advanced_order');

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;

        const smartHomeFields = result.data.advanced_sections
            ?.find((section) => section.key === 'smart_home_security')
            ?.fields ?? [];
        expect(smartHomeFields.map((field) => field.key)).toEqual([
            'security_system_brand',
            'smart_thermostat_brand',
            'smart_doorbell_brand',
            'smart_home_notes',
        ]);
        expect(smartHomeFields.map((field) => field.label)).toEqual([
            'Security System Brand',
            'Smart Thermostat Brand',
            'Smart Doorbell Brand',
            'Smart Home Notes',
        ]);
        expect(smartHomeFields.map((field) => field.value)).toEqual([
            'Yes',
            'Nest',
            'Ring',
            'Keep Existing Capitalization',
        ]);

        const irrigationField = result.data.advanced_sections
            ?.find((section) => section.key === 'irrigation_seasonal_controls')
            ?.fields.find((field) => field.key === 'has_irrigation_system');
        expect(irrigationField?.value).toBe('No');

        const wateringDaysField = result.data.advanced_sections
            ?.find((section) => section.key === 'irrigation_seasonal_controls')
            ?.fields.find((field) => field.key === 'watering_days');
        expect(wateringDaysField?.value).toBe(' Monday , THURSDAY');

        const irrigationNotesField = result.data.advanced_sections
            ?.find((section) => section.key === 'irrigation_seasonal_controls')
            ?.fields.find((field) => field.key === 'irrigation_notes');
        expect(irrigationNotesField?.value).toBe('No');
    });
});
