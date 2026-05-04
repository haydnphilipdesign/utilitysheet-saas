import { beforeEach, describe, expect, it, vi } from 'vitest';

const reconcileAuthUsersMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/activation/reconcile-auth-users', () => ({
    reconcileAuthUsers: reconcileAuthUsersMock,
}));

import { GET } from '@/app/api/cron/activation-reconcile/route';

describe('GET /api/cron/activation-reconcile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
    });

    it('rejects requests without the cron secret', async () => {
        const response = await GET(new Request('http://localhost/api/cron/activation-reconcile'));

        expect(response.status).toBe(401);
        expect(reconcileAuthUsersMock).not.toHaveBeenCalled();
    });

    it('syncs verified auth users across all pages', async () => {
        reconcileAuthUsersMock.mockResolvedValue({
            scanned: 119,
            existingAccountCount: 115,
            missingCount: 1,
            eligibleCount: 1,
            createdCount: 1,
            skipped: [],
            failures: [],
            dryRun: false,
            nextCursor: null,
        });

        const response = await GET(new Request('http://localhost/api/cron/activation-reconcile', {
            headers: { authorization: 'Bearer test-secret' },
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            created: 1,
            scanned: 119,
        });
        expect(reconcileAuthUsersMock).toHaveBeenCalledWith({
            execute: true,
            scanAll: true,
            includeUnverified: false,
            limit: 200,
        });
    });
});
