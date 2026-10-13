import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';
import { maintenanceResponse } from '@/lib/maintenance/server';
import { NextResponse } from 'next/server';
import { PACKET_LOCKED_MESSAGE } from '@/lib/packet/packet-data';
import { createPacketPdfAttachmentForPublicToken } from '@/lib/pdf/packet-attachment';
import { packetPdfRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';
import { errorNameOf, recordOperationalEvent, recordOperationalSuccess } from '@/lib/ops/events';
import { recordHandoffEvidence } from '@/lib/neon/queries/handoff-evidence';
import { pdfFailureReasonCode, pdfObservationFromEvidence } from '@/lib/telemetry/handoff-evidence';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    // Paused for a planned cutover: refuse before the limiter and every side effect.
    const maintenance = maintenanceResponse('packet_pdf', request);
    if (maintenance) return maintenance;

    try {
        const { token } = await params;
        const ip = getClientIp(request);
        const rateLimitResult = await checkRateLimit(packetPdfRatelimit, capabilityRateLimitIdentifier('packet-pdf', `${token}:${ip}`), { requirePersistent: process.env.NODE_ENV === 'production' });

        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Wait a moment and try again.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        const attachmentResult = await createPacketPdfAttachmentForPublicToken(token);

        // Execution evidence for a resolved request only: an unknown link stores nothing.
        const recordPdfEvidence = (httpStatus: number) => {
            const observation = pdfObservationFromEvidence(attachmentResult.evidence, { surface: 'download', httpStatus });
            return observation ? recordHandoffEvidence({ notifications: [], pdfRenders: [observation] }) : Promise.resolve(false);
        };

        if (attachmentResult.status === 'attached') {
            await Promise.all([
                recordOperationalSuccess({ category: 'pdf', code: 'generation_failed' }),
                recordPdfEvidence(200),
            ]);
            const safeFilename = attachmentResult.attachment.filename.replaceAll('"', '');
            return new NextResponse(new Uint8Array(attachmentResult.attachment.content), {
                status: 200,
                headers: {
                    'Content-Type': attachmentResult.attachment.contentType,
                    'Content-Disposition': `attachment; filename="${safeFilename}"`,
                    'Cache-Control': 'no-store',
                    ...getRateLimitHeaders(rateLimitResult),
                },
            });
        }

        if (attachmentResult.status === 'skipped') {
            if (attachmentResult.reason === 'locked') {
                await recordPdfEvidence(402);
                return NextResponse.json(
                    {
                        error: 'Upgrade required',
                        message: PACKET_LOCKED_MESSAGE,
                    },
                    { status: 402 }
                );
            }

            await recordPdfEvidence(404);
            return NextResponse.json(
                { error: 'Request not found' },
                { status: 404, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        // Invalid tokens, locked packets and rate limits above are expected outcomes, not incidents.
        await Promise.all([
            recordOperationalEvent({
                category: 'pdf',
                code: 'generation_failed',
                outcome: 'failure',
                requestId: attachmentResult.evidence?.requestId ?? null,
                // The stage that failed: data lookup, HTML build, browser launch, page load or render.
                metadata: { reasonCode: pdfFailureReasonCode(attachmentResult.evidence) },
            }),
            recordPdfEvidence(500),
        ]);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500, headers: getRateLimitHeaders(rateLimitResult) }
        );
    } catch (error) {
        await recordOperationalEvent({
            category: 'pdf',
            code: 'generation_failed',
            outcome: 'failure',
            metadata: { reasonCode: 'route_exception', errorName: errorNameOf(error) },
        });
        logDiagnostic('error', 'packet_pdf_failed', {}, error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}

