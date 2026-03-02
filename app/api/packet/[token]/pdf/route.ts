import { NextResponse } from 'next/server';
import { PACKET_LOCKED_MESSAGE } from '@/lib/packet/packet-data';
import { createPacketPdfAttachmentForPublicToken } from '@/lib/pdf/packet-attachment';
import { packetPdfRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const ip = getClientIp(request);
        const rateLimitResult = await checkRateLimit(packetPdfRatelimit, `${token}:${ip}`, { requirePersistent: process.env.NODE_ENV === 'production' });

        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        const attachmentResult = await createPacketPdfAttachmentForPublicToken(token);

        if (attachmentResult.status === 'attached') {
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
                return NextResponse.json(
                    {
                        error: 'Upgrade required',
                        message: PACKET_LOCKED_MESSAGE,
                    },
                    { status: 402 }
                );
            }

            return NextResponse.json(
                { error: 'Request not found' },
                { status: 404, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500, headers: getRateLimitHeaders(rateLimitResult) }
        );
    } catch (error) {
        console.error('Error generating packet PDF:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}

