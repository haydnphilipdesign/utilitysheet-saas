import { getMaintenanceStatus, type MaintenanceStatus } from '@/lib/maintenance/config';
import { readMaintenanceState, type StoredMaintenanceState } from '@/lib/neon/queries/maintenance';

/**
 * Where the current answer comes from.
 * environment: MAINTENANCE_MODE is set on this deployment and cannot be overridden in Admin.
 * admin: the switch in Admin > Maintenance.
 */
export type MaintenanceSource = 'environment' | 'admin' | 'none';
export interface ResolvedMaintenance extends MaintenanceStatus {
    source: MaintenanceSource;
}

/** How long one server instance trusts its last read. A change in Admin takes effect within this time. */
export const MAINTENANCE_STATE_TTL_MS = 10_000;
/** A slow database must not hold up the endpoints the switch protects. */
const READ_BUDGET_MS = 1_500;

let cached: { at: number; state: StoredMaintenanceState | null } | null = null;

export function forgetMaintenanceStateCache(): void {
    cached = null;
}

async function storedState(now: number): Promise<StoredMaintenanceState | null> {
    if (cached && now - cached.at < MAINTENANCE_STATE_TTL_MS) return cached.state;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), READ_BUDGET_MS);
    let state: StoredMaintenanceState | null;
    try {
        state = await readMaintenanceState({ signal: controller.signal });
    } catch {
        // Unreadable: keep the last known answer rather than guessing, and otherwise stay open.
        // The paused endpoints need the database themselves, so a pause cannot be enforced without it.
        state = cached?.state ?? null;
    } finally {
        clearTimeout(timer);
    }
    cached = { at: now, state };
    return state;
}

/** The environment setting wins when it is on; otherwise the Admin switch decides. */
export async function resolveMaintenanceStatus(now: number = Date.now()): Promise<ResolvedMaintenance> {
    const fromEnvironment = getMaintenanceStatus(now);
    if (fromEnvironment.maintenance) return { ...fromEnvironment, source: 'environment' };

    const state = await storedState(now);
    if (!state?.enabled) return { maintenance: false, expectedBackAt: null, source: 'none' };
    const expected = state.expectedBackAt && Date.parse(state.expectedBackAt) > now ? state.expectedBackAt : null;
    return { maintenance: true, expectedBackAt: expected, source: 'admin' };
}
