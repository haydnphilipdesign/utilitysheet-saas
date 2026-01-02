import { NextResponse } from 'next/server';
import { searchProviders } from '@/lib/providers/suggestion-service';
import { UtilityCategory } from '@/types';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: Request) {
    // Rate limit by IP address
    const ip = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'anonymous';

    const rateLimitResult = await checkRateLimit(aiRatelimit, ip);

    if (!rateLimitResult.success) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please slow down.' },
            {
                status: 429,
                headers: getRateLimitHeaders(rateLimitResult),
            }
        );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = searchParams.get('category') as UtilityCategory | null;
    const address = searchParams.get('address');

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const results = await searchProviders(query, category || undefined, address || undefined);
        return NextResponse.json(results, {
            headers: getRateLimitHeaders(rateLimitResult),
        });
    } catch (error) {
        console.error('Error searching providers:', error);
        return NextResponse.json({ error: 'Failed to search providers' }, { status: 500 });
    }
}
