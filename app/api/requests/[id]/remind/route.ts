import { NextResponse } from 'next/server';
import { getRequestById, getOrCreateAccount, getBrandProfile, createEventLog } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import { stackServerApp } from '@/lib/stack/server';
import { sendSellerReminderEmail } from '@/lib/email/email-service';
import { reminderRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';

const REMINDER_COOLDOWN_MS = 10 * 60 * 1000;

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
        if (requestData.account_id !== account.id && requestData.organization_id !== account.active_organization_id) {
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

        if (sql) {
            const latestReminder = await sql`
                SELECT created_at
                FROM event_logs
                WHERE request_id = ${requestId}
                  AND event_type = 'reminder_sent'
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const mostRecent = latestReminder[0]?.created_at ? new Date(latestReminder[0].created_at as string) : null;
            if (mostRecent && Number.isFinite(mostRecent.getTime())) {
                const elapsedMs = Date.now() - mostRecent.getTime();
                if (elapsedMs < REMINDER_COOLDOWN_MS) {
                    const retryAfter = Math.ceil((REMINDER_COOLDOWN_MS - elapsedMs) / 1000);
                    return NextResponse.json(
                        {
                            error: 'Reminder recently sent. Please wait before sending another reminder.',
                            code: 'REMINDER_COOLDOWN_ACTIVE',
                            retryAfterSeconds: retryAfter,
                        },
                        {
                            status: 429,
                            headers: {
                                ...getRateLimitHeaders(rateLimitResult),
                                'Retry-After': retryAfter.toString(),
                            },
                        }
                    );
                }
            }
        }

        // Get agent name for the email
        let agentName: string | undefined;
        let brandProfile = null;
        if (requestData.brand_profile_id) {
            brandProfile = await getBrandProfile(requestData.brand_profile_id);
            agentName = brandProfile?.contact_name || undefined;
        }

        if (!agentName) {
            agentName = account.full_name || user.displayName || undefined;
        }

        const result = await sendSellerReminderEmail({
            sellerEmail: requestData.seller_email,
            sellerName: requestData.seller_name || undefined,
            propertyAddress: requestData.property_address,
            closingDate: requestData.closing_date || undefined,
            agentName,
            brandProfile: brandProfile || undefined,
            sellerToken: requestData.seller_token || requestData.public_token,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send reminder' }, { status: 500 });
        }

        const userAgent = request.headers.get('user-agent') || null;
        await createEventLog({
            requestId: requestData.id,
            eventType: 'reminder_sent',
            eventData: {
                actor: 'agent',
                channel: 'email',
            },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rateLimitResult) });
    } catch (error) {
        console.error('Error sending reminder:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

