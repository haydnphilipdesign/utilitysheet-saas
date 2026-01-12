/**
 * Event log-related database queries
 */
import { sql } from '@/lib/neon/db';

export async function createEventLog(params: {
    requestId: string;
    eventType: string;
    eventData?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
}): Promise<void> {
    if (!sql) return;

    await sql`
        INSERT INTO event_logs (request_id, event_type, event_data, ip_address, user_agent)
        VALUES (
            ${params.requestId},
            ${params.eventType},
            ${params.eventData ? JSON.stringify(params.eventData) : null},
            ${params.ipAddress || null},
            ${params.userAgent || null}
        )
    `;
}
