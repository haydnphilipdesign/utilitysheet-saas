/**
 * Minimal triage state for Operations items.
 *
 * Triage records how an operator has handled an item. It never alters the
 * source record, raw backlog counts, request status or analytics, and it never
 * sends anything. See `.ai/decisions/2026-10-05-operations-monitoring-and-triage.md`.
 */
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';

export type TriageKind = 'service' | 'follow_up';
export type TriageState = 'open' | 'acknowledged' | 'snoozed' | 'resolved';
export type TriageAction = 'acknowledge' | 'snooze' | 'resolve' | 'reopen';

export type TriageRecord = {
    sourceKey: string;
    state: TriageState;
    snoozedUntil: string | null;
    note: string | null;
    version: number;
    updatedByEmail: string | null;
    stateChangedAt: string;
};

const ACTION_STATE: Record<TriageAction, TriageState> = {
    acknowledge: 'acknowledged',
    snooze: 'snoozed',
    resolve: 'resolved',
    reopen: 'open',
};

const KIND_BY_PREFIX: Record<string, TriageKind> = {
    incident: 'service',
    job: 'service',
    reminder: 'service',
    request_inactive: 'follow_up',
    account_not_started: 'follow_up',
};

/** The kind is derived from the key prefix on the server, never taken from the client. */
export function triageKindForSourceKey(sourceKey: string): TriageKind | null {
    return KIND_BY_PREFIX[sourceKey.split(':', 1)[0]] ?? null;
}

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);

export async function getTriageRecords(input: { sourceKeys: string[]; db?: StatementExecutor }): Promise<Map<string, TriageRecord>> {
    const records = new Map<string, TriageRecord>();
    if (input.sourceKeys.length === 0) return records;
    const rows = await (input.db ?? getStatementExecutor()).run({
        text: `
            SELECT t.source_key, t.state, t.snoozed_until, t.note, t.version, t.state_changed_at, a.email AS updated_by_email
            FROM admin_triage_items t
            LEFT JOIN accounts a ON a.id = t.updated_by
            WHERE t.source_key = ANY($1::text[])
        `,
        params: [input.sourceKeys],
    });
    for (const row of rows) {
        records.set(String(row.source_key), {
            sourceKey: String(row.source_key),
            state: row.state as TriageState,
            snoozedUntil: iso(row.snoozed_until),
            note: (row.note as string | null) ?? null,
            version: Number(row.version),
            updatedByEmail: (row.updated_by_email as string | null) ?? null,
            stateChangedAt: iso(row.state_changed_at)!,
        });
    }
    return records;
}

export type EffectiveTriage = {
    /** What the queue should show right now. */
    state: TriageState;
    /** Why a stored state is not being honoured, when it is not. */
    returned: 'snooze_expired' | 'recurred' | null;
    record: TriageRecord | null;
};

/**
 * Applies time and recurrence to the stored state:
 * - an expired snooze returns the item to the queue;
 * - activity on the source after it was resolved (a new failure episode, or a
 *   follow-up candidate that became active and went quiet again) reopens it;
 * - an unchanged resolved item stays resolved, so old inactivity does not reappear daily.
 */
export function effectiveTriageState(
    record: TriageRecord | null,
    source: { lastOccurredAt: string | null },
    now: Date
): EffectiveTriage {
    if (!record) return { state: 'open', returned: null, record: null };

    if (record.state === 'snoozed') {
        const until = record.snoozedUntil ? Date.parse(record.snoozedUntil) : NaN;
        if (!Number.isFinite(until) || until <= now.getTime()) {
            return { state: 'open', returned: 'snooze_expired', record };
        }
    }

    if (record.state === 'resolved' && source.lastOccurredAt) {
        if (Date.parse(source.lastOccurredAt) > Date.parse(record.stateChangedAt)) {
            return { state: 'open', returned: 'recurred', record };
        }
    }

    return { state: record.state, returned: null, record };
}

export type TriageWriteOutcome = 'OK' | 'STALE' | 'ACTOR_NOT_ADMIN';

/**
 * Changes triage state with optimistic concurrency. The change and its audit
 * entry are one statement: two operators cannot silently overwrite each other,
 * and a failed audit insert rolls the change back. The note is private and is
 * not copied into the audit entry.
 */
export async function applyTriageAction(input: {
    sourceKey: string;
    kind: TriageKind;
    action: TriageAction;
    /** 0 when no triage record existed in the view the operator acted on. */
    expectedVersion: number;
    snoozedUntil: Date | null;
    note: string | null;
    reason: string | null;
    actor: AdminActor;
    db?: StatementExecutor;
}): Promise<{ outcome: TriageWriteOutcome; version: number | null }> {
    const state = ACTION_STATE[input.action];
    const rows = await (input.db ?? getStatementExecutor()).run({
        text: `
            WITH actor AS (
                SELECT id FROM accounts WHERE id = $6::uuid AND role = 'admin'
            ),
            upserted AS (
                INSERT INTO admin_triage_items (source_key, kind, state, snoozed_until, note, version, updated_by)
                SELECT $1, $2, $3, $4::timestamptz, $5, 1, $6::uuid
                FROM actor
                WHERE $7::int = 0 OR EXISTS (SELECT 1 FROM admin_triage_items WHERE source_key = $1)
                ON CONFLICT (source_key) DO UPDATE SET
                    state = EXCLUDED.state,
                    snoozed_until = EXCLUDED.snoozed_until,
                    note = COALESCE(EXCLUDED.note, admin_triage_items.note),
                    version = admin_triage_items.version + 1,
                    updated_by = EXCLUDED.updated_by,
                    state_changed_at = NOW(),
                    updated_at = NOW()
                WHERE admin_triage_items.version = $7::int
                RETURNING source_key, state, version, snoozed_until
            ),
            audit AS (
                INSERT INTO admin_audit_logs (admin_id, target_user_id, action, metadata, ip_address)
                SELECT $6::uuid, NULL, 'triage_updated',
                    $8::jsonb || jsonb_strip_nulls(jsonb_build_object(
                        'sourceKey', u.source_key,
                        'triageAction', $9::text,
                        'state', u.state,
                        'snoozedUntil', u.snoozed_until,
                        'noteChanged', $5::text IS NOT NULL
                    )),
                    $10::text
                FROM upserted u
                RETURNING id
            )
            SELECT (SELECT version FROM upserted) AS version,
                EXISTS (SELECT 1 FROM actor) AS actor_ok,
                (SELECT COUNT(*) FROM audit)::int AS audit_count
        `,
        params: [
            input.sourceKey,
            input.kind,
            state,
            state === 'snoozed' && input.snoozedUntil ? input.snoozedUntil.toISOString() : null,
            input.note,
            input.actor.adminId,
            input.expectedVersion,
            JSON.stringify({
                ...(input.reason ? { reason: input.reason } : {}),
                ...(input.actor.userAgent ? { userAgent: input.actor.userAgent } : {}),
            }),
            input.action,
            input.actor.ipAddress,
        ],
    });
    const row = rows[0];
    if (!row?.actor_ok) return { outcome: 'ACTOR_NOT_ADMIN', version: null };
    if (row.version === null || row.version === undefined) return { outcome: 'STALE', version: null };
    return { outcome: 'OK', version: Number(row.version) };
}
