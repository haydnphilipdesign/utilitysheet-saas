import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    request: vi.fn(), account: vi.fn(), sql: vi.fn(), event: vi.fn(), submit: vi.fn(),
}));
vi.mock('@/lib/ops/events');
vi.mock('server-only', () => ({}));
vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: mocks.request,
    getRequestByToken: vi.fn(),
    getAccountById: mocks.account,
    getDefaultBrandProfile: vi.fn(async () => null),
    getBrandProfile: vi.fn(async () => null),
    getOrganizationById: vi.fn(async () => null),
    getOrganizationAdminRecipients: vi.fn(async () => []),
    getReferralIdentityForm: vi.fn(async () => null),
    getMonthlyUsage: vi.fn(async () => ({ used: 0, limit: 3 })),
    createEventLog: mocks.event,
}));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/neon/queries/seller-submission', () => ({ submitSellerRequest: mocks.submit }));
vi.mock('@/lib/rate-limit', () => ({
    formSubmissionRatelimit: {}, checkRateLimit: vi.fn(async () => ({ success: true })),
    getRateLimitHeaders: vi.fn(() => ({})), isRateLimitUnavailable: vi.fn(() => false),
}));
vi.mock('@/lib/providers/contact-service', () => ({ hasValidContact: vi.fn(() => true), resolveContact: vi.fn() }));
vi.mock('@/lib/email/email-service', () => ({ sendTCCompletionNotificationEmail: vi.fn(), sendContactResolutionAlertEmail: vi.fn() }));
vi.mock('@/lib/neon/queries/ai-telemetry', () => ({ markAiSuggestionSelection: vi.fn() }));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward: vi.fn() }));

import { POST } from '@/app/api/seller/[token]/route';
import {
    filterAdvancedPacketDataByExclusions,
    getAdvancedAnswerRows,
    normalizeConditionalAdvancedAnswers,
} from '@/lib/packet/modules';
import { mergeAdvancedPacketDataPreservingExcluded } from '@/lib/submitted-sheet/editor';
import type { AdvancedModuleExclusions, AdvancedModuleKey } from '@/types';

const MODULES: AdvancedModuleKey[] = ['irrigation_seasonal_controls'];

/** The order both write boundaries use: filter, normalize, then merge. */
function writeBoundary(submitted: Record<string, unknown>, existing: Record<string, unknown>, exclusions: AdvancedModuleExclusions) {
    const visible = normalizeConditionalAdvancedAnswers(
        filterAdvancedPacketDataByExclusions(submitted, MODULES, exclusions),
        exclusions
    );
    return mergeAdvancedPacketDataPreservingExcluded({
        existingData: existing,
        submittedVisibleData: visible,
        enabledModules: MODULES,
        exclusions,
    });
}

describe('irrigation answers after a No', () => {
    it('keeps only the gate answer on an ordinary No', () => {
        const result = writeBoundary(
            { irrigation_seasonal_controls: { has_irrigation_system: 'no', irrigation_provider_name: 'GreenSprout', watering_days: ['mon', 'wed'], irrigation_notes: 'Timer in garage' } },
            {},
            {}
        );
        expect(result).toEqual({ irrigation_seasonal_controls: { has_irrigation_system: 'no' } });
    });

    it('sends the details again once the answer is back to Yes', () => {
        const details = { has_irrigation_system: 'yes', irrigation_provider_name: 'GreenSprout', watering_days: ['mon', 'wed'] };
        expect(writeBoundary({ irrigation_seasonal_controls: details }, {}, {})).toEqual({ irrigation_seasonal_controls: details });
    });

    it('does not let a hidden stored No erase visible answers when the gate question is excluded', () => {
        const exclusions = { irrigation_seasonal_controls: ['has_irrigation_system'] };
        const result = writeBoundary(
            // A stale client could still send the excluded gate; it is filtered out first.
            { irrigation_seasonal_controls: { has_irrigation_system: 'no', irrigation_provider_name: 'GreenSprout' } },
            { irrigation_seasonal_controls: { has_irrigation_system: 'no' } },
            exclusions
        );
        expect(result).toEqual({
            irrigation_seasonal_controls: { irrigation_provider_name: 'GreenSprout', has_irrigation_system: 'no' },
        });
    });

    it('leaves stored excluded detail fields untouched on a No', () => {
        const exclusions = { irrigation_seasonal_controls: ['irrigation_notes'] };
        const result = writeBoundary(
            { irrigation_seasonal_controls: { has_irrigation_system: 'no', irrigation_provider_name: 'GreenSprout' } },
            { irrigation_seasonal_controls: { irrigation_notes: 'Coordinator-only note', irrigation_provider_name: 'Old Co' } },
            exclusions
        );
        expect(result).toEqual({
            irrigation_seasonal_controls: { has_irrigation_system: 'no', irrigation_notes: 'Coordinator-only note' },
        });
    });

    it('leaves other sections and non-No answers alone', () => {
        const data = {
            irrigation_seasonal_controls: { has_irrigation_system: 'not_sure', irrigation_provider_name: 'GreenSprout' },
            mailbox_access: { garage_door_code: '0420' },
        };
        expect(normalizeConditionalAdvancedAnswers(data, {})).toBe(data);
    });
});

describe('handoff answer rows for Review', () => {
    it('uses question labels and formats coded values only', () => {
        expect(getAdvancedAnswerRows('irrigation_seasonal_controls', {
            has_irrigation_system: 'not_sure',
            watering_days: ['mon', 'wed'],
            irrigation_season_start_month: 'apr',
            irrigation_notes: 'mon and wed, controller code no_1',
        })).toEqual([
            { key: 'has_irrigation_system', label: 'Has Irrigation System', value: 'Not sure' },
            { key: 'watering_days', label: 'Watering Days', value: 'Mon, Wed' },
            { key: 'irrigation_season_start_month', label: 'Season Start Month', value: 'April' },
            { key: 'irrigation_notes', label: 'Irrigation Notes', value: 'mon and wed, controller code no_1' },
        ]);
    });

    it('shows free text and access codes exactly as typed', () => {
        expect(getAdvancedAnswerRows('mailbox_access', { garage_door_code: '0420', mailbox_number: 'no', parking_instructions: '' })).toEqual([
            { key: 'mailbox_number', label: 'Mailbox Number', value: 'no' },
            { key: 'garage_door_code', label: 'Garage Door Code', value: '0420' },
        ]);
    });

    it('hides irrigation details behind a No and skips excluded questions', () => {
        expect(getAdvancedAnswerRows('irrigation_seasonal_controls', {
            has_irrigation_system: 'no',
            irrigation_provider_name: 'GreenSprout',
        })).toEqual([{ key: 'has_irrigation_system', label: 'Has Irrigation System', value: 'No' }]);

        expect(getAdvancedAnswerRows(
            'irrigation_seasonal_controls',
            { has_irrigation_system: 'yes', irrigation_notes: 'Hidden' },
            { irrigation_seasonal_controls: ['irrigation_notes'] }
        )).toEqual([{ key: 'has_irrigation_system', label: 'Has Irrigation System', value: 'Yes' }]);
    });
});

describe('seller submission stores normalized irrigation answers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sql.mockResolvedValue([]);
        mocks.event.mockResolvedValue(undefined);
        mocks.account.mockResolvedValue({ subscription_status: 'pro', notification_preferences: {} });
        mocks.submit.mockResolvedValue({ outcome: 'ACCEPTED', request: {}, currentEditVersion: 0 });
    });

    async function submit(storedOverrides: Record<string, unknown>, irrigation: Record<string, unknown>) {
        mocks.request.mockResolvedValue({
            id: 'fixture-request', account_id: 'fixture-account', seller_token: 'seller-fixture',
            public_token: 'public-fixture', property_address: '123 Test Lane', status: 'in_progress',
            utility_categories: ['electric'], packet_mode: 'advanced',
            advanced_modules: ['irrigation_seasonal_controls'],
            ...storedOverrides,
        });
        const response = await POST(new Request('http://localhost/api/seller/seller-fixture', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                water_source: 'not_sure', sewer_type: 'not_sure', heating_type: 'not_sure', primary_heating_type: null,
                fuels_present: [], trash_handled_by: 'not_sure',
                advanced: { irrigation_seasonal_controls: irrigation },
                utilities: { electric: { entry_mode: 'unknown' } },
            }),
        }), { params: Promise.resolve({ token: 'seller-fixture' }) });
        expect(response.status).toBe(200);
        return mocks.submit.mock.calls[0][0].advancedPacketData;
    }

    it('drops visible details on No and keeps stored excluded fields', async () => {
        const stored = await submit(
            {
                advanced_module_exclusions: { irrigation_seasonal_controls: ['irrigation_notes'] },
                advanced_packet_data: { irrigation_seasonal_controls: { irrigation_notes: 'Coordinator-only note' } },
            },
            { has_irrigation_system: 'no', irrigation_provider_name: 'GreenSprout', watering_days: ['mon', 'wed'] }
        );
        expect(stored).toEqual({
            irrigation_seasonal_controls: { has_irrigation_system: 'no', irrigation_notes: 'Coordinator-only note' },
        });
    });

    it('keeps details when the answer is Yes', async () => {
        const stored = await submit({}, { has_irrigation_system: 'yes', irrigation_provider_name: 'GreenSprout', watering_days: ['mon', 'wed'] });
        expect(stored).toEqual({
            irrigation_seasonal_controls: { has_irrigation_system: 'yes', irrigation_provider_name: 'GreenSprout', watering_days: ['mon', 'wed'] },
        });
    });
});
