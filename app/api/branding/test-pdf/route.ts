import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stackServerApp } from '@/lib/stack/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { buildBrandingPreviewPacketData } from '@/lib/branding/preview-data';
import { createPacketPdfAttachmentFromData } from '@/lib/pdf/packet-attachment';
import { brandProfileCreateBodySchema } from '@/lib/validation/schemas';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { packetPdfRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const testPdfBodySchema = z
    .object({
        branding: brandProfileCreateBodySchema.partial(),
        mode: z.enum(['simple', 'advanced']).optional(),
    })
    .strip();

/**
 * POST /api/branding/test-pdf
 *
 * Renders a sample Utility Info Sheet / Seller Transition Packet from unsaved
 * branding form values through the production Chromium pipeline, so the test
 * download has real pagination, selectable text, running headers, and page
 * numbers. Plan gating is applied server-side: Free accounts always receive
 * the Simple sheet with forced display options and default buyer steps.
 */
export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimitResult = await checkRateLimit(packetPdfRatelimit, `branding-test:${user.id}`, {
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
        const parsedBody = testPdfBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse();
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { account, activeOrganization } = activationState;
        const isPro = account.subscription_status === 'pro' || activeOrganization?.subscription_status === 'team';

        const packetData = buildBrandingPreviewPacketData(parsedBody.data.branding, {
            mode: parsedBody.data.mode,
            isPro,
        });

        const attachment = await createPacketPdfAttachmentFromData(packetData);
        const filename = packetData.mode === 'advanced'
            ? 'seller-transition-packet-preview.pdf'
            : 'utility-info-sheet-preview.pdf';

        return new NextResponse(new Uint8Array(attachment.content), {
            status: 200,
            headers: {
                'Content-Type': attachment.contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
                ...getRateLimitHeaders(rateLimitResult),
            },
        });
    } catch (error) {
        console.error('Error generating branding test PDF:', error);
        return NextResponse.json({ error: 'Failed to generate test PDF' }, { status: 500 });
    }
}
