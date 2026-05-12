'use server';

import { revalidatePath } from 'next/cache';
import {
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

type ActionResult =
    | { success: true; dryRun?: boolean }
    | { success: false; error: string };

export async function sendTestimonialRequestAdminAction(
    userId: string,
    options: { allowResend?: boolean } = {}
): Promise<ActionResult> {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();

        const recipient = await getTestimonialOutreachRecipient(userId);
        if (!recipient) {
            return { success: false, error: 'Recipient not found' };
        }

        const validationError = validateTestimonialOutreachRecipient(recipient);
        if (validationError) {
            return { success: false, error: validationError };
        }

        const alreadySent = await hasSuccessfulTestimonialOutreach(userId);
        if (alreadySent && !options.allowResend) {
            return { success: false, error: 'A testimonial request has already been sent. Confirm Send again to resend.' };
        }

        const result = await sendTestimonialOutreachEmail({
            recipient,
            sentByAdminId: account.id,
        });

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: recipient.id,
            action: 'testimonial_request_sent',
            metadata: {
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

export async function sendTestimonialRequestTestToSelfAdminAction(): Promise<ActionResult> {
    try {
        const { account, user } = await requireAdmin();
        assertAdminWritesEnabled();

        const toEmail = account.email || user.primaryEmail;
        if (!toEmail) {
            return { success: false, error: 'Your admin account does not have an email address' };
        }

        const result = await sendTestimonialOutreachTestEmail({
            toEmail,
            toName: account.full_name || user.displayName || null,
            sentByAdminId: account.id,
        });

        await createAuditLogWithContext({
            adminId: account.id,
            targetUserId: account.id,
            action: 'testimonial_test_sent',
            metadata: {
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
