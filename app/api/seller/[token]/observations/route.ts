import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { insertSellerObservations, type SellerObservationRow } from '@/lib/neon/queries/seller-observations';
import { checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable, sellerObservationRatelimit } from '@/lib/rate-limit';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';
import { getClientIp } from '@/lib/network/client-ip';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';
import { sellerObservationBodySchema } from '@/lib/validation/schemas';
import { writeAuxiliary } from '@/lib/telemetry/auxiliary-write';
import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import {
    SELLER_OBSERVATION_MAX_BODY_BYTES,
    coarseClientFamily,
} from '@/lib/telemetry/seller-observations';

export const runtime = 'nodejs';

const ACCEPTED = { ok: true };

// POST /api/seller/[token]/observations - advisory browser diagnostics for the seller form.
// The seller link authorizes the write; the request, test/live mode and client
// family are resolved here. The link itself is never stored or logged.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!token || token.length > 200) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const tooLarge = enforceMaxRequestBodyBytes(request, SELLER_OBSERVATION_MAX_BODY_BYTES);
        if (tooLarge) return tooLarge;

        const ip = getClientIp(request);
        const rateLimitResult = await checkRateLimit(
            sellerObservationRatelimit,
            capabilityRateLimitIdentifier('seller-observation', `${token}:${ip}`),
            { requirePersistent: process.env.NODE_ENV === 'production' }
        );
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const rawBody = await request.text();
        if (rawBody.length > SELLER_OBSERVATION_MAX_BODY_BYTES) {
            return NextResponse.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
        }
        let json: unknown;
        try {
            json = JSON.parse(rawBody);
        } catch {
            return invalidRequestBodyResponse('INVALID_SELLER_OBSERVATION', 'Invalid observation');
        }
        const parsed = sellerObservationBodySchema.safeParse(json);
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_SELLER_OBSERVATION', 'Invalid observation');
        }

        const requestData =
            (await getRequestBySellerToken(token)) ||
            (await getRequestByToken(token));
        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Enforce seller-token access when available (prevents packet token from granting write-side access)
        if (requestData.seller_token && requestData.seller_token !== requestData.public_token) {
            if (token !== requestData.seller_token) {
                return NextResponse.json({ error: 'Request not found' }, { status: 404 });
            }
        }

        const record = requestData as { id: string; is_demo?: boolean | null; seller_edit_version?: number | null };
        const serverEditVersion = Number(record.seller_edit_version ?? 0);
        const currentEditVersion = Number.isInteger(serverEditVersion) && serverEditVersion > 0 ? serverEditVersion : 0;
        // An editing session this request has not reached cannot have been shown to a seller.
        if (parsed.data.edit_version > currentEditVersion) {
            return NextResponse.json(ACCEPTED, { status: 202 });
        }

        const family = coarseClientFamily(request.headers.get('user-agent'));
        const rows: SellerObservationRow[] = parsed.data.events.map((event) => {
            const { type, id, seq, ...fields } = event;
            return {
                eventType: type,
                eventId: id,
                eventData: {
                    v: parsed.data.v,
                    actor: 'seller_browser',
                    mode: record.is_demo === true ? 'test' : 'live',
                    session_id: parsed.data.session,
                    event_id: id,
                    seq,
                    edit_version: parsed.data.edit_version,
                    device: family.device,
                    browser: family.browser,
                    ...fields,
                },
            };
        });

        // Best effort: a failed or slow write is not the seller's problem and is not retried here.
        await writeAuxiliary(
            'seller_observation',
            (signal) => insertSellerObservations({ requestId: record.id, rows }, { signal }),
            0
        );

        return NextResponse.json(ACCEPTED, { status: 202 });
    } catch (error) {
        logDiagnostic('error', 'seller_observation_failed', {}, error);
        return NextResponse.json({ error: 'Failed to record observation' }, { status: 500 });
    }
}
