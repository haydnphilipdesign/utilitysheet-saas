import { NextResponse } from 'next/server';
import { PACKET_LOCKED_MESSAGE } from '@/lib/packet/packet-data';
import { createPacketPdfAttachmentForPublicToken } from '@/lib/pdf/packet-attachment';

export const runtime = 'nodejs';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const attachmentResult = await createPacketPdfAttachmentForPublicToken(token);

        if (attachmentResult.status === 'attached') {
            const safeFilename = attachmentResult.attachment.filename.replaceAll('"', '');
            return new NextResponse(new Uint8Array(attachmentResult.attachment.content), {
                status: 200,
                headers: {
                    'Content-Type': attachmentResult.attachment.contentType,
                    'Content-Disposition': `attachment; filename="${safeFilename}"`,
                    'Cache-Control': 'no-store',
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

            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    } catch (error) {
        console.error('Error generating packet PDF:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
