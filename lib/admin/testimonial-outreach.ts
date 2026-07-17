import { getResend } from '@/lib/resend';
import { sql } from '@/lib/neon/db';
import { isLikelyInternalOrTestAccount } from '@/lib/admin/testimonial-candidates';
import { buildTestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach-content';
import type { EffectivePlan, UserRole } from '@/types';

export { buildTestimonialOutreachEmail, TESTIMONIAL_OUTREACH_SUBJECT } from '@/lib/admin/testimonial-outreach-content';
export type { TestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach-content';
export const DEFAULT_TESTIMONIAL_OUTREACH_FROM = 'Haydn at UtilitySheet <haydn@utilitysheet.com>';
export const DEFAULT_TESTIMONIAL_OUTREACH_FALLBACK_FROM = 'UtilitySheet <noreply@utilitysheet.com>';
export const DEFAULT_TESTIMONIAL_OUTREACH_REPLY_TO = 'Haydn Watkins <haydn@multimedium.dev>';

export type TestimonialOutreachStatus = 'pending' | 'sent' | 'failed' | 'dry_run';

export type TestimonialOutreachRecipient = {
    id: string;
    email: string;
    fullName: string | null;
    companyName: string | null;
    role: UserRole;
    subscriptionStatus: EffectivePlan;
    effectivePlan: EffectivePlan;
    activeOrganizationId: string | null;
    businessName: string | null;
};

export type TestimonialOutreachLogSummary = {
    userId: string | null;
    lastSentAt: string | null;
    lastStatus: TestimonialOutreachStatus | null;
    resendEmailId: string | null;
};

export function getTestimonialOutreachSender() {
    return {
        from: process.env.TESTIMONIAL_OUTREACH_FROM || DEFAULT_TESTIMONIAL_OUTREACH_FROM,
        fallbackFrom: process.env.TESTIMONIAL_OUTREACH_FALLBACK_FROM || DEFAULT_TESTIMONIAL_OUTREACH_FALLBACK_FROM,
        replyTo: process.env.TESTIMONIAL_OUTREACH_REPLY_TO || DEFAULT_TESTIMONIAL_OUTREACH_REPLY_TO,
    };
}

function isLikelySenderCompatibilityError(message: string): boolean {
    return /from|sender|domain|verified|verification/i.test(message);
}

async function sendViaResendWithFallback(payload: {
    from: string;
    fallbackFrom: string;
    replyTo: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
}) {
    const resend = getResend();
    const primary = await resend.emails.send({
        from: payload.from,
        replyTo: payload.replyTo,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    }, { idempotencyKey: `${payload.idempotencyKey}:primary` });

    if (!primary.error || payload.from === payload.fallbackFrom || !isLikelySenderCompatibilityError(primary.error.message)) {
        return { ...primary, usedFrom: payload.from, primaryError: null as string | null };
    }

    const fallback = await resend.emails.send({
        from: payload.fallbackFrom,
        replyTo: payload.replyTo,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    }, { idempotencyKey: `${payload.idempotencyKey}:fallback` });

    return { ...fallback, usedFrom: payload.fallbackFrom, primaryError: primary.error.message as string | null };
}

function shouldDryRunEmail() {
    if (process.env.TESTIMONIAL_OUTREACH_DRY_RUN === 'true') return true;
    if (process.env.NODE_ENV !== 'production') {
        return process.env.TESTIMONIAL_OUTREACH_SEND_IN_DEV !== 'true';
    }
    return false;
}

export async function getTestimonialOutreachRecipient(userId: string): Promise<TestimonialOutreachRecipient | null> {
    if (!sql) return null;

    const rows = await sql`
        WITH team_memberships AS (
            SELECT
                om.account_id,
                BOOL_OR(o.subscription_status = 'team') AS has_team_plan,
                MIN(o.id::text) FILTER (WHERE o.subscription_status = 'team') AS team_organization_id,
                MIN(o.name) FILTER (WHERE o.subscription_status = 'team') AS team_organization_name
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            WHERE om.account_id = ${userId}
            GROUP BY om.account_id
        )
        SELECT
            a.id,
            a.email,
            a.full_name,
            a.company_name,
            a.role,
            a.subscription_status,
            CASE
                WHEN COALESCE(tm.has_team_plan, FALSE) THEN 'team'
                ELSE a.subscription_status
            END AS effective_plan,
            COALESCE(tm.team_organization_id::uuid, a.active_organization_id) AS active_organization_id,
            COALESCE(a.company_name, tm.team_organization_name) AS business_name
        FROM accounts a
        LEFT JOIN team_memberships tm ON tm.account_id = a.id
        WHERE a.id = ${userId}
        LIMIT 1
    `;

    const row = rows[0] as {
        id: string;
        email: string;
        full_name: string | null;
        company_name: string | null;
        role: UserRole;
        subscription_status: EffectivePlan;
        effective_plan: EffectivePlan;
        active_organization_id: string | null;
        business_name: string | null;
    } | undefined;

    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        companyName: row.company_name,
        role: row.role,
        subscriptionStatus: row.subscription_status,
        effectivePlan: row.effective_plan,
        activeOrganizationId: row.active_organization_id,
        businessName: row.business_name,
    };
}

export function validateTestimonialOutreachRecipient(recipient: TestimonialOutreachRecipient): string | null {
    if (!recipient.email?.trim()) return 'Recipient email is required';
    if (recipient.effectivePlan !== 'pro' && recipient.effectivePlan !== 'team') {
        return 'Testimonial outreach is limited to paying Pro or Teams users';
    }
    if (isLikelyInternalOrTestAccount({
        email: recipient.email,
        fullName: recipient.fullName,
        companyName: recipient.companyName,
        role: recipient.role,
    })) {
        return 'Internal, test, banned, or admin accounts cannot receive testimonial outreach';
    }
    return null;
}

export async function getLatestTestimonialOutreachLogs(userIds: string[]): Promise<Record<string, TestimonialOutreachLogSummary>> {
    if (!sql || userIds.length === 0) return {};

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return {};

    const rows = await sql`
        SELECT DISTINCT ON (user_id)
            user_id,
            sent_at,
            status,
            resend_email_id
        FROM testimonial_outreach_logs
        WHERE user_id = ANY(${uniqueUserIds}::uuid[])
        ORDER BY user_id, sent_at DESC NULLS LAST, created_at DESC
    `;

    const map: Record<string, TestimonialOutreachLogSummary> = {};
    for (const row of rows as Array<{
        user_id: string | null;
        sent_at: string | null;
        status: TestimonialOutreachStatus;
        resend_email_id: string | null;
    }>) {
        if (!row.user_id) continue;
        map[row.user_id] = {
            userId: row.user_id,
            lastSentAt: row.sent_at,
            lastStatus: row.status,
            resendEmailId: row.resend_email_id,
        };
    }
    return map;
}

export async function hasSuccessfulTestimonialOutreach(userId: string): Promise<boolean> {
    if (!sql) return false;

    const rows = await sql`
        SELECT id
        FROM testimonial_outreach_logs
        WHERE user_id = ${userId}
            AND status = 'sent'
        LIMIT 1
    `;

    return rows.length > 0;
}

async function createOutreachAttempt(input: {
    userId: string | null;
    orgId: string | null;
    recipientEmail: string;
    recipientName: string | null;
    subject: string;
    sentByAdminId: string | null;
    status: TestimonialOutreachStatus;
}) {
    if (!sql) return null;

    const rows = await sql`
        INSERT INTO testimonial_outreach_logs (
            user_id,
            org_id,
            recipient_email,
            recipient_name,
            subject,
            sent_by_admin_id,
            sent_at,
            status
        )
        VALUES (
            ${input.userId},
            ${input.orgId},
            ${input.recipientEmail},
            ${input.recipientName},
            ${input.subject},
            ${input.sentByAdminId},
            NOW(),
            ${input.status}
        )
        RETURNING id
    `;

    return rows[0]?.id as string | undefined;
}

async function updateOutreachAttempt(input: {
    id: string;
    status: TestimonialOutreachStatus;
    resendEmailId?: string | null;
    errorMessage?: string | null;
}) {
    if (!sql) return;

    await sql`
        UPDATE testimonial_outreach_logs
        SET
            status = ${input.status},
            resend_email_id = ${input.resendEmailId || null},
            error_message = ${input.errorMessage || null},
            sent_at = NOW()
        WHERE id = ${input.id}
    `;
}

export async function sendTestimonialOutreachEmail(input: {
    recipient: TestimonialOutreachRecipient;
    sentByAdminId: string | null;
    idempotencyKey: string;
    allowDryRun?: boolean;
}): Promise<{ success: true; resendEmailId?: string; dryRun?: boolean } | { success: false; error: string }> {
    const email = buildTestimonialOutreachEmail({
        recipientName: input.recipient.fullName,
        businessName: input.recipient.businessName,
    });
    const sender = getTestimonialOutreachSender();
    const dryRun = input.allowDryRun !== false && shouldDryRunEmail();

    const attemptId = await createOutreachAttempt({
        userId: input.recipient.id,
        orgId: input.recipient.activeOrganizationId,
        recipientEmail: input.recipient.email,
        recipientName: input.recipient.fullName,
        subject: email.subject,
        sentByAdminId: input.sentByAdminId,
        status: dryRun ? 'dry_run' : 'pending',
    });

    const payload = {
        from: sender.from,
        fallbackFrom: sender.fallbackFrom,
        replyTo: sender.replyTo,
        to: input.recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: input.idempotencyKey,
    };

    if (dryRun) {
        console.info('[testimonial-outreach] dry run email payload', payload);
        return { success: true, dryRun: true };
    }

    if (!process.env.RESEND_API_KEY) {
        const error = 'RESEND_API_KEY environment variable is not set';
        if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: error });
        return { success: false, error };
    }

    try {
        const { data, error, usedFrom, primaryError } = await sendViaResendWithFallback(payload);
        if (error) {
            if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: error.message });
            return { success: false, error: error.message };
        }

        if (attemptId) {
            await updateOutreachAttempt({
                id: attemptId,
                status: 'sent',
                resendEmailId: data?.id || null,
                errorMessage: primaryError ? `Primary sender failed; sent via fallback ${usedFrom}. Primary error: ${primaryError}` : null,
            });
        }

        return { success: true, resendEmailId: data?.id };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: message });
        return { success: false, error: message };
    }
}

export async function sendTestimonialOutreachTestEmail(input: {
    toEmail: string;
    toName: string | null;
    sentByAdminId: string | null;
    idempotencyKey: string;
}): Promise<{ success: true; resendEmailId?: string; dryRun?: boolean } | { success: false; error: string }> {
    const email = buildTestimonialOutreachEmail({
        recipientName: input.toName,
        businessName: null,
    });
    const sender = getTestimonialOutreachSender();
    const dryRun = shouldDryRunEmail();

    const attemptId = await createOutreachAttempt({
        userId: null,
        orgId: null,
        recipientEmail: input.toEmail,
        recipientName: input.toName,
        subject: `[Test] ${email.subject}`,
        sentByAdminId: input.sentByAdminId,
        status: dryRun ? 'dry_run' : 'pending',
    });

    const payload = {
        from: sender.from,
        fallbackFrom: sender.fallbackFrom,
        replyTo: sender.replyTo,
        to: input.toEmail,
        subject: `[Test] ${email.subject}`,
        html: email.html,
        text: email.text,
        idempotencyKey: input.idempotencyKey,
    };

    if (dryRun) {
        console.info('[testimonial-outreach] dry run test email payload', payload);
        return { success: true, dryRun: true };
    }

    if (!process.env.RESEND_API_KEY) {
        const error = 'RESEND_API_KEY environment variable is not set';
        if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: error });
        return { success: false, error };
    }

    try {
        const { data, error, usedFrom, primaryError } = await sendViaResendWithFallback(payload);
        if (error) {
            if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: error.message });
            return { success: false, error: error.message };
        }
        if (attemptId) {
            await updateOutreachAttempt({
                id: attemptId,
                status: 'sent',
                resendEmailId: data?.id || null,
                errorMessage: primaryError ? `Primary sender failed; sent via fallback ${usedFrom}. Primary error: ${primaryError}` : null,
            });
        }
        return { success: true, resendEmailId: data?.id };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (attemptId) await updateOutreachAttempt({ id: attemptId, status: 'failed', errorMessage: message });
        return { success: false, error: message };
    }
}
