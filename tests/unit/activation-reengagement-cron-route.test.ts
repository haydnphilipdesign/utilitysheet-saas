import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDueActivationOutreachCandidatesMock = vi.hoisted(() => vi.fn());
const getOrCreateIntakeLinkMock = vi.hoisted(() => vi.fn());
const recordActivationOutreachAttemptMock = vi.hoisted(() => vi.fn());
const sendActivationReminderEmailMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/queries', () => ({
    getDueActivationOutreachCandidates: getDueActivationOutreachCandidatesMock,
    getOrCreateIntakeLink: getOrCreateIntakeLinkMock,
    recordActivationOutreachAttempt: recordActivationOutreachAttemptMock,
}));

vi.mock('@/lib/email/email-service', () => ({
    sendActivationReminderEmail: sendActivationReminderEmailMock,
}));

import { GET } from '@/app/api/cron/activation-reengagement/route';

describe('GET /api/cron/activation-reengagement', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-05T12:30:00.000Z'));
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';

        getOrCreateIntakeLinkMock.mockResolvedValue({ slug: 'seller-link' });
        recordActivationOutreachAttemptMock.mockResolvedValue({});
        sendActivationReminderEmailMock.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('paces email sends so Resend is not called in a burst', async () => {
        getDueActivationOutreachCandidatesMock.mockResolvedValue([
            {
                account_id: 'acct_1',
                auth_user_id: 'auth_1',
                email: 'one@example.com',
                full_name: 'One User',
                created_at: '2026-05-04T12:00:00.000Z',
                stage: 'after_1d',
            },
            {
                account_id: 'acct_2',
                auth_user_id: 'auth_2',
                email: 'two@example.com',
                full_name: 'Two User',
                created_at: '2026-05-04T12:00:00.000Z',
                stage: 'after_1d',
            },
        ]);

        const responsePromise = GET(new Request('http://localhost/api/cron/activation-reengagement', {
            headers: { authorization: 'Bearer test-secret' },
        }));

        await vi.advanceTimersByTimeAsync(0);
        expect(sendActivationReminderEmailMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(249);
        expect(sendActivationReminderEmailMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        await responsePromise;

        expect(sendActivationReminderEmailMock).toHaveBeenCalledTimes(2);
    });
});
