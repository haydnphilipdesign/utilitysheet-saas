import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
}));

import { getDueActivationOutreachCandidates } from '@/lib/neon/queries/activation-outreach';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

describe('activation outreach candidate query', () => {
    beforeEach(() => {
        sqlMock.mockReset();
        sqlMock.mockResolvedValue([]);
    });

    it('does not select the 15-minute stage after any activation reminder has been sent', async () => {
        await getDueActivationOutreachCandidates(50);

        const queryText = callSqlText(sqlMock.mock.calls[0]);

        expect(queryText).toContain("log.stage IN ('after_15m', 'after_1d')");
    });
});
