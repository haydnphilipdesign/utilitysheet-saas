import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    candidates: vi.fn(),
    prepare: vi.fn(),
    execute: vi.fn(),
}));

// Operational observations are best-effort and covered in ops-instrumentation.test.ts.
vi.mock('@/lib/ops/events');
vi.mock('@/lib/neon/queries/automatic-reminders', () => ({
    getDueAutomaticReminderCandidates: mocks.candidates,
}));
vi.mock('@/lib/reminders/seller-reminder', () => ({
    prepareSellerReminder: mocks.prepare,
    executeSellerReminder: mocks.execute,
}));

import { GET } from '@/app/api/cron/seller-auto-reminders/route';

const call = (auth = 'Bearer test-secret') => GET(new Request('http://localhost/api/cron/seller-auto-reminders', {
    headers: { authorization: auth },
}));

describe('GET /api/cron/seller-auto-reminders', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout'] });
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mocks.prepare.mockImplementation(async ({ requestId }: { requestId: string }) => ({
            ok: true,
            prepared: { request: { id: requestId }, email: { to: 'seller@example.com' }, fingerprint: 'f' },
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rejects calls without the cron secret', async () => {
        const response = await call('Bearer wrong');
        expect(response.status).toBe(401);
        expect(mocks.candidates).not.toHaveBeenCalled();
    });

    it('sends each due reminder as the owner, marked automatic, and reports the outcomes', async () => {
        mocks.candidates.mockResolvedValue([
            { request_id: 'req_1', owner_account_id: 'acct_1', owner_full_name: 'Olivia Owner' },
            { request_id: 'req_2', owner_account_id: 'acct_2', owner_full_name: null },
            { request_id: 'req_3', owner_account_id: 'acct_3', owner_full_name: null },
            { request_id: 'req_4', owner_account_id: 'acct_4', owner_full_name: null },
        ]);
        mocks.prepare.mockImplementationOnce(async ({ requestId }: { requestId: string }) => ({
            ok: true,
            prepared: { request: { id: requestId }, email: { to: 'seller@example.com' }, fingerprint: 'f' },
        }));
        mocks.prepare.mockImplementationOnce(async () => ({ ok: false, code: 'NO_SELLER_EMAIL' }));
        mocks.execute
            .mockResolvedValueOnce({ status: 'accepted', operationId: 'op_1', alreadyAccepted: false })
            .mockResolvedValueOnce({ status: 'blocked', code: 'COOLDOWN', blockingOperationId: null, retryAfterSeconds: 60 })
            .mockResolvedValueOnce({ status: 'failed', operationId: 'op_4', code: 'validation_error' });

        const responsePromise = call();
        await vi.runAllTimersAsync();
        const body = await (await responsePromise).json();

        expect(body).toMatchObject({ success: true, processed: 4, sent: 1, skipped: 2, failed: 1 });
        expect(mocks.prepare).toHaveBeenCalledWith({ requestId: 'req_1', adminPolicy: false, fallbackAgentName: 'Olivia Owner' });
        expect(mocks.execute).toHaveBeenCalledTimes(3);
        expect(mocks.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
            actor: expect.objectContaining({ type: 'agent', accountId: 'acct_1', automatic: true }),
        }));
    });

    it('fails the run when candidates cannot be loaded', async () => {
        mocks.candidates.mockRejectedValue(new Error('db down'));
        const response = await call();
        expect(response.status).toBe(500);
    });
});
