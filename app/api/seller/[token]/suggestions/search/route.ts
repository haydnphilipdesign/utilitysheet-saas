import { auxiliaryEventWriter } from '@/lib/telemetry/auxiliary-events';
import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';
import { maintenanceResponse } from '@/lib/maintenance/server';
import { NextResponse } from 'next/server';
import { getRequestBySellerToken, getRequestByToken } from '@/lib/neon/queries';
import { createEventLog } from '@/lib/neon/queries/event-logs';
import { searchProvidersResult } from '@/lib/providers/suggestion-service';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { aiRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/network/client-ip';
import { lazyBackfillRequestStructuredAddress } from '@/lib/address/structured-address';

const recordAuxiliaryEvent = auxiliaryEventWriter(createEventLog);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    // Paused for maintenance: refuse before the limiter and every side effect.
    const maintenance = await maintenanceResponse('seller_suggestion_search', request);
    if (maintenance) return maintenance;

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
        const rateLimitResult = await checkRateLimit(aiRatelimit, capabilityRateLimitIdentifier('seller-ai', `${token}:${ip}`), { requirePersistent: process.env.NODE_ENV === 'production' });
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

        await lazyBackfillRequestStructuredAddress(requestData as {
            id: string;
            property_address: string;
            property_address_structured?: unknown | null;
        });

        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('query') || '').trim();
        const categoryRaw = searchParams.get('category');

        if (query.length < 2) {
            return NextResponse.json([], {
                headers: getRateLimitHeaders(rateLimitResult),
            });
        }

        if (!categoryRaw || !UTILITY_CATEGORY_KEYS.includes(categoryRaw as UtilityCategory)) {
            return NextResponse.json({ error: 'Invalid utility category' }, { status: 400 });
        }

        const category = categoryRaw as UtilityCategory;
        if (Array.isArray(requestData.utility_categories) && !requestData.utility_categories.includes(category)) {
            return NextResponse.json({ error: 'Invalid utility category' }, { status: 400 });
        }
        const context = {
            editVersion: Number(requestData.seller_edit_version ?? 0), mode: requestData.is_demo ? 'test' as const : 'live' as const,
            requestId: requestData.id,
            accountId: requestData.account_id,
            organizationId: requestData.organization_id ?? null,
        };
        const result = await searchProvidersResult(query, category, requestData.property_address, context);

        const { results } = result;
        await recordAuxiliaryEvent({
            requestId: requestData.id,
            eventType: 'suggestions_search',
            eventData: {
                category,
                query_length: query.length,
                result_count: results.length,
            },
        });

        return NextResponse.json(searchParams.get('lineage') === '2' ? result : results, {
            headers: { ...getRateLimitHeaders(rateLimitResult), 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        logDiagnostic('error', 'seller_search_failed', {}, error);
        return NextResponse.json({ error: 'Failed to search providers' }, { status: 500 });
    }
}

