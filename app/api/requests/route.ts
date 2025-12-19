import { NextResponse } from 'next/server';
import { getRequests, createRequest, getDashboardStats, getOrCreateAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

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

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error('Error creating request:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}
