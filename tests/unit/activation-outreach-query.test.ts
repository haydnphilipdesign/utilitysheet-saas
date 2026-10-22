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

    it('targets only open accounts from the last 7 days with no real request', async () => {
        await getDueActivationOutreachCandidates(50);

        const queryText = callSqlText(sqlMock.mock.calls[0]);

        expect(queryText).toContain("a.created_at >= NOW() - INTERVAL '7 days'");
        expect(queryText).toContain("a.closure_status = 'active'");
        expect(queryText).toContain('COALESCE(rc.request_count, 0) = 0');
        // Opening the setup page no longer decides who gets the emails.
        expect(queryText).not.toContain('onboarding_completed_at');
    });

    it('reports seller-test completion and waits 6 hours after a failed send', async () => {
        await getDueActivationOutreachCandidates(50);

        const queryText = callSqlText(sqlMock.mock.calls[0]);

        expect(queryText).toContain('AS test_drive_completed');
        expect(queryText).toContain("failed.status = 'failed'");
        expect(queryText).toContain("> NOW() - INTERVAL '6 hours'");
    });
});
