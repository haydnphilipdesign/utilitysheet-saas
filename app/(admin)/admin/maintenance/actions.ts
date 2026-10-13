'use server';

import { revalidatePath } from 'next/cache';
import {
    AdminActionRefusal,
    adminActionFailure,
    afterCommit,
    beginAdminWrite,
    type AdminActionFailure,
} from '@/lib/admin/action-guard';
import { forgetMaintenanceStateCache } from '@/lib/maintenance/state';
import { setMaintenanceStateAtomic, type StoredMaintenanceState } from '@/lib/neon/queries/maintenance';
import { isMissingRelationError } from '@/lib/neon/statements';
import { adminMaintenanceSchema } from '@/lib/validation/admin-schemas';

type MaintenanceActionResult =
    | { success: true; state: StoredMaintenanceState; unchanged: boolean }
    | AdminActionFailure;

type MaintenanceInput = {
    enabled: boolean;
    expectedBackInMinutes?: number | null;
    reason?: string;
};

/** The switch and its audit entry commit together. A repeat of the current state changes nothing. */
export async function setMaintenanceAdminAction(input: MaintenanceInput): Promise<MaintenanceActionResult> {
    try {
        const { actor } = await beginAdminWrite();
        const parsed = adminMaintenanceSchema.parse(input);
        const expectedBackAt = parsed.enabled && parsed.expectedBackInMinutes
            ? new Date(Date.now() + parsed.expectedBackInMinutes * 60_000).toISOString()
            : null;

        let result;
        try {
            result = await setMaintenanceStateAtomic({
                actor,
                reason: parsed.reason ?? null,
                enabled: parsed.enabled,
                expectedBackAt,
            });
        } catch (error) {
            if (isMissingRelationError(error)) {
                throw new AdminActionRefusal(
                    'NOT_INSTALLED',
                    'The maintenance switch is not installed yet (migrations-maintenance-state.sql has not been applied). Nothing was changed.'
                );
            }
            throw error;
        }
        if (result.outcome === 'ACTOR_NOT_ADMIN') throw new AdminActionRefusal('UNAUTHORIZED', 'Admin access required');

        // This server instance answers correctly at once; others follow within the cache time.
        forgetMaintenanceStateCache();
        afterCommit('maintenance_set', () => revalidatePath('/admin/maintenance'));
        return { success: true, state: result.state, unchanged: result.outcome === 'UNCHANGED' };
    } catch (error) {
        return adminActionFailure(error, 'maintenance_set');
    }
}