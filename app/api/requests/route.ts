import { NextResponse } from 'next/server';
import { getRequests, createRequest, getDashboardStats, getOrCreateAccount } from '@/lib/neon/queries';

// GET /api/requests - Get all requests for the current user
export async function GET(request: Request) {
    try {
        // TODO: Get real account ID from auth session
        // For now, use a demo account
        const account = await getOrCreateAccount('demo-user', 'demo@utilitysheet.com', 'Demo User');
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;

        const url = new URL(request.url);
        const stats = url.searchParams.get('stats');

        if (stats === 'true') {
            const dashboardStats = await getDashboardStats(accountId);
            return NextResponse.json(dashboardStats);
        }

        const requests = await getRequests(accountId);
        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

// POST /api/requests - Create a new request
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // TODO: Get real account ID from auth session
        const account = await getOrCreateAccount('demo-user', 'demo@utilitysheet.com', 'Demo User');
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;

        const newRequest = await createRequest({
            accountId,
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
