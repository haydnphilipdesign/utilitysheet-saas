/**
 * Event log-related database queries
 */
import { sql } from '@/lib/neon/db';
import { DatabaseUnavailableError } from '@/lib/neon/statements';

export type TestDriveLifecycleEvent = {
    event_type: string;
    event_data: Record<string, unknown> | null;
    created_at: string;
};

export async function createEventLog(params: {
    requestId: string;
    eventType: string;
    eventData?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
}, options?: { signal?: AbortSignal }): Promise<void> {
    if (!sql) {
        if (options?.signal) throw new DatabaseUnavailableError();
        return;
    }

    await sql.query(`
        INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )
    `, [
        params.requestId,
        params.eventType,
        params.eventData ? JSON.stringify(params.eventData) : null,
        params.ipAddress || null,
        params.userAgent || null
    ], { fetchOptions: { signal: options?.signal } });
}

export async function getTestDriveLifecycleEvents(requestId: string): Promise<TestDriveLifecycleEvent[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT event_type, event_data, created_at
        FROM event_logs
        WHERE request_id = ${requestId}
          AND event_type IN (
              'test_drive_invitation_succeeded',
              'test_drive_invitation_failed',
              'test_drive_delivery_succeeded',
              'test_drive_delivery_failed'
          )
        ORDER BY created_at DESC, id DESC
    `;

    return result as TestDriveLifecycleEvent[];
}
