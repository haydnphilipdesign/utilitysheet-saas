import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

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

        const { searchParams } = new URL(request.url);
        const categoriesParam = searchParams.get('categories');
        const categoryParam = searchParams.get('category');
        const rawCategories = (categoriesParam || categoryParam || '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);

        if (rawCategories.length === 0) {
            return NextResponse.json({ error: 'Category is required' }, { status: 400 });
        }

        const allowedCategories = new Set<string>(UTILITY_CATEGORY_KEYS);
        const requestedCategories = new Set<string>(
            (requestData as any).utility_categories || UTILITY_CATEGORY_KEYS
        );

        const uniqueCategories = Array.from(new Set(rawCategories));
        const categories = uniqueCategories
            .filter((c) => allowedCategories.has(c) && requestedCategories.has(c))
            .slice(0, UTILITY_CATEGORY_KEYS.length) as UtilityCategory[];

        if (categories.length === 0) {
            return NextResponse.json({ suggestions: {} }, { headers: getRateLimitHeaders(rateLimitResult) });
        }

        const suggestions = await getAllSuggestions(requestData.property_address, categories);
        return NextResponse.json(
            { suggestions },
            { headers: getRateLimitHeaders(rateLimitResult) }
        );
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
    }
}

