import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { createEventLog } from '@/lib/neon/queries/event-logs';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';
import { lazyBackfillRequestStructuredAddress } from '@/lib/address/structured-address';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

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

        const ip = getClientIp(request);
        const rateLimitResult = await checkRateLimit(aiRatelimit, `${token}:${ip}`, { requirePersistent: process.env.NODE_ENV === 'production' });
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

        await lazyBackfillRequestStructuredAddress(requestData as {
            id: string;
            property_address: string;
            property_address_structured?: unknown | null;
        });

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
        const requestUtilityCategoriesRaw = (requestData as { utility_categories?: unknown }).utility_categories;
        const requestUtilityCategories = Array.isArray(requestUtilityCategoriesRaw)
            ? requestUtilityCategoriesRaw.filter((entry): entry is string => typeof entry === 'string')
            : UTILITY_CATEGORY_KEYS;
        const requestedCategories = new Set<string>(requestUtilityCategories);

        const uniqueCategories = Array.from(new Set(rawCategories));
        const categories = uniqueCategories
            .filter((c) => allowedCategories.has(c) && requestedCategories.has(c))
            .slice(0, UTILITY_CATEGORY_KEYS.length) as UtilityCategory[];

        if (categories.length === 0) {
            return NextResponse.json({ suggestions: {} }, { headers: getRateLimitHeaders(rateLimitResult) });
        }

        const context = {
            requestId: requestData.id,
            accountId: requestData.account_id,
            organizationId: requestData.organization_id ?? null,
        };
        const suggestions = await getAllSuggestions(requestData.property_address, categories, context);

        void createEventLog({
            requestId: requestData.id,
            eventType: 'suggestions_fetched',
            eventData: {
                category_count: categories.length,
                categories,
                top_results_by_category: Object.fromEntries(
                    Object.entries(suggestions).map(([key, value]) => [
                        key,
                        value.slice(0, 3).map((item) => item.display_name),
                    ])
                ),
            },
        }).catch(() => undefined);

        return NextResponse.json(
            { suggestions },
            { headers: getRateLimitHeaders(rateLimitResult) }
        );
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
    }
}

