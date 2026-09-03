import { NextResponse } from 'next/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { createQuestionRequest } from '@/lib/neon/queries';
import {
    checkRateLimit,
    getRateLimitHeaders,
    isRateLimitUnavailable,
    questionRequestRatelimit,
} from '@/lib/rate-limit';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';
import { stackServerApp } from '@/lib/stack/server';
import { questionRequestBodySchema } from '@/lib/validation/schemas';

const QUESTION_REQUEST_MAX_BODY_BYTES = 4 * 1024;

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

        const payloadTooLarge = enforceMaxRequestBodyBytes(request, QUESTION_REQUEST_MAX_BODY_BYTES);
        if (payloadTooLarge) {
            return payloadTooLarge;
        }

        const rateLimitResult = await checkRateLimit(questionRequestRatelimit, activationState.account.id);
        const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Question requests are temporarily unavailable. Please try again shortly.' },
                { status: 503, headers: rateLimitHeaders }
            );
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many question requests. Please try again later.' },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        const body = await request.json().catch(() => ({}));
        const parsedBody = questionRequestBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse(
                'INVALID_QUESTION_REQUEST',
                'Describe the question you want added in 3 to 300 characters.'
            );
        }

        await createQuestionRequest({
            accountId: activationState.account.id,
            organizationId: activationState.activeOrganization?.id || null,
            requestedText: parsedBody.data.requestedText,
            context: parsedBody.data.context,
            packetMode: parsedBody.data.packetMode,
        });

        return NextResponse.json({ ok: true }, { headers: rateLimitHeaders });
    } catch {
        console.error('Failed to create question request');
        return NextResponse.json({ error: 'Failed to save question request.' }, { status: 500 });
    }
}
