import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductUpdate } from '@/types';

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
    createProductUpdate: vi.fn(),
    publishProductUpdate: vi.fn(),
    deleteProductUpdate: vi.fn(),
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

vi.mock('@/lib/neon/queries/updates', () => ({
    createProductUpdate: mocks.createProductUpdate,
    publishProductUpdate: mocks.publishProductUpdate,
    deleteProductUpdate: mocks.deleteProductUpdate,
}));

import {
    sendTestimonialRequestAdminAction,
    sendTestimonialRequestTestToSelfAdminAction,
} from '@/app/(admin)/admin/testimonial-candidates/actions';
import {
    createProductUpdateAdminAction,
    deleteProductUpdateAdminAction,
    publishProductUpdateAdminAction,
} from '@/app/(admin)/admin/updates/actions';

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

const update: ProductUpdate = {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Faster packet handoff',
    body: 'Packet sharing now opens more quickly.',
    category: 'feature',
    is_published: false,
    published_at: '2026-07-17T12:00:00.000Z',
    created_by: adminAccount.id,
    created_at: '2026-07-17T12:00:00.000Z',
    updated_at: '2026-07-17T12:00:00.000Z',
};

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
        mocks.createProductUpdate.mockResolvedValue(update);
        mocks.publishProductUpdate.mockResolvedValue({
            ...update,
            is_published: true,
            published_at: '2026-07-17T13:00:00.000Z',
        });
        mocks.deleteProductUpdate.mockResolvedValue(update);
        mocks.createAuditLogWithContext.mockResolvedValue({ id: 'audit_1' });
        mocks.buildTestimonialOutreachEmail.mockReturnValue({
            subject: 'Quick UtilitySheet question',
            text: 'Reviewed outreach body',
            html: '<p>Reviewed outreach body</p>',
        });
    });

    it('keeps the Admin write safety catch authoritative on the server', async () => {
        mocks.assertAdminWritesEnabled.mockImplementationOnce(() => {
            throw new Error('Admin writes are disabled via ADMIN_WRITES_DISABLED=true');
        });

        const result = await createProductUpdateAdminAction({
            title: update.title,
            body: update.body,
            category: update.category,
            reason: 'Prepare release notes for review',
        });

        expect(result).toEqual({ success: false, error: 'Admin writes are disabled via ADMIN_WRITES_DISABLED=true' });
        expect(mocks.createProductUpdate).not.toHaveBeenCalled();
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

    it('creates Product Updates as drafts regardless of client publication input', async () => {
        const result = await createProductUpdateAdminAction({
            title: update.title,
            body: update.body,
            category: update.category,
            reason: 'Prepare release notes for review',
        });

        expect(result).toEqual({ success: true, update });
        expect(mocks.createProductUpdate).toHaveBeenCalledWith({
            title: update.title,
            body: update.body,
            category: update.category,
            isPublished: false,
            createdBy: adminAccount.id,
        });
        expect(mocks.createAuditLogWithContext).toHaveBeenCalledWith(expect.objectContaining({
            action: 'product_update_created',
            metadata: expect.objectContaining({
                reason: 'Prepare release notes for review',
                is_published: false,
            }),
        }));
    });

    it('requires confirmation and audits publication separately', async () => {
        const result = await publishProductUpdateAdminAction(update.id, {
            reason: 'Release verified and ready for customers',
            confirmed: true,
        });

        expect(result.success).toBe(true);
        expect(mocks.publishProductUpdate).toHaveBeenCalledWith(update.id);
        expect(mocks.createAuditLogWithContext).toHaveBeenCalledWith(expect.objectContaining({
            action: 'product_update_published',
            metadata: expect.objectContaining({
                updateId: update.id,
                title: update.title,
                reason: 'Release verified and ready for customers',
            }),
        }));
    });

    it('requires confirmation and audits the deleted update identity', async () => {
        const result = await deleteProductUpdateAdminAction(update.id, {
            reason: 'Duplicate draft created in error',
            confirmed: true,
        });

        expect(result.success).toBe(true);
        expect(mocks.createAuditLogWithContext).toHaveBeenCalledWith(expect.objectContaining({
            action: 'product_update_deleted',
            metadata: expect.objectContaining({
                updateId: update.id,
                title: update.title,
                reason: 'Duplicate draft created in error',
                wasPublished: false,
            }),
        }));
    });
});
