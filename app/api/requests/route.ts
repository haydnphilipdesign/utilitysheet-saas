import { NextResponse } from 'next/server';
import { getRequests, createRequest, getDashboardStats, getOrCreateAccount, getMonthlyUsage, getBrandProfile, getDefaultBrandProfile, updateRequestStatus, createEventLog, getRequestCountForAccount, getOrganizationById } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { sendSellerNotificationEmail } from '@/lib/email/email-service';
import { requestCreationRatelimit, checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { createRequestBodySchema } from '@/lib/validation/schemas';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { normalizeAdvancedModules } from '@/lib/packet/modules';

function sanitizeLockedRequest<T extends Record<string, unknown>>(r: T) {
    return {
        ...r,
        is_locked: true,
        property_address: 'Locked — upgrade to view',
        property_address_structured: null,
        seller_name: null,
        seller_email: null,
        seller_phone: null,
        public_token: '',
        seller_token: null,
        utility_entries: undefined,
    };
}

// GET /api/requests - Get all requests for the current user
export async function GET(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;
        const organization = organizationId ? await getOrganizationById(organizationId) : null;
        const isPaid = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        const url = new URL(request.url);
        const stats = url.searchParams.get('stats');

        if (stats === 'true') {
            const dashboardStats = await getDashboardStats(accountId, organizationId);
            return NextResponse.json(dashboardStats);
        }

        // Parse pagination params
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);

        const result = await getRequests(accountId, organizationId, { page, limit });
        const data = result.data.map((requestRow) => {
            const r = requestRow as unknown as Record<string, unknown> & { is_locked?: unknown };
            const accessLocked = Boolean(r.is_locked) && !isPaid;
            if (!accessLocked) return { ...r, is_locked: false };
            return sanitizeLockedRequest(r);
        });

        return NextResponse.json({
            ...result,
            data,
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

// POST /api/requests - Create a new request
export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit by user ID to prevent automated request creation
        const rateLimitResult = await checkRateLimit(requestCreationRatelimit, user.id);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests created. Please slow down.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        const body = await request.json();
        const parsedBody = createRequestBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsedBody.error.flatten() },
                { status: 400 }
            );
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;
        const organization = organizationId ? await getOrganizationById(organizationId) : null;
        const isPaid = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        const selectedUtilityCategories = parsedBody.data.utilityCategories
            ? UTILITY_CATEGORY_KEYS.filter((c) => parsedBody.data.utilityCategories!.includes(c))
            : UTILITY_CATEGORY_KEYS;
        const packetMode = parsedBody.data.packetMode || 'simple';
        const advancedModules = packetMode === 'advanced'
            ? normalizeAdvancedModules(parsedBody.data.advancedModules)
            : [];

        if (packetMode === 'advanced' && !isPaid) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'Advanced Utility Packets are available on Pro and Teams.',
                },
                { status: 403 }
            );
        }

        const isDemoRequest = parsedBody.data.isDemo === true;

        if (isDemoRequest) {
            const existingRequestCount = await getRequestCountForAccount(accountId);
            if (existingRequestCount > 0) {
                return NextResponse.json(
                    {
                        error: 'Demo request unavailable',
                        message: 'Demo requests are only available for your first request.',
                    },
                    { status: 403 }
                );
            }
        }

        // Check plan limits before creating request
        if (!isDemoRequest) {
            const usage = await getMonthlyUsage(accountId, organizationId);
            if (usage.used >= usage.limit) {
                return NextResponse.json(
                    {
                        error: 'Monthly limit reached',
                        message: `You have reached your ${usage.plan} plan limit of ${usage.limit} requests per month. Please upgrade to continue.`,
                        usage,
                    },
                    { status: 403 }
                );
            }
        }

        // Automatically associate with default brand profile if not specified
        let brandProfileId = parsedBody.data.brandProfileId;
        if (!brandProfileId) {
            const defaultBrand = await getDefaultBrandProfile(accountId, organizationId);
            if (defaultBrand) {
                brandProfileId = defaultBrand.id;
            }
        }


        const structuredPropertyAddress = await buildStructuredPropertyAddress(parsedBody.data.propertyAddress);

        const newRequest = await createRequest({
            accountId,
            organizationId,
            brandProfileId: brandProfileId,
            propertyAddress: parsedBody.data.propertyAddress,
            propertyAddressStructured: structuredPropertyAddress,
            sellerName: parsedBody.data.sellerName,
            sellerEmail: parsedBody.data.sellerEmail,
            sellerPhone: parsedBody.data.sellerPhone,
            closingDate: parsedBody.data.closingDate,
            utilityCategories: selectedUtilityCategories,
            isDemo: isDemoRequest,
            packetMode,
            advancedModules,
        });

        if (!newRequest) {
            return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
        }

        // Mark request as 'sent' so it counts against plan limits
        // Draft requests that are abandoned won't count
        await updateRequestStatus(newRequest.id, 'sent');

        // Log request creation event
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null;
        const userAgent = request.headers.get('user-agent') || null;
        await createEventLog({
            requestId: newRequest.id,
            eventType: 'request_created',
            eventData: {
                actor: 'agent',
                utility_categories: selectedUtilityCategories,
                has_seller_email: !!parsedBody.data.sellerEmail,
                send_seller_email: parsedBody.data.sendSellerEmail !== false,
                is_demo: isDemoRequest,
                packet_mode: packetMode,
                advanced_modules: advancedModules,
            },
            ipAddress,
            userAgent,
        });

        // Send email notification to seller if email is provided and sendSellerEmail is true
        if (parsedBody.data.sellerEmail && parsedBody.data.sendSellerEmail !== false) {
            // Get agent name from brand profile or account
            let agentName: string | undefined;
            let brandProfile = null;
            if (brandProfileId) {
                brandProfile = await getBrandProfile(brandProfileId);
                agentName = brandProfile?.contact_name || undefined;
            }
            // Fallback to account name if no brand profile contact name
            if (!agentName) {
                agentName = account.full_name || user.displayName || undefined;
            }

            // Send email notification - await with error handling (non-blocking to request success)
            try {
                await sendSellerNotificationEmail({
                    sellerEmail: parsedBody.data.sellerEmail,
                    sellerName: parsedBody.data.sellerName,
                    propertyAddress: parsedBody.data.propertyAddress,
                    closingDate: parsedBody.data.closingDate,
                    agentName,
                    brandProfile: brandProfile || undefined,
                    sellerToken: newRequest.seller_token || newRequest.public_token,
                });
            } catch (emailError) {
                // Log but don't fail the request - email is non-critical
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Failed to send seller notification email:', emailError);
                }
            }
        }

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error('Error creating request:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}
