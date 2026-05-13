import { NextResponse } from 'next/server';
import { getOrganizationById, getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { createEventLog } from '@/lib/neon/queries/event-logs';
import { getAllSuggestions } from '@/lib/providers/suggestion-service';
import type { ProviderSuggestion, UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';
import { lazyBackfillRequestStructuredAddress } from '@/lib/address/structured-address';

const DEMO_WORKSPACE_SLUG = 'utilitysheet-demo';
const DEMO_ADDRESS_PATTERN = /\b123\s+main\s+(?:street|st)\b.*\banytown\b.*\bpa\b.*\b18301\b/i;

const DEMO_PROVIDER_SUGGESTIONS: Partial<Record<UtilityCategory, ProviderSuggestion[]>> = {
    electric: [
        {
            display_name: 'Keystone Electric Co.',
            confidence: 0.99,
            rationale_short: 'Demo electric provider for the sample Anytown property.',
            contact_phone: '555-0101',
            contact_website: 'https://example.test/keystone-electric/start',
        },
    ],
    gas: [
        {
            display_name: 'Valley Natural Gas',
            confidence: 0.99,
            rationale_short: 'Demo gas provider for the sample Anytown property.',
            contact_phone: '555-0102',
            contact_website: 'https://example.test/valley-natural-gas/start',
        },
    ],
    water: [
        {
            display_name: 'Anytown Water Authority',
            confidence: 0.99,
            rationale_short: 'Demo water provider for the sample Anytown property.',
            contact_phone: '555-0103',
            contact_website: 'https://example.test/anytown-water/start',
        },
    ],
    sewer: [
        {
            display_name: 'Anytown Sewer Authority',
            confidence: 0.99,
            rationale_short: 'Demo sewer provider for the sample Anytown property.',
            contact_phone: '555-0104',
            contact_website: 'https://example.test/anytown-sewer/start',
        },
    ],
    trash: [
        {
            display_name: 'GreenCart Waste Services',
            confidence: 0.99,
            rationale_short: 'Demo waste provider for the sample Anytown property.',
            contact_phone: '555-0105',
            contact_website: 'https://example.test/greencart/start',
        },
    ],
    internet: [
        {
            display_name: 'Blue Ridge Fiber',
            confidence: 0.99,
            rationale_short: 'Demo internet provider for the sample Anytown property.',
            contact_phone: '555-0106',
            contact_website: 'https://example.test/blue-ridge-fiber/start',
        },
    ],
    cable: [
        {
            display_name: 'Blue Ridge Fiber',
            confidence: 0.99,
            rationale_short: 'Demo cable provider for the sample Anytown property.',
            contact_phone: '555-0106',
            contact_website: 'https://example.test/blue-ridge-fiber/start',
        },
    ],
};

async function getDemoSuggestionsIfApplicable(
    organizationId: string | null | undefined,
    propertyAddress: string,
    categories: UtilityCategory[]
) {
    if (!organizationId || !DEMO_ADDRESS_PATTERN.test(propertyAddress)) {
        return null;
    }

    const organization = await getOrganizationById(organizationId);
    if (organization?.slug !== DEMO_WORKSPACE_SLUG) {
        return null;
    }

    return Object.fromEntries(
        categories.map((category) => [category, DEMO_PROVIDER_SUGGESTIONS[category] ?? []])
    ) as Record<UtilityCategory, ProviderSuggestion[]>;
}

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
        const suggestions =
            (await getDemoSuggestionsIfApplicable(
                requestData.organization_id,
                requestData.property_address,
                categories
            )) ?? (await getAllSuggestions(requestData.property_address, categories, context));

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

