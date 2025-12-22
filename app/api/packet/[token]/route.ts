import { NextResponse } from 'next/server';
import { getRequestByToken, getBrandProfile, getUtilityEntriesByRequestId, getDefaultBrandProfile } from '@/lib/neon/queries';

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

        // Fallback to default brand if none assigned to request
        if (!brandProfile) {
            brandProfile = await getDefaultBrandProfile(requestData.account_id, requestData.organization_id ?? undefined);
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
