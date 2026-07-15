import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordGrowthReferralEvent } from '@/lib/neon/queries';
import { checkRateLimit, getRateLimitHeaders, growthReferralEventRatelimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';

const referralEventSchema = z.object({
    eventType: z.enum(['impression', 'click']),
    surface: z.enum(['packet_share_page']),
    referralCode: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).nullable(),
});

export async function POST(request: Request) {
    const rateLimitResult = await checkRateLimit(
        growthReferralEventRatelimit,
        getClientIp(request)
    );
    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
        );
    }

    const parsed = referralEventSchema.safeParse(
        await request.json().catch(() => null)
    );
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
    }

    try {
        await recordGrowthReferralEvent(parsed.data);
    } catch (error) {
        // A lost counter increment should never surface to the packet viewer.
        console.error('Failed to record growth referral event:', error);
    }

    return new NextResponse(null, { status: 204 });
}
