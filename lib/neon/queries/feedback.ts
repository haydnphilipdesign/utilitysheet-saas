import { sql } from '@/lib/neon/db';
import type { FeedbackCategory } from '@/lib/feedback/constants';

/** Stores one feedback submission and returns its id, or null when no database is configured. */
export async function createFeedbackSubmission(params: {
    accountId: string;
    organizationId: string | null;
    category: FeedbackCategory;
    message: string;
    pagePath: string | null;
    viewport: string | null;
    userAgent: string | null;
}): Promise<string | null> {
    if (!sql) return null;

    const rows = await sql`
        INSERT INTO feedback_submissions (
            account_id,
            organization_id,
            category,
            message,
            page_path,
            viewport,
            user_agent
        ) VALUES (
            ${params.accountId},
            ${params.organizationId},
            ${params.category},
            ${params.message},
            ${params.pagePath},
            ${params.viewport},
            ${params.userAgent}
        )
        RETURNING id
    `;
    return (rows[0]?.id as string | undefined) ?? null;
}

export async function setFeedbackEmailStatus(feedbackId: string, status: 'sent' | 'failed') {
    if (!sql) return;

    await sql`
        UPDATE feedback_submissions
        SET email_status = ${status}
        WHERE id = ${feedbackId}
    `;
}
