import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/lib/stack/server';
import { sendFeedbackEmail } from '@/lib/email/email-service';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';

const FEEDBACK_MAX_BODY_BYTES = 8 * 1024;

const feedbackBodySchema = z.object({
    message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, FEEDBACK_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const body = await request.json().catch(() => ({}));
        const parsed = feedbackBodySchema.safeParse(body);
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_FEEDBACK_BODY', 'Message is required');
        }

        const result = await sendFeedbackEmail({
            userEmail: user.primaryEmail || 'unknown@example.com',
            message: parsed.data.message,
            userId: user.id,
            userName: user.displayName || undefined,
        });

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
