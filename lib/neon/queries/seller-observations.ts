/**
 * Seller diagnostic observations stored in event_logs.
 */
import { sql } from '@/lib/neon/db';
import { DatabaseUnavailableError } from '@/lib/neon/statements';
import {
    SELLER_OBSERVATION_EVENT_TYPES,
    SELLER_OBSERVATION_MAX_PER_REQUEST,
    type SellerObservationEventType,
} from '@/lib/telemetry/seller-observations';

export type SellerObservationRow = {
    eventType: SellerObservationEventType;
    /** Must also be present as event_data.event_id; it is the deduplication key. */
    eventId: string;
    eventData: Record<string, unknown>;
};

/**
 * One statement: skips event ids already stored for the request (and repeats
 * inside the batch), and stores nothing once the request holds its ceiling of
 * diagnostic rows. IP address and user agent columns are deliberately left
 * empty. Simultaneous identical batches can still both insert, so readers
 * must not treat a row count as a count of sellers or steps.
 *
 * Returns the number of rows stored.
 */
export async function insertSellerObservations(
    params: { requestId: string; rows: SellerObservationRow[] },
    options?: { signal?: AbortSignal }
): Promise<number> {
    if (!sql) throw new DatabaseUnavailableError();
    if (params.rows.length === 0) return 0;

    const result = await sql.query(`
        WITH incoming AS (
            SELECT item->>'event_type' AS event_type,
                item->>'event_id' AS event_id,
                item->'event_data' AS event_data,
                ord
            FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS batch(item, ord)
        ), stored AS (
            SELECT COUNT(*)::int AS total
            FROM event_logs e
            WHERE e.request_id = $1 AND e.event_type = ANY($3::text[])
        ), fresh AS (
            SELECT DISTINCT ON (i.event_id) i.event_type, i.event_id, i.event_data, i.ord
            FROM incoming i
            WHERE NOT EXISTS (
                SELECT 1 FROM event_logs e
                WHERE e.request_id = $1
                    AND e.event_type = ANY($3::text[])
                    AND e.event_data->>'event_id' = i.event_id
            )
            ORDER BY i.event_id, i.ord
        )
        INSERT INTO event_logs (request_id, event_type, event_data)
        SELECT $1, f.event_type, f.event_data
        FROM fresh f CROSS JOIN stored s
        WHERE s.total + (SELECT COUNT(*) FROM fresh) <= $4
        ORDER BY f.ord
        RETURNING id
    `, [
        params.requestId,
        JSON.stringify(params.rows.map((row) => ({
            event_type: row.eventType,
            event_id: row.eventId,
            event_data: row.eventData,
        }))),
        [...SELLER_OBSERVATION_EVENT_TYPES],
        SELLER_OBSERVATION_MAX_PER_REQUEST,
    ], { fetchOptions: { signal: options?.signal } });

    return (result as unknown[]).length;
}
