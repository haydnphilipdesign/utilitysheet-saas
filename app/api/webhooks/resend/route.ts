import { NextResponse } from 'next/server';
import { getResend } from '@/lib/resend';
import { applyEmailDeliveryEvent, deliveryStatusForEventType } from '@/lib/ops/email-delivery';
import { errorNameOf } from '@/lib/ops/events';
import { isMissingRelationError } from '@/lib/neon/statements';

export const runtime = 'nodejs';

/**
 * Resend delivery webhook (delivered, delayed, bounced, complained, failed).
 *
 * The signature is verified against the raw request body with the Resend SDK
 * before anything is parsed or stored. Only the event type and the provider
 * message ID are read; the payload itself is never persisted or logged.
 *
 * Registering this endpoint with Resend and setting RESEND_WEBHOOK_SECRET are
 * separate owner-approved release steps. Until then it reports "not configured".
 */
export async function POST(request: Request) {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signature = request.headers.get('svix-signature');
    if (!id || !timestamp || !signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Raw body: the signature is sensitive to any re-serialization.
    const payload = await request.text();

    let event: unknown;
    try {
        event = getResend().webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret });
    } catch {
        // Invalid signatures are not trusted events and are not recorded as incidents.
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const body = (event && typeof event === 'object' ? event : {}) as { type?: unknown; data?: { email_id?: unknown } };
    const status = deliveryStatusForEventType(body.type);
    const providerMessageId = typeof body.data?.email_id === 'string' ? body.data.email_id : null;
    if (!status || !providerMessageId || providerMessageId.length > 200) {
        // Verified, but not a delivery fact we track (for example sent, opened, clicked).
        return NextResponse.json({ received: true, tracked: false });
    }

    try {
        const { matched } = await applyEmailDeliveryEvent({ providerMessageId, status, webhookMessageId: id });
        return NextResponse.json({ received: true, tracked: matched });
    } catch (error) {
        // A failed durable write must be retried by the provider, not acknowledged.
        console.error(JSON.stringify({
            level: 'error',
            message: 'resend_webhook_write_failed',
            migrationPending: isMissingRelationError(error),
            errorName: errorNameOf(error),
        }));
        return NextResponse.json({ error: 'Temporarily unable to record event' }, { status: 503 });
    }
}
