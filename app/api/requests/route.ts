import { NextResponse } from 'next/server';
import { getRequests, createRequest, getDashboardStats, getOrCreateAccount, getMonthlyUsage, getBrandProfile } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { sendSellerNotificationEmail } from '@/lib/email/email-service';

// GET /api/requests - Get all requests for the current user
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

        const url = new URL(request.url);
        const stats = url.searchParams.get('stats');

        if (stats === 'true') {
            const dashboardStats = await getDashboardStats(accountId, organizationId);
            return NextResponse.json(dashboardStats);
        }

        const requests = await getRequests(accountId, organizationId);
        return NextResponse.json(requests);
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

        const body = await request.json();

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;

        // Check plan limits before creating request
        const usage = await getMonthlyUsage(accountId, organizationId);
        if (usage.used >= usage.limit) {
            return NextResponse.json(
                {
                    error: 'Monthly limit reached',
                    message: `You have reached your ${usage.plan} plan limit of ${usage.limit} requests per month. Please upgrade to continue.`,
                    usage
                },
                { status: 403 }
            );
        }

        const newRequest = await createRequest({
            accountId,
            organizationId,
            brandProfileId: body.brandProfileId,
            propertyAddress: body.propertyAddress,
            sellerName: body.sellerName,
            sellerEmail: body.sellerEmail,
            sellerPhone: body.sellerPhone,
            closingDate: body.closingDate,
            utilityCategories: body.utilityCategories || ['electric', 'gas', 'water', 'sewer', 'trash'],
        });

        if (!newRequest) {
            return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
        }

        // Send email notification to seller if email is provided
        if (body.sellerEmail) {
            // Get agent name from brand profile or account
            let agentName: string | undefined;
            if (body.brandProfileId) {
                const brandProfile = await getBrandProfile(body.brandProfileId);
                agentName = brandProfile?.contact_name || undefined;
            }
            // Fallback to account name if no brand profile contact name
            if (!agentName) {
                agentName = account.full_name || user.displayName || undefined;
            }

            // Send email asynchronously - don't block the response
            sendSellerNotificationEmail({
                sellerEmail: body.sellerEmail,
                sellerName: body.sellerName,
                propertyAddress: body.propertyAddress,
                closingDate: body.closingDate,
                agentName,
                publicToken: newRequest.public_token,
            }).catch((error) => {
                // Log but don't fail the request
                console.error('Failed to send seller notification email:', error);
            });
        }

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error('Error creating request:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

