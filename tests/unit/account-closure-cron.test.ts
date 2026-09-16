import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listStalled: vi.fn(),
    runClosure: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/account/closure', () => ({ runAccountClosure: mocks.runClosure }));
vi.mock('@/lib/neon/queries', () => ({ listStalledAccountClosures: mocks.listStalled }));

import { GET } from '@/app/api/cron/account-closure-retry/route';

function request(secret = 'cron-test') {
    return new Request('http://localhost/api/cron/account-closure-retry', {
        headers: { authorization: `Bearer ${secret}` },
    });
}

describe('/api/cron/account-closure-retry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CRON_SECRET', 'cron-test');
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.listStalled.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('fails closed when the cron secret is missing or incorrect', async () => {
        vi.stubEnv('CRON_SECRET', '');
        expect((await GET(request())).status).toBe(500);

        vi.stubEnv('CRON_SECRET', 'cron-test');
        expect((await GET(request('wrong'))).status).toBe(401);
        expect(mocks.listStalled).not.toHaveBeenCalled();
    });

    it('retries eligible closures and leaves exhausted closures for support', async () => {
        mocks.listStalled.mockResolvedValue([
            { accountId: 'acct_retry', attemptCount: 2, step: 'assets_removed', exhausted: false },
            { accountId: 'acct_stuck', attemptCount: 5, step: 'assets_removed', exhausted: true },
        ]);
        mocks.runClosure.mockResolvedValue({ status: 'closed' });

        const response = await GET(request());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            scanned: 2, closed: 1, stillClosing: 0, reverted: 0, stuck: 1,
        });
        expect(mocks.runClosure).toHaveBeenCalledTimes(1);
        expect(mocks.runClosure).toHaveBeenCalledWith('acct_retry');
    });
});

