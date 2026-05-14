import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken, getDefaultBrandProfile, getAccountById, createEventLog } from '@/lib/neon/queries';
import { sql } from '@/lib/neon/db';
import { sendSellerReminderEmail } from '@/lib/email/email-service';
import { reminderRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';

export const runtime = 'nodejs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const rateLimitResult = await checkRateLimit(reminderRatelimit, `seller-send-link:${token}`, {
            requirePersistent: process.env.NODE_ENV === 'production',
        });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment before trying again.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const body = await request.json().catch(() => null) as { email?: string } | null;
        const emailRaw = typeof body?.email === 'string' ? body.email.trim() : '';
        if (!emailRaw || !EMAIL_PATTERN.test(emailRaw) || emailRaw.length > 254) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
        }

        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));
        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Enforce seller-token access when available
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Request not found' }, { status: 404 });
            }
        }

        let brandProfile = null;
        if (requestData.brand_profile_id && sql) {
            const result = await sql`SELECT * FROM brand_profiles WHERE id = ${requestData.brand_profile_id}`;
            brandProfile = result[0] || null;
        }
        if (!brandProfile) {
            brandProfile = await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined);
        }

        const account = await getAccountById(requestData.account_id);
        const agentName = brandProfile?.contact_name || account?.full_name || undefined;

        const result = await sendSellerReminderEmail({
            sellerEmail: emailRaw,
            sellerName: requestData.seller_name || undefined,
            propertyAddress: requestData.property_address,
            closingDate: requestData.closing_date || undefined,
            agentName,
            brandProfile: brandProfile || undefined,
            sellerToken: requestData.seller_token || requestData.public_token,
        } as Parameters<typeof sendSellerReminderEmail>[0]);

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
        }

        const ipAddress = getClientIpOrNull(request);
        const userAgent = request.headers.get('user-agent') || null;
        await createEventLog({
            requestId: requestData.id,
            eventType: 'seller_self_send_link',
            eventData: { actor: 'seller', channel: 'email' },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending seller self-link email:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
