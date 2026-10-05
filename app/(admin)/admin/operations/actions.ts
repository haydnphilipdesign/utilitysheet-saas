'use server';

import { revalidatePath } from 'next/cache';
import {
    AdminActionRefusal,
    adminActionFailure,
    afterCommit,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import { isMissingRelationError } from '@/lib/neon/statements';
import { applyTriageAction, triageKindForSourceKey } from '@/lib/ops/triage';
import { adminTriageActionSchema } from '@/lib/validation/admin-schemas';

/**
 * Acknowledge, snooze, resolve or reopen an Operations item. Triage state only:
 * it never changes the source record, a request status, backlog counts or
 * analytics, and it never sends a message.
 */
export async function updateTriageAdminAction(input: {
    sourceKey: string;
    action: string;
    expectedVersion: number;
    snoozeDays?: number;
    note?: string;
    reason?: string;
}): Promise<{ success: true } | AdminActionFailure> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminTriageActionSchema.parse(input);

        const kind = triageKindForSourceKey(parsed.sourceKey);
        if (!kind) throw new AdminActionRefusal('INVALID_INPUT', 'Unknown Operations item.');

        let result: Awaited<ReturnType<typeof applyTriageAction>>;
        try {
            result = await applyTriageAction({
                actor,
                sourceKey: parsed.sourceKey,
                kind,
                action: parsed.action,
                expectedVersion: parsed.expectedVersion,
                snoozedUntil: parsed.action === 'snooze'
                    ? new Date(Date.now() + parsed.snoozeDays! * 24 * 60 * 60 * 1000)
                    : null,
                note: parsed.note,
                reason: parsed.reason,
            });
        } catch (error) {
            if (isMissingRelationError(error)) {
                throw new AdminActionRefusal(
                    'MIGRATION_PENDING',
                    'Triage is not available yet (database migration pending). Nothing was saved.'
                );
            }
            throw error;
        }

        if (result.outcome === 'ACTOR_NOT_ADMIN') throw new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');
        if (result.outcome === 'STALE') {
            throw new AdminActionRefusal(
                'STALE',
                'Another operator updated this item after you opened it. Nothing was saved. Refresh and review their change.'
            );
        }

        afterCommit('triage_update', () => revalidatePath('/admin/operations'));
        return { success: true };
    } catch (error) {
        return adminActionFailure(error, 'triage_update');
    }
}
