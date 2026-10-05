import { NextResponse } from 'next/server';
import { getRequestById, getOrCreateAccount } from '@/lib/neon/queries';
import { REMINDER_COOLDOWN_SECONDS } from '@/lib/neon/queries/reminder-operations';
import { DatabaseUnavailableError, isMissingRelationError } from '@/lib/neon/statements';
import { stackServerApp } from '@/lib/stack/server';
import { executeSellerReminder, prepareSellerReminder } from '@/lib/reminders/seller-reminder';
import { reminderRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import { canAccessOwnedOrActiveOrganizationResource } from '@/lib/auth/organization-access';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { id: requestId } = await params;
        const requestData = await getRequestById(requestId);

        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Security check: Ensure the request belongs to the user or their organization
        if (!await canAccessOwnedOrActiveOrganizationResource(account, requestData)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!requestData.seller_email) {
            return NextResponse.json({ error: 'Seller email is required to send a reminder' }, { status: 400 });
        }

        const ipAddress = getClientIpOrNull(request);
        const rateLimitResult = await checkRateLimit(
            reminderRatelimit,
            `${account.id}:${requestId}:${ipAddress || 'unknown'}`,
            { requirePersistent: process.env.NODE_ENV === 'production' }
        );

        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please wait before sending another reminder.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        // Same claim, cooldown and outcome record as Admin reminders, so the two
        // paths cannot double-send. See lib/reminders/seller-reminder.ts.
        const prepared = await prepareSellerReminder({
            requestId,
            adminPolicy: false,
            request: requestData,
            fallbackAgentName: account.full_name || user.displayName || undefined,
        });
        if (!prepared.ok) {
            return NextResponse.json({ error: 'Seller email is required to send a reminder' }, { status: 400 });
        }

        const headers = getRateLimitHeaders(rateLimitResult);
        let result: Awaited<ReturnType<typeof executeSellerReminder>>;
        try {
            result = await executeSellerReminder({
                operationId: crypto.randomUUID(),
                prepared: prepared.prepared,
                actor: {
                    type: 'agent',
                    accountId: account.id,
                    ipAddress,
                    userAgent: request.headers.get('user-agent') || null,
                },
            });
        } catch (error) {
            if (isMissingRelationError(error) || error instanceof DatabaseUnavailableError) {
                // Fail closed: without the operation record a double send cannot be prevented.
                return NextResponse.json(
                    { error: 'Temporarily unavailable. Please try again shortly.' },
                    { status: 503 }
                );
            }
            throw error;
        }

        if (result.status === 'accepted' || result.status === 'accepted_unrecorded') {
            return NextResponse.json({ success: true }, { headers });
        }

        if (result.status === 'blocked' && result.code === 'COOLDOWN') {
            const retryAfter = result.retryAfterSeconds ?? REMINDER_COOLDOWN_SECONDS;
            return NextResponse.json(
                {
                    error: 'Reminder recently sent. Please wait before sending another reminder.',
                    code: 'REMINDER_COOLDOWN_ACTIVE',
                    retryAfterSeconds: retryAfter,
                },
                { status: 429, headers: { ...headers, 'Retry-After': retryAfter.toString() } }
            );
        }

        if (result.status === 'blocked' && (result.code === 'IN_FLIGHT' || result.code === 'UNRESOLVED')) {
            return NextResponse.json(
                {
                    error: 'A reminder for this request is already being sent or was just attempted. Please wait before sending another.',
                    code: result.code === 'IN_FLIGHT' ? 'REMINDER_IN_PROGRESS' : 'REMINDER_OUTCOME_PENDING',
                },
                { status: 409, headers }
            );
        }

        if (result.status === 'blocked' && result.code === 'RECIPIENT_CHANGED') {
            return NextResponse.json(
                { error: 'The seller email changed. Refresh and try again.', code: 'REMINDER_RECIPIENT_CHANGED' },
                { status: 409, headers }
            );
        }

        if (result.status === 'unknown') {
            return NextResponse.json(
                {
                    error: 'We could not confirm whether the reminder was sent. Please wait before trying again.',
                    code: 'REMINDER_OUTCOME_UNKNOWN',
                },
                { status: 502, headers }
            );
        }

        // Definitive provider rejection or a request that became ineligible. Provider detail stays in server logs.
        return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500, headers });
    } catch (error) {
        console.error('Error sending reminder:', error instanceof Error ? error.name : 'unknown');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
