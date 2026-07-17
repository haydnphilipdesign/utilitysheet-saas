import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/lib/stack/server';
import { brandProfileCreateBodySchema } from '@/lib/validation/schemas';
import { normalizeMessageTemplates } from '@/lib/message-templates';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { reminderRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { sendSellerNotificationEmail, sendSellerReminderEmail } from '@/lib/email/email-service';

export const runtime = 'nodejs';

const testEmailBodySchema = z
    .object({
        branding: brandProfileCreateBodySchema.partial(),
        kind: z.enum(['request', 'reminder']).optional(),
    })
    .strip();

// Sample seller data for the test email. No real request/token is involved;
// the link points at a harmless placeholder path.
const SAMPLE_SELLER_NAME = 'Jordan Rivera';
const SAMPLE_PROPERTY_ADDRESS = '123 Maple Ave, Austin, TX';
const SAMPLE_CLOSING_DATE = '2026-08-01T12:00:00.000Z';

/**
 * POST /api/branding/test-email
 *
 * Sends a sample seller request (or reminder) email rendered from unsaved
 * branding form values. Safe by construction: the only recipient is the
 * authenticated user's own verified email; an arbitrary recipient can never be
 * supplied. Rate limited per user. In tests the email service is mocked, so no
 * real external mail is sent.
 */
export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const recipient = user.primaryEmail;
        if (!recipient) {
            return NextResponse.json(
                { error: 'Your account has no verified email to send the test to.' },
                { status: 400 }
            );
        }

        const rateLimitResult = await checkRateLimit(reminderRatelimit, `branding-test-email:${user.id}`, {
            requirePersistent: process.env.NODE_ENV === 'production',
        });

        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const body = await request.json();
        const parsedBody = testEmailBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse();
        }

        const branding = parsedBody.data.branding;
        const brandProfile = {
            name: branding.name || 'Your Brand',
            logo_url: branding.logo_url ?? null,
            primary_color: branding.primary_color || '#10b981',
            secondary_color: branding.secondary_color || '#059669',
            contact_name: branding.contact_name ?? null,
            contact_email: branding.contact_email ?? null,
            contact_phone: branding.contact_phone ?? null,
            company_name: branding.company_name ?? null,
            license_number: branding.license_number ?? null,
            license_state: branding.license_state ?? null,
            compliance_line: branding.compliance_line ?? null,
            message_templates: normalizeMessageTemplates(branding.message_templates) ?? {},
        };

        const send = parsedBody.data.kind === 'reminder' ? sendSellerReminderEmail : sendSellerNotificationEmail;
        const result = await send({
            sellerEmail: recipient,
            sellerName: SAMPLE_SELLER_NAME,
            propertyAddress: SAMPLE_PROPERTY_ADDRESS,
            closingDate: SAMPLE_CLOSING_DATE,
            agentName: branding.contact_name || undefined,
            brandProfile,
            sellerToken: 'preview',
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send test email' }, { status: 502 });
        }

        return NextResponse.json(
            { success: true, sentTo: recipient },
            { headers: getRateLimitHeaders(rateLimitResult) }
        );
    } catch (error) {
        console.error('Error sending branding test email:', error);
        return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
    }
}
