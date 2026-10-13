import { getStatementExecutor, isMissingRelationError, type StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';

/** The Admin-controlled maintenance switch as stored. See migrations-maintenance-state.sql. */
export interface StoredMaintenanceState {
    enabled: boolean;
    expectedBackAt: string | null;
    enabledAt: string | null;
    updatedAt: string | null;
    version: number;
}

const iso = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

function toState(row: Record<string, unknown>): StoredMaintenanceState {
    return {
        enabled: row.enabled === true,
        expectedBackAt: iso(row.expected_back_at),
        enabledAt: iso(row.enabled_at),
        updatedAt: iso(row.updated_at),
        version: Number(row.version ?? 0),
    };
}

const OFF: StoredMaintenanceState = { enabled: false, expectedBackAt: null, enabledAt: null, updatedAt: null, version: 0 };

/** The stored switch, or null when the migration has not been applied. */
export async function readMaintenanceState(options: { db?: StatementExecutor; signal?: AbortSignal } = {}): Promise<StoredMaintenanceState | null> {
    try {
        const rows = await (options.db ?? getStatementExecutor()).run(
            { text: 'SELECT enabled, expected_back_at, enabled_at, updated_at, version FROM maintenance_state WHERE id = TRUE', params: [] },
            options.signal ? { signal: options.signal } : undefined
        );
        return rows[0] ? toState(rows[0]) : OFF;
    } catch (error) {
        if (isMissingRelationError(error)) return null;
        throw error;
    }
}

export type MaintenanceWriteResult =
    | { outcome: 'OK'; state: StoredMaintenanceState }
    /** Already as requested: nothing changed and no audit entry was written. */
    | { outcome: 'UNCHANGED'; state: StoredMaintenanceState }
    | { outcome: 'ACTOR_NOT_ADMIN' };

/**
 * Turns the switch on or off, or changes the estimate, together with its audit
 * entry in one statement. An estimate is kept only while the switch is on.
 */
export async function setMaintenanceStateAtomic(input: {
    actor: AdminActor;
    reason: string | null;
    enabled: boolean;
    expectedBackAt: string | null;
    db?: StatementExecutor;
}): Promise<MaintenanceWriteResult> {
    const expectedBackAt = input.enabled ? input.expectedBackAt : null;
    const metadata = JSON.stringify({
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.actor.userAgent ? { userAgent: input.actor.userAgent } : {}),
    });
    const rows = await (input.db ?? getStatementExecutor()).run({
        text: `
            WITH actor AS (
                SELECT id FROM accounts WHERE id = $1::uuid AND role = 'admin'
            ),
            before AS (
                SELECT enabled, expected_back_at FROM maintenance_state WHERE id = TRUE FOR UPDATE
            ),
            changed AS (
                INSERT INTO maintenance_state (id, enabled, expected_back_at, enabled_at, version, updated_by, updated_at)
                SELECT TRUE, $2::boolean, $3::timestamptz, CASE WHEN $2::boolean THEN NOW() END, 1, a.id, NOW()
                FROM actor a
                WHERE NOT EXISTS (
                    SELECT 1 FROM before b
                    WHERE b.enabled = $2::boolean AND b.expected_back_at IS NOT DISTINCT FROM $3::timestamptz
                )
                ON CONFLICT (id) DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    expected_back_at = EXCLUDED.expected_back_at,
                    enabled_at = CASE
                        WHEN NOT EXCLUDED.enabled THEN NULL
                        WHEN maintenance_state.enabled THEN maintenance_state.enabled_at
                        ELSE NOW()
                    END,
                    version = maintenance_state.version + 1,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
                RETURNING enabled, expected_back_at, enabled_at, updated_at, version
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $1::uuid, NULL,
                    CASE
                        WHEN NOT c.enabled THEN 'maintenance_disabled'
                        WHEN COALESCE((SELECT enabled FROM before), FALSE) THEN 'maintenance_updated'
                        ELSE 'maintenance_enabled'
                    END,
                    $4::jsonb || jsonb_build_object('enabled', c.enabled, 'expectedBackAt', c.expected_back_at),
                    $5::text
                FROM changed c
                RETURNING id
            )
            SELECT
                (SELECT COUNT(*) FROM actor)::int AS is_admin,
                (SELECT COUNT(*) FROM audit)::int AS audit_count,
                c.enabled, c.expected_back_at, c.enabled_at, c.updated_at, c.version
            FROM (SELECT 1) one LEFT JOIN changed c ON TRUE
        `,
        params: [input.actor.adminId, input.enabled, expectedBackAt, metadata, input.actor.ipAddress],
    });
    const row = rows[0];
    if (!row || Number(row.is_admin) !== 1) return { outcome: 'ACTOR_NOT_ADMIN' };
    if (row.version === null || row.version === undefined) {
        return { outcome: 'UNCHANGED', state: (await readMaintenanceState({ db: input.db })) ?? OFF };
    }
    return { outcome: 'OK', state: toState(row) };
}

export interface MaintenanceHistoryEntry {
    id: string;
    action: 'maintenance_enabled' | 'maintenance_updated' | 'maintenance_disabled';
    createdAt: string | null;
    adminEmail: string | null;
}

/** The latest changes to the switch, from the audit log. */
export async function getMaintenanceHistory(limit = 8, options: { db?: StatementExecutor } = {}): Promise<MaintenanceHistoryEntry[]> {
    const rows = await (options.db ?? getStatementExecutor()).run({
        text: `
            SELECT al.id, al.action, al.created_at, a.email AS admin_email
            FROM admin_audit_logs al
            LEFT JOIN accounts a ON a.id = al.admin_id
            WHERE al.action IN ('maintenance_enabled', 'maintenance_updated', 'maintenance_disabled')
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT $1::int
        `,
        params: [Math.max(1, Math.min(50, Math.trunc(limit)))],
    });
    return rows.map((row) => ({
        id: String(row.id),
        action: row.action as MaintenanceHistoryEntry['action'],
        createdAt: iso(row.created_at),
        adminEmail: typeof row.admin_email === 'string' ? row.admin_email : null,
    }));
}
