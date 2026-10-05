import { NextResponse } from 'next/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { stackServerApp } from '@/lib/stack/server';
import { sendFeedbackEmail } from '@/lib/email/email-service';
import { createFeedbackSubmission, setFeedbackEmailStatus } from '@/lib/neon/queries';
import {
    checkRateLimit,
    feedbackRatelimit,
    getRateLimitHeaders,
    isRateLimitUnavailable,
} from '@/lib/rate-limit';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';
import { feedbackBodySchema } from '@/lib/validation/schemas';

const FEEDBACK_MAX_BODY_BYTES = 8 * 1024;
const USER_AGENT_MAX_LENGTH = 400;

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, FEEDBACK_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const rateLimitResult = await checkRateLimit(feedbackRatelimit, activationState.account.id);
        const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Feedback is temporarily unavailable. Please try again shortly.' },
                { status: 503, headers: rateLimitHeaders }
            );
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many messages. Please try again in a few minutes.' },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsed = feedbackBodySchema.safeParse(body);
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_FEEDBACK_BODY', 'Message is required');
        }

        // The stored row is the record; the email is a notification. Storage is
        // attempted first and a failure (including a pending migration) falls
        // back to email, so the customer's message is lost only if both fail.
        let feedbackId: string | null = null;
        try {
            feedbackId = await createFeedbackSubmission({
                accountId: activationState.account.id,
                organizationId: activationState.activeOrganization?.id || null,
                category: parsed.data.category,
                message: parsed.data.message,
                pagePath: parsed.data.pagePath ?? null,
                viewport: parsed.data.viewport ?? null,
                userAgent: request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) || null,
            });
        } catch {
            console.error('Failed to store feedback');
        }

        const emailResult = await sendFeedbackEmail({
            userEmail: user.primaryEmail || null,
            message: parsed.data.message,
            userId: user.id,
            userName: user.displayName || undefined,
            category: parsed.data.category,
            pagePath: parsed.data.pagePath ?? null,
            stored: Boolean(feedbackId),
        });

        if (feedbackId) {
            try {
                await setFeedbackEmailStatus(feedbackId, emailResult.success ? 'sent' : 'failed');
            } catch {
                console.error('Failed to record feedback email status');
            }
        }

        if (!feedbackId && !emailResult.success) {
            return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500, headers: rateLimitHeaders });
        }

        return NextResponse.json({ success: true }, { headers: rateLimitHeaders });
    } catch {
        console.error('Error submitting feedback');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
