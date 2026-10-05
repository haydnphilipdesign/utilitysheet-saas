/**
 * Provider delivery evidence for seller reminders.
 *
 * Only messages whose provider ID was stored (`reminder_operations`) can be
 * correlated. Every other message, and every reminder sent before this existed,
 * stays "unknown". Delivery by the provider is not proof that a person read it.
 */
import { getStatementExecutor, type StatementExecutor } from '@/lib/neon/statements';

export type DeliveryStatus = 'delayed' | 'delivered' | 'failed' | 'bounced' | 'complained';

const EVENT_TYPE_TO_STATUS: Record<string, DeliveryStatus> = {
    'email.delivery_delayed': 'delayed',
    'email.delivered': 'delivered',
    'email.failed': 'failed',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
};

/** Maps a Resend event type to a delivery fact, or null for events that carry none (sent, opened, clicked). */
export function deliveryStatusForEventType(type: unknown): DeliveryStatus | null {
    return typeof type === 'string' ? EVENT_TYPE_TO_STATUS[type] ?? null : null;
}

/**
 * Applies one verified provider event.
 *
 * - The summary status only ever moves to a more significant fact
 *   (delayed < delivered < failed < bounced < complained), so a late or
 *   out-of-order "delivered" cannot erase a bounce or complaint.
 * - Each distinct provider event is kept once, keyed by its webhook message ID,
 *   so redeliveries do not inflate counts and bounce and complaint stay separate facts.
 * - An event for an unknown message stores nothing.
 */
export async function applyEmailDeliveryEvent(input: {
    providerMessageId: string;
    status: DeliveryStatus;
    webhookMessageId: string;
    db?: StatementExecutor;
}): Promise<{ matched: boolean }> {
    const db = input.db ?? getStatementExecutor();
    const isFailure = input.status === 'bounced' || input.status === 'complained' || input.status === 'failed';
    const rows = await db.run({
        text: `
            WITH matched AS (
                SELECT id, request_id FROM reminder_operations WHERE provider_message_id = $1 LIMIT 1
            ),
            ranks(status, rank) AS (
                VALUES ('delayed', 1), ('delivered', 2), ('failed', 3), ('bounced', 4), ('complained', 5)
            ),
            updated AS (
                UPDATE reminder_operations o
                SET delivery_status = $2, delivery_updated_at = NOW()
                FROM matched m
                WHERE o.id = m.id
                  AND COALESCE((SELECT rank FROM ranks WHERE status = o.delivery_status), 0)
                      < (SELECT rank FROM ranks WHERE status = $2)
                RETURNING o.id
            ),
            recorded AS (
                INSERT INTO operational_events (
                    category, code, outcome, severity, fingerprint, request_id, provider_event_id, metadata
                )
                SELECT 'email', 'reminder_' || $2, $4, $5, 'email:reminder_' || $2, m.request_id, $3,
                    jsonb_build_object('deliveryStatus', $2::text, 'operationId', m.id::text)
                FROM matched m
                WHERE $6::boolean
                ON CONFLICT (category, provider_event_id, outcome) WHERE provider_event_id IS NOT NULL
                DO UPDATE SET attempts = operational_events.attempts + 1, last_seen_at = NOW()
                RETURNING id
            )
            SELECT (SELECT COUNT(*) FROM matched)::int AS matched
        `,
        params: [
            input.providerMessageId,
            input.status,
            input.webhookMessageId.slice(0, 200),
            isFailure ? 'failure' : 'success',
            input.status === 'complained' ? 'critical' : isFailure ? 'warning' : 'info',
            // A delay is transient and is reflected in the summary status only.
            input.status !== 'delayed',
        ],
    });
    return { matched: Number(rows[0]?.matched ?? 0) > 0 };
}
