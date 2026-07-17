import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: sqlMock,
}));

import {
    getOrganizationAdminRecipients,
    updateOrganizationNotificationSettings,
} from '@/lib/neon/queries/organizations';

function callSqlText(call: unknown[]): string {
    const [strings] = call as [TemplateStringsArray];
    return Array.from(strings).join('');
}

function callSqlValues(call: unknown[]): unknown[] {
    return call.slice(1);
}

describe('organization notification queries', () => {
    beforeEach(() => {
        sqlMock.mockReset();
    });

    it('derives admin recipients live from current membership and excludes emailless accounts', async () => {
        sqlMock.mockResolvedValueOnce([
            { account_id: 'acct_admin', email: 'admin@example.com', full_name: 'Admin', notification_preferences: {} },
        ]);

        await getOrganizationAdminRecipients('org_1');

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        // Recipients are joined from current membership, so removed members never appear.
        expect(queryText).toContain('FROM organization_members om');
        expect(queryText).toContain('JOIN accounts a ON a.id = om.account_id');
        expect(queryText).toContain("om.role = 'admin'");
        expect(queryText).toContain('a.email IS NOT NULL');
        expect(callSqlValues(sqlMock.mock.calls[0])).toEqual(['org_1']);
    });

    it('persists workspace notification settings for a specific organization', async () => {
        sqlMock.mockResolvedValueOnce([
            { id: 'org_1', notification_settings: { notify_admins_on_submission: true } },
        ]);

        await updateOrganizationNotificationSettings('org_1', { notify_admins_on_submission: true });

        const queryText = callSqlText(sqlMock.mock.calls[0]);
        expect(queryText).toContain('UPDATE organizations');
        expect(queryText).toContain('notification_settings = ');
        expect(queryText).toContain('WHERE id = ');
        expect(callSqlValues(sqlMock.mock.calls[0])).toEqual([
            JSON.stringify({ notify_admins_on_submission: true }),
            'org_1',
        ]);
    });
});
