import { sql } from '@/lib/neon/db';
import { REQUEST_NEEDS_ATTENTION_WINDOW_DAYS } from '@/lib/requests/listing';

/** Hours of seller inactivity before the one automatic reminder is sent. */
export const AUTOMATIC_REMINDER_AFTER_HOURS = 24;

export type AutomaticReminderCandidate = {
    request_id: string;
    owner_account_id: string;
    owner_full_name: string | null;
};

/**
 * Requests due their one automatic reminder: the owner turned on
 * `auto_seller_reminders`, the seller has an email, opened or was sent the
 * form but never submitted, has been quiet for a day, and the request is
 * recent. Any earlier reminder on the request, manual or automatic, in any
 * state, rules it out; the reminder claim adds its own cooldown on top.
 */
export async function getDueAutomaticReminderCandidates(limit = 25): Promise<AutomaticReminderCandidate[]> {
    if (!sql) return [];

    const result = await sql`
        SELECT r.id AS request_id, a.id AS owner_account_id, a.full_name AS owner_full_name
        FROM requests r
        JOIN accounts a ON a.id = r.account_id
        WHERE r.deleted_at IS NULL
          AND COALESCE(r.is_demo, FALSE) = FALSE
          AND COALESCE(r.is_locked, FALSE) = FALSE
          AND r.status IN ('sent', 'in_progress')
          AND r.metered_at IS NULL
          AND COALESCE(r.seller_email, '') <> ''
          AND r.created_at >= NOW() - (${REQUEST_NEEDS_ATTENTION_WINDOW_DAYS} * INTERVAL '1 day')
          AND COALESCE(r.last_activity_at, r.created_at) < NOW() - (${AUTOMATIC_REMINDER_AFTER_HOURS} * INTERVAL '1 hour')
          AND a.role = 'user'
          AND a.closure_status = 'active'
          AND a.notification_preferences->>'auto_seller_reminders' = 'true'
          AND NOT EXISTS (SELECT 1 FROM reminder_operations ro WHERE ro.request_id = r.id)
          AND NOT EXISTS (
              SELECT 1 FROM event_logs e
              WHERE e.request_id = r.id AND e.event_type = 'reminder_sent'
          )
        ORDER BY COALESCE(r.last_activity_at, r.created_at) ASC
        LIMIT ${Math.max(1, Math.min(limit, 100))}
    `;

    return result as AutomaticReminderCandidate[];
}
