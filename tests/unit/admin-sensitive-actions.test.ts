import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    assertAdminWritesEnabled: vi.fn(),
    assertAdminActionReason: vi.fn(),
    assertAdminActionConfirmed: vi.fn(),
    createAuditLogWithContext: vi.fn(),
    revalidatePath: vi.fn(),
    getTestimonialOutreachRecipient: vi.fn(),
    validateTestimonialOutreachRecipient: vi.fn(),
    hasSuccessfulTestimonialOutreach: vi.fn(),
    sendTestimonialOutreachEmail: vi.fn(),
    sendTestimonialOutreachTestEmail: vi.fn(),
    buildTestimonialOutreachEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/lib/admin', () => ({
    requireAdmin: mocks.requireAdmin,
    assertAdminWritesEnabled: mocks.assertAdminWritesEnabled,
    assertAdminActionReason: mocks.assertAdminActionReason,
    assertAdminActionConfirmed: mocks.assertAdminActionConfirmed,
    createAuditLogWithContext: mocks.createAuditLogWithContext,
}));

vi.mock('@/lib/admin/testimonial-outreach', () => ({
    getTestimonialOutreachRecipient: mocks.getTestimonialOutreachRecipient,
    validateTestimonialOutreachRecipient: mocks.validateTestimonialOutreachRecipient,
    hasSuccessfulTestimonialOutreach: mocks.hasSuccessfulTestimonialOutreach,
    sendTestimonialOutreachEmail: mocks.sendTestimonialOutreachEmail,
    sendTestimonialOutreachTestEmail: mocks.sendTestimonialOutreachTestEmail,
}));

vi.mock('@/lib/admin/testimonial-outreach-content', () => ({
    buildTestimonialOutreachEmail: mocks.buildTestimonialOutreachEmail,
}));

import {
    sendTestimonialRequestAdminAction,
    sendTestimonialRequestTestToSelfAdminAction,
} from '@/app/(admin)/admin/testimonial-candidates/actions';

const adminAccount = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    full_name: 'Admin User',
};

const recipient = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'customer@example.com',
    fullName: 'Customer User',
    companyName: 'North Star TC',
    role: 'user',
    subscriptionStatus: 'pro',
    effectivePlan: 'pro',
    activeOrganizationId: null,
    businessName: 'North Star TC',
};

// Product Update writes are covered in admin-support-actions.test.ts and admin-writes.test.ts.

describe('sensitive Admin server actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdmin.mockResolvedValue({
            account: adminAccount,
            user: { primaryEmail: adminAccount.email, displayName: adminAccount.full_name },
        });
        mocks.assertAdminActionReason.mockImplementation((reason: string) => {
            if (reason.trim().length < 3) throw new Error('Admin action requires a reason (min 3 characters)');
        });
        mocks.assertAdminActionConfirmed.mockImplementation((confirmed: boolean) => {
            if (!confirmed) throw new Error('Admin action requires explicit confirmation');
        });
        mocks.getTestimonialOutreachRecipient.mockResolvedValue(recipient);
        mocks.validateTestimonialOutreachRecipient.mockReturnValue(null);
        mocks.hasSuccessfulTestimonialOutreach.mockResolvedValue(false);
        mocks.sendTestimonialOutreachEmail.mockResolvedValue({ success: true, resendEmailId: 'email_123' });
        mocks.sendTestimonialOutreachTestEmail.mockResolvedValue({ success: true, resendEmailId: 'email_test' });
        mocks.createAuditLogWithContext.mockResolvedValue({ id: 'audit_1' });
        mocks.buildTestimonialOutreachEmail.mockReturnValue({
            subject: 'Quick UtilitySheet question',
            text: 'Reviewed outreach body',
            html: '<p>Reviewed outreach body</p>',
        });
    });

    it('requires reason and explicit confirmation before testimonial outreach', async () => {
        const result = await sendTestimonialRequestAdminAction(recipient.id, {
            reason: '',
            confirmed: false,
            idempotencyKey: 'outreach-confirmation-1',
            expectedRecipientEmail: recipient.email,
            expectedSubject: 'Quick UtilitySheet question',
            expectedBody: 'Reviewed outreach body',
        });

        expect(result).toEqual({ success: false, error: 'Admin action requires a reason (min 3 characters)' });
        expect(mocks.sendTestimonialOutreachEmail).not.toHaveBeenCalled();
    });

    it('passes reason and provider idempotency through a successful outreach audit', async () => {
        const result = await sendTestimonialRequestAdminAction(recipient.id, {
            reason: 'Strong activity and clear workflow fit',
            confirmed: true,
            idempotencyKey: 'outreach-confirmation-2',
            expectedRecipientEmail: recipient.email,
            expectedSubject: 'Quick UtilitySheet question',
            expectedBody: 'Reviewed outreach body',
        });

        expect(result).toEqual({ success: true, dryRun: undefined });
        expect(mocks.sendTestimonialOutreachEmail).toHaveBeenCalledWith({
            recipient,
            sentByAdminId: adminAccount.id,
            idempotencyKey: 'outreach-confirmation-2',
        });
        expect(mocks.createAuditLogWithContext).toHaveBeenCalledWith(expect.objectContaining({
            action: 'testimonial_request_sent',
            targetUserId: recipient.id,
            metadata: expect.objectContaining({
                reason: 'Strong activity and clear workflow fit',
                recipientEmail: recipient.email,
                result: 'sent',
            }),
        }));
    });

    it('refuses outreach when the reviewed recipient or message is stale', async () => {
        const result = await sendTestimonialRequestAdminAction(recipient.id, {
            reason: 'Strong activity and clear workflow fit',
            confirmed: true,
            idempotencyKey: 'outreach-confirmation-3',
            expectedRecipientEmail: 'old-address@example.com',
            expectedSubject: 'Quick UtilitySheet question',
            expectedBody: 'Reviewed outreach body',
        });

        expect(result).toEqual({
            success: false,
            error: 'Recipient details or message content changed. Close this review and open it again before sending.',
        });
        expect(mocks.sendTestimonialOutreachEmail).not.toHaveBeenCalled();
    });

    it('requires a reason and confirmation for the test-to-self send', async () => {
        await sendTestimonialRequestTestToSelfAdminAction({
            reason: 'Verify the current outreach rendering',
            confirmed: true,
            idempotencyKey: 'outreach-test-1',
        });

        expect(mocks.sendTestimonialOutreachTestEmail).toHaveBeenCalledWith(expect.objectContaining({
            idempotencyKey: 'outreach-test-1',
        }));
        expect(mocks.createAuditLogWithContext).toHaveBeenCalledWith(expect.objectContaining({
            action: 'testimonial_test_sent',
            metadata: expect.objectContaining({ reason: 'Verify the current outreach rendering' }),
        }));
    });
});
