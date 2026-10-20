import { NextResponse } from 'next/server';

import { getSenderBrandName } from '@/lib/growth/sender-brand';
import { checkRateLimit, getRateLimitHeaders, growthSenderBrandRatelimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Brand name for the /from-a-closing hero. Unknown, inactive and malformed
 * codes all answer `{ brandName: null }` so the page falls back to generic copy.
 */
export async function GET(request: Request) {
    const rateLimitResult = await checkRateLimit(
        growthSenderBrandRatelimit,
        getClientIp(request)
    );
    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { ...NO_STORE, ...getRateLimitHeaders(rateLimitResult) } }
        );
    }

    const referralCode = new URL(request.url).searchParams.get('ref');
    const brandName = await getSenderBrandName(referralCode);
    return NextResponse.json({ brandName }, { headers: NO_STORE });
}
