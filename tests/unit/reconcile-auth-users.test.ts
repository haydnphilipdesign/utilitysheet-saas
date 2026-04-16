import { beforeEach, describe, expect, it, vi } from 'vitest';

const stackServerAppMock = vi.hoisted(() => ({
    listUsers: vi.fn(),
}));

const queryMocks = vi.hoisted(() => ({
    getAccountsByAuthUserIds: vi.fn(),
}));

const ensureAccountActivationMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({
    stackServerApp: stackServerAppMock,
}));
vi.mock('@/lib/neon/queries', () => queryMocks);
vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: ensureAccountActivationMock,
}));

import { reconcileAuthUsers } from '@/lib/activation/reconcile-auth-users';

describe('reconcileAuthUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dry-runs missing users and skips unverified auth records by default', async () => {
        const users = [
            {
                id: 'auth_existing',
                primaryEmail: 'existing@example.com',
                primaryEmailVerified: true,
                displayName: 'Existing User',
                signedUpAt: new Date('2026-03-20T10:00:00.000Z'),
            },
            {
                id: 'auth_missing_verified',
                primaryEmail: 'verified@example.com',
                primaryEmailVerified: true,
                displayName: 'Verified Missing',
                signedUpAt: new Date('2026-03-21T10:00:00.000Z'),
            },
            {
                id: 'auth_missing_unverified',
                primaryEmail: 'unverified@example.com',
                primaryEmailVerified: false,
                displayName: 'Unverified Missing',
                signedUpAt: new Date('2026-03-22T10:00:00.000Z'),
            },
        ] as unknown as Array<Record<string, unknown>> & { nextCursor: string | null };
        users.nextCursor = 'next_cursor_123';

        stackServerAppMock.listUsers.mockResolvedValue(users);
        queryMocks.getAccountsByAuthUserIds.mockResolvedValue([
            { id: 'acc_existing', auth_user_id: 'auth_existing', email: 'existing@example.com' },
        ]);

        const result = await reconcileAuthUsers({ limit: 50 });

        expect(result.dryRun).toBe(true);
        expect(result.scanned).toBe(3);
        expect(result.missingCount).toBe(2);
        expect(result.eligibleCount).toBe(1);
        expect(result.createdCount).toBe(0);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                id: 'auth_missing_unverified',
                reason: 'email_not_verified',
            }),
        ]);
        expect(result.nextCursor).toBe('next_cursor_123');
        expect(stackServerAppMock.listUsers).toHaveBeenCalledWith(expect.objectContaining({
            desc: true,
            orderBy: 'signedUpAt',
        }));
        expect(ensureAccountActivationMock).not.toHaveBeenCalled();
    });

    it('executes activation for eligible missing users', async () => {
        const users = [
            {
                id: 'auth_missing_verified',
                primaryEmail: 'verified@example.com',
                primaryEmailVerified: true,
                displayName: 'Verified Missing',
                signedUpAt: new Date('2026-03-21T10:00:00.000Z'),
            },
        ] as unknown as Array<Record<string, unknown>> & { nextCursor: string | null };
        users.nextCursor = null;

        stackServerAppMock.listUsers.mockResolvedValue(users);
        queryMocks.getAccountsByAuthUserIds.mockResolvedValue([]);
        ensureAccountActivationMock.mockResolvedValue({
            account: { id: 'acc_new' },
        });

        const result = await reconcileAuthUsers({ execute: true });

        expect(result.dryRun).toBe(false);
        expect(result.createdCount).toBe(1);
        expect(ensureAccountActivationMock).toHaveBeenCalledWith({
            id: 'auth_missing_verified',
            primaryEmail: 'verified@example.com',
            displayName: 'Verified Missing',
            signedUpAt: new Date('2026-03-21T10:00:00.000Z'),
        });
    });

    it('can scan every auth page when requested', async () => {
        const firstPage = [
            {
                id: 'auth_existing',
                primaryEmail: 'existing@example.com',
                primaryEmailVerified: true,
                displayName: 'Existing User',
                signedUpAt: new Date('2026-03-21T10:00:00.000Z'),
            },
        ] as unknown as Array<Record<string, unknown>> & { nextCursor: string | null };
        firstPage.nextCursor = 'cursor_page_2';

        const secondPage = [
            {
                id: 'auth_missing_verified',
                primaryEmail: 'verified@example.com',
                primaryEmailVerified: true,
                displayName: 'Verified Missing',
                signedUpAt: new Date('2026-04-16T11:00:00.000Z'),
            },
        ] as unknown as Array<Record<string, unknown>> & { nextCursor: string | null };
        secondPage.nextCursor = null;

        stackServerAppMock.listUsers
            .mockResolvedValueOnce(firstPage)
            .mockResolvedValueOnce(secondPage);
        queryMocks.getAccountsByAuthUserIds
            .mockResolvedValueOnce([
                { id: 'acc_existing', auth_user_id: 'auth_existing', email: 'existing@example.com' },
            ])
            .mockResolvedValueOnce([]);

        const result = await reconcileAuthUsers({ limit: 50, scanAll: true });

        expect(result.scanned).toBe(2);
        expect(result.existingAccountCount).toBe(1);
        expect(result.missingCount).toBe(1);
        expect(result.eligibleCount).toBe(1);
        expect(result.nextCursor).toBeNull();
        expect(stackServerAppMock.listUsers).toHaveBeenNthCalledWith(1, expect.objectContaining({
            cursor: undefined,
            desc: true,
            limit: 50,
        }));
        expect(stackServerAppMock.listUsers).toHaveBeenNthCalledWith(2, expect.objectContaining({
            cursor: 'cursor_page_2',
            desc: true,
            limit: 50,
        }));
    });
});
