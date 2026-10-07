import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    getOrCreateAccount: vi.fn(),
    getOrganizationAdminCount: vi.fn(),
    getOrganizationMemberRole: vi.fn(),
    removeOrganizationMemberWithHandover: vi.fn(),
    updateOrganizationMemberRole: vi.fn(),
    sql: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/neon/queries', () => ({
    getOrCreateAccount: mocks.getOrCreateAccount,
    getOrganizationAdminCount: mocks.getOrganizationAdminCount,
    getOrganizationMemberRole: mocks.getOrganizationMemberRole,
    removeOrganizationMemberWithHandover: mocks.removeOrganizationMemberWithHandover,
    updateOrganizationMemberRole: mocks.updateOrganizationMemberRole,
}));

import { DELETE } from '@/app/api/organization/members/[accountId]/route';
import { removeOrganizationMemberWithHandover } from '@/lib/neon/queries/organizations';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

function remove(accountId: string, body?: unknown) {
    return DELETE(
        new Request(`http://localhost/api/organization/members/${accountId}`, {
            method: 'DELETE',
            ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
        }),
        { params: Promise.resolve({ accountId }) },
    );
}

describe('DELETE /api/organization/members/[accountId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ id: 'user_1', primaryEmail: 'me@example.com' });
        mocks.getOrCreateAccount.mockResolvedValue({ id: ME, active_organization_id: 'org_1' });
        mocks.getOrganizationMemberRole.mockResolvedValue('admin');
        mocks.removeOrganizationMemberWithHandover.mockResolvedValue({
            removed: true, requestsMoved: 3, profilesMoved: 1, formsMoved: 2, recipientAccountId: ME,
        });
    });

    it('lets an admin remove someone and hands that person’s work to the admin', async () => {
        const response = await remove(OTHER);

        expect(response.status).toBe(200);
        expect(mocks.removeOrganizationMemberWithHandover).toHaveBeenCalledWith({
            organizationId: 'org_1',
            accountId: OTHER,
            recipientAccountId: null,
            preferredAccountId: ME,
        });
        await expect(response.json()).resolves.toEqual({
            success: true, left: false, requestsMoved: 3, profilesMoved: 1, formsMoved: 2, recipientAccountId: ME,
        });
    });

    it('lets a member leave, with no say over anyone else', async () => {
        mocks.getOrganizationMemberRole.mockResolvedValue('member');
        mocks.removeOrganizationMemberWithHandover.mockResolvedValue({
            removed: true, requestsMoved: 2, profilesMoved: 0, formsMoved: 0, recipientAccountId: ADMIN,
        });

        const left = await remove(ME);
        expect(left.status).toBe(200);
        expect(mocks.removeOrganizationMemberWithHandover).toHaveBeenCalledWith({
            organizationId: 'org_1',
            accountId: ME,
            recipientAccountId: null,
            preferredAccountId: null,
        });
        await expect(left.json()).resolves.toMatchObject({ left: true, recipientAccountId: ADMIN });

        mocks.removeOrganizationMemberWithHandover.mockClear();
        const other = await remove(OTHER);
        expect(other.status).toBe(403);
        expect(mocks.removeOrganizationMemberWithHandover).not.toHaveBeenCalled();
    });

    it('refuses someone who is not in the active workspace, even for themselves', async () => {
        mocks.getOrganizationMemberRole.mockResolvedValue(null);

        expect((await remove(ME)).status).toBe(403);
        expect(mocks.removeOrganizationMemberWithHandover).not.toHaveBeenCalled();
    });

    it('passes a chosen recipient through and rejects anything that is not an account id', async () => {
        await remove(OTHER, { transferTo: ADMIN });
        expect(mocks.removeOrganizationMemberWithHandover).toHaveBeenCalledWith(
            expect.objectContaining({ recipientAccountId: ADMIN }),
        );

        mocks.removeOrganizationMemberWithHandover.mockClear();
        const response = await remove(OTHER, { transferTo: 'someone' });
        expect(response.status).toBe(400);
        expect(mocks.removeOrganizationMemberWithHandover).not.toHaveBeenCalled();
    });

    it.each([
        ['last_admin', 400, 'Cannot remove the last admin'],
        ['no_recipient', 400, 'No admin can take over'],
        ['not_member', 404, 'Member not found'],
    ] as const)('reports %s without removing anyone', async (reason, status, error) => {
        mocks.removeOrganizationMemberWithHandover.mockResolvedValue({ removed: false, reason });

        const response = await remove(OTHER);
        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toMatchObject({ error });
    });

    it('tells a sole admin who tries to leave what to do first', async () => {
        mocks.removeOrganizationMemberWithHandover.mockResolvedValue({ removed: false, reason: 'last_admin' });

        const response = await remove(ME);
        await expect(response.json()).resolves.toMatchObject({
            message: 'You’re the only admin of this workspace. Make someone else an admin first, then you can leave.',
        });
    });

    it('requires a signed-in person', async () => {
        mocks.getUser.mockResolvedValue(null);
        expect((await remove(ME)).status).toBe(401);
    });
});

describe('removeOrganizationMemberWithHandover', () => {
    beforeEach(() => {
        mocks.sql.mockReset();
    });

    function queryText() {
        const [strings] = mocks.sql.mock.calls[0] as [TemplateStringsArray];
        return Array.from(strings).join('');
    }

    it('checks, hands over and removes in one statement with the workspace locked', async () => {
        mocks.sql.mockResolvedValue([{
            outcome: 'ok', removed_count: 1, requests_moved: 3, profiles_moved: 1, forms_moved: 2, cleared_count: 1, recipient_account_id: ADMIN,
        }]);

        const result = await removeOrganizationMemberWithHandover({ organizationId: 'org_1', accountId: OTHER, preferredAccountId: ADMIN });

        expect(result).toEqual({ removed: true, requestsMoved: 3, profilesMoved: 1, formsMoved: 2, recipientAccountId: ADMIN });
        expect(mocks.sql).toHaveBeenCalledTimes(1);
        const text = queryText();
        expect(text).toContain('FOR UPDATE');
        expect(text).toContain("'last_admin'");
        expect(text).toContain("'no_recipient'");
        expect(text).toContain('UPDATE requests');
        expect(text).toContain('UPDATE brand_profiles');
        expect(text).toContain('DELETE FROM organization_members');
        expect(text).toContain('SET active_organization_id = NULL');
        // Only an admin who stays can receive, and never the person being removed.
        expect(text).toMatch(/member\.role = 'admin'\s+AND member\.account_id <> /);
        // Only the owner of a shared form changes; no form is moved to another creator or deleted.
        expect(text).toContain('UPDATE intake_links');
        expect(text).toContain('SET shared_owner_account_id = (SELECT account_id FROM recipient)');
        expect(text).not.toMatch(/UPDATE intake_links\s+SET account_id/);
        expect(text).not.toContain('DELETE FROM intake_links');
    });

    it('names no recipient when nothing needed handing over', async () => {
        mocks.sql.mockResolvedValue([{
            outcome: 'ok', removed_count: 1, requests_moved: 0, profiles_moved: 0, cleared_count: 0, recipient_account_id: ADMIN,
        }]);

        await expect(removeOrganizationMemberWithHandover({ organizationId: 'org_1', accountId: OTHER }))
            .resolves.toEqual({ removed: true, requestsMoved: 0, profilesMoved: 0, formsMoved: 0, recipientAccountId: null });
    });

    it.each(['last_admin', 'no_recipient', 'not_member'] as const)('returns %s when the statement refuses', async (outcome) => {
        mocks.sql.mockResolvedValue([{ outcome, removed_count: 0, requests_moved: 0, profiles_moved: 0, recipient_account_id: null }]);

        await expect(removeOrganizationMemberWithHandover({ organizationId: 'org_1', accountId: OTHER }))
            .resolves.toEqual({ removed: false, reason: outcome });
    });
});
