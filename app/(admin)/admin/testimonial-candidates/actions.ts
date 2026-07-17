'use server';

import { revalidatePath } from 'next/cache';
import {
    assertAdminActionConfirmed,
    assertAdminActionReason,
    assertAdminWritesEnabled,
    createAuditLogWithContext,
    requireAdmin,
} from '@/lib/admin';
import {
    getTestimonialOutreachRecipient,
    hasSuccessfulTestimonialOutreach,
    sendTestimonialOutreachEmail,
    sendTestimonialOutreachTestEmail,
    validateTestimonialOutreachRecipient,
} from '@/lib/admin/testimonial-outreach';
import { buildTestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach-content';

type ActionResult =
    | { success: true; dryRun?: boolean }
    | { success: false; error: string };

export async function sendTestimonialRequestAdminAction(
    userId: string,
    options: {
        reason: string;
        confirmed: boolean;
        idempotencyKey: string;
        expectedRecipientEmail: string;
        expectedSubject: string;
        expectedBody: string;
        allowResend?: boolean;
    }
): Promise<ActionResult> {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(options.reason);
        assertAdminActionConfirmed(options.confirmed);

        const reason = options.reason.trim();
        const idempotencyKey = options.idempotencyKey.trim();
        if (idempotencyKey.length < 8) {
            return { success: false, error: 'A valid outreach confirmation is required' };
        }

        const recipient = await getTestimonialOutreachRecipient(userId);
        if (!recipient) {
            return { success: false, error: 'Recipient not found' };
        }

        const validationError = validateTestimonialOutreachRecipient(recipient);
        if (validationError) {
            return { success: false, error: validationError };
        }

        const currentPreview = buildTestimonialOutreachEmail({
            recipientName: recipient.fullName,
            businessName: recipient.businessName,
        });
        if (
            recipient.email !== options.expectedRecipientEmail
            || currentPreview.subject !== options.expectedSubject
            || currentPreview.text !== options.expectedBody
        ) {
            return {
                success: false,
                error: 'Recipient details or message content changed. Close this review and open it again before sending.',
            };
        }

        const alreadySent = await hasSuccessfulTestimonialOutreach(userId);
        if (alreadySent && !options.allowResend) {
            return { success: false, error: 'A testimonial request has already been sent. Confirm Send again to resend.' };
        }

        const result = await sendTestimonialOutreachEmail({
            recipient,
            sentByAdminId: account.id,
            idempotencyKey,
        });

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: recipient.id,
            action: 'testimonial_request_sent',
            metadata: {
                reason,
                recipientEmail: recipient.email,
                result: result.success ? (result.dryRun ? 'dry_run' : 'sent') : 'failed',
                resendEmailId: result.success ? result.resendEmailId || null : null,
                error: result.success ? null : result.error,
            },
        });

        revalidatePath('/admin/testimonial-candidates');

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to send testimonial request' };
        }

        return { success: true, dryRun: result.dryRun };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function sendTestimonialRequestTestToSelfAdminAction(options: {
    reason: string;
    confirmed: boolean;
    idempotencyKey: string;
}): Promise<ActionResult> {
    try {
        const { account, user } = await requireAdmin();
        assertAdminWritesEnabled();
        assertAdminActionReason(options.reason);
        assertAdminActionConfirmed(options.confirmed);

        const reason = options.reason.trim();
        const idempotencyKey = options.idempotencyKey.trim();
        if (idempotencyKey.length < 8) {
            return { success: false, error: 'A valid outreach confirmation is required' };
        }

        const toEmail = account.email || user.primaryEmail;
        if (!toEmail) {
            return { success: false, error: 'Your admin account does not have an email address' };
        }

        const result = await sendTestimonialOutreachTestEmail({
            toEmail,
            toName: account.full_name || user.displayName || null,
            sentByAdminId: account.id,
            idempotencyKey,
        });

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: account.id,
            action: 'testimonial_test_sent',
            metadata: {
                reason,
                recipientEmail: toEmail,
                result: result.success ? (result.dryRun ? 'dry_run' : 'sent') : 'failed',
                resendEmailId: result.success ? result.resendEmailId || null : null,
                error: result.success ? null : result.error,
            },
        });

        revalidatePath('/admin/testimonial-candidates');

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to send test testimonial request' };
        }

        return { success: true, dryRun: result.dryRun };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
