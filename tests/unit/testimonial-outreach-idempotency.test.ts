import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    send: vi.fn(),
    sql: vi.fn(),
}));

vi.mock('@/lib/resend', () => ({
    getResend: () => ({ emails: { send: mocks.send } }),
}));
vi.mock('@/lib/neon/db', () => ({ sql: mocks.sql }));
vi.mock('@/lib/admin/testimonial-candidates', () => ({
    isLikelyInternalOrTestAccount: () => false,
}));

import { sendTestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach';

describe('testimonial outreach provider idempotency', () => {
    const originalApiKey = process.env.RESEND_API_KEY;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.RESEND_API_KEY = 'test-key';
        mocks.sql
            .mockResolvedValueOnce([{ id: 'attempt-1' }])
            .mockResolvedValueOnce([]);
        mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    });

    afterEach(() => {
        process.env.RESEND_API_KEY = originalApiKey;
    });

    it('passes the reviewed action key to Resend for safe retries', async () => {
        const result = await sendTestimonialOutreachEmail({
            recipient: {
                id: 'user-1',
                email: 'customer@example.com',
                fullName: 'Customer User',
                companyName: null,
                role: 'user',
                subscriptionStatus: 'pro',
                effectivePlan: 'pro',
                activeOrganizationId: null,
                businessName: null,
            },
            sentByAdminId: 'admin-1',
            idempotencyKey: 'reviewed-action-1',
            allowDryRun: false,
        });

        expect(result).toEqual({ success: true, resendEmailId: 'email-1' });
        expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
            to: 'customer@example.com',
        }), { idempotencyKey: 'reviewed-action-1:primary' });
    });
});

