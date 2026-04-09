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
});
