import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlTagMock = vi.hoisted(() => vi.fn());
const sqlTransactionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: Object.assign(sqlTagMock, {
        transaction: sqlTransactionMock,
    }),
    generateToken: () => 'test-token',
    isDbConfigured: () => true,
}));

import { updateSubmittedRequestData } from '@/lib/neon/queries/requests';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

describe('updateSubmittedRequestData query', () => {
    beforeEach(() => {
        sqlTagMock.mockReset();
        sqlTransactionMock.mockReset();
        sqlTransactionMock.mockResolvedValue([[{ id: 'req_1' }]]);
    });

    it('matches optimistic locking timestamps at millisecond precision', async () => {
        await updateSubmittedRequestData('req_1', {
            expectedUpdatedAt: '2026-04-09T15:22:31.123Z',
            propertyAddress: '123 Main Street',
            propertyAddressStructured: null,
            advancedPacketData: {},
            utilityEntries: [],
            eventData: null,
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
        });

        expect(sqlTagMock).toHaveBeenCalledTimes(1);

        const queryText = callSqlText(sqlTagMock.mock.calls[0]);
        expect(queryText).toContain("date_trunc('milliseconds', updated_at)");
        expect(queryText).toContain("date_trunc('milliseconds', ");
        expect(queryText).not.toContain('AND updated_at = ');
    });

    it('updates home basics only when they are provided', async () => {
        const baseUpdate = {
            expectedUpdatedAt: '2026-09-14T12:00:00.000Z',
            propertyAddress: '123 Main Street',
            propertyAddressStructured: null,
            advancedPacketData: {},
            utilityEntries: [],
        };

        await updateSubmittedRequestData('req_1', {
            ...baseUpdate,
            homeBasics: { waterSource: 'well', sewerType: null, heatingType: 'natural_gas' },
        });
        await updateSubmittedRequestData('req_1', baseUpdate);

        const [withHomeBasics, withoutHomeBasics] = sqlTagMock.mock.calls;
        const queryText = callSqlText(withHomeBasics);
        expect(queryText).toContain('water_source = CASE WHEN ');
        expect(queryText).toContain('ELSE water_source END');
        expect(queryText).toContain('ELSE heating_type END');

        const withValues = withHomeBasics.slice(1);
        expect(withValues).toContain(true);
        expect(withValues).toContain('well');
        expect(withValues).toContain('natural_gas');

        const withoutValues = withoutHomeBasics.slice(1);
        expect(withoutValues).toContain(false);
        expect(withoutValues).not.toContain('well');
    });

    it('updates HOA answers only when they are provided, and keeps details only behind a Yes', async () => {
        const baseUpdate = {
            expectedUpdatedAt: '2026-10-01T12:00:00.000Z',
            propertyAddress: '123 Main Street',
            propertyAddressStructured: null,
            advancedPacketData: {},
            utilityEntries: [],
        };
        const hoa = {
            has_hoa: 'yes' as const,
            hoa_name: 'Lakeview Commons HOA',
            hoa_management_company: null,
            hoa_management_contact: null,
            hoa_management_phone: null,
            hoa_management_email: null,
            hoa_dues_amount: '$240',
            hoa_dues_frequency: 'quarterly' as const,
            hoa_portal_or_payment: null,
        };

        await updateSubmittedRequestData('req_1', { ...baseUpdate, hoa });
        await updateSubmittedRequestData('req_1', baseUpdate);
        await updateSubmittedRequestData('req_1', { ...baseUpdate, hoa: { ...hoa, has_hoa: 'no' } });

        const [withHoa, withoutHoa, changedToNo] = sqlTagMock.mock.calls;
        const queryText = callSqlText(withHoa);
        for (const column of Object.keys(hoa)) {
            expect(queryText).toContain(`${column} = CASE WHEN `);
            expect(queryText).toContain(`ELSE ${column} END`);
        }

        expect(withHoa.slice(1)).toEqual(expect.arrayContaining(['yes', 'Lakeview Commons HOA', '$240', 'quarterly']));
        expect(withoutHoa.slice(1)).not.toContain('yes');
        expect(changedToNo.slice(1)).toContain('no');
        expect(changedToNo.slice(1)).not.toContain('Lakeview Commons HOA');
        expect(changedToNo.slice(1)).not.toContain('quarterly');
    });
});
