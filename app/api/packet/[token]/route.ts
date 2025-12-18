import { NextResponse } from 'next/server';
import { getRequestByToken, getBrandProfile, getUtilityEntriesByRequestId } from '@/lib/neon/queries';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // 1. Get the request by public token
        const requestData = await getRequestByToken(token);
        if (!requestData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // 2. Get the brand profile
        let brandProfile = null;
        if (requestData.brand_profile_id) {
            brandProfile = await getBrandProfile(requestData.brand_profile_id);
        }

        // 3. Get utility entries
        const utilities = await getUtilityEntriesByRequestId(requestData.id);

        return NextResponse.json({
            request: requestData,
            brand: brandProfile,
            utilities: utilities
        });
    } catch (error) {
        console.error('Error fetching packet data:', error);
        return NextResponse.json({ error: 'Failed to fetch packet data' }, { status: 500 });
    }
}
