'use server';

import { revalidatePath } from 'next/cache';
import {
    AdminActionRefusal,
    adminActionFailure,
    afterCommit,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import { updateFeedbackStatus } from '@/lib/admin/feedback';
import { isMissingRelationError } from '@/lib/neon/statements';
import { adminFeedbackStatusSchema } from '@/lib/validation/admin-schemas';

/**
 * Mark a feedback item new, reviewed or resolved, optionally with a private
 * note. Review state only: it never changes the customer's message or account
 * and never sends anything to the customer.
 */
export async function updateFeedbackStatusAdminAction(input: {
    feedbackId: string;
    status: string;
    expectedVersion: number;
    note?: string;
    reason?: string;
}): Promise<{ success: true } | AdminActionFailure> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminFeedbackStatusSchema.parse(input);

        let result: Awaited<ReturnType<typeof updateFeedbackStatus>>;
        try {
            result = await updateFeedbackStatus({
                actor,
                feedbackId: parsed.feedbackId,
                status: parsed.status,
                expectedVersion: parsed.expectedVersion,
                note: parsed.note,
                reason: parsed.reason,
            });
        } catch (error) {
            if (isMissingRelationError(error)) {
                throw new AdminActionRefusal(
                    'MIGRATION_PENDING',
                    'The feedback inbox is not available yet (database migration pending). Nothing was saved.'
                );
            }
            throw error;
        }

        if (result.outcome === 'ACTOR_NOT_ADMIN') throw new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');
        if (result.outcome === 'NOT_FOUND') {
            throw new AdminActionRefusal('NOT_FOUND', 'This feedback no longer exists. Nothing was saved.');
        }
        if (result.outcome === 'STALE') {
            throw new AdminActionRefusal(
                'STALE',
                'Another operator updated this feedback after you opened it. Nothing was saved. Refresh and review their change.'
            );
        }

        afterCommit('feedback_status_update', () => revalidatePath('/admin/feedback'));
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'feedback_status_update');
    }
}
