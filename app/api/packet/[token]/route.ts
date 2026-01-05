import { NextResponse } from 'next/server';
import { getRequestByToken, getBrandProfile, getUtilityEntriesByRequestId, getDefaultBrandProfile, getAccountById } from '@/lib/neon/queries';

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

        // Only allow packet access once the seller has submitted
        if (requestData.status !== 'submitted') {
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

        const publicBrandProfile = brandProfile ? {
            name: brandProfile.name,
            logo_url: brandProfile.logo_url,
            primary_color: brandProfile.primary_color,
            contact_email: brandProfile.contact_email,
            contact_phone: brandProfile.contact_phone,
            contact_website: brandProfile.contact_website,
        } : null;

        // 3. Get utility entries (map to public packet shape)
        const rawUtilities = await getUtilityEntriesByRequestId(requestData.id);
        const utilities = rawUtilities.map((u: any) => ({
            category: u.category,
            provider_name: u.provider_name || u.display_name || u.provider_display_name || u.raw_text || 'Not sure',
            provider_phone: u.provider_phone || u.contact_phone || null,
            provider_website: u.provider_website || u.contact_url || null,
        }));

        const account = await getAccountById(requestData.account_id);
        const showPoweredBy = account?.subscription_status !== 'pro';

        return NextResponse.json({
            request: {
                id: requestData.id,
                property_address: requestData.property_address,
                created_at: requestData.created_at,
            },
            brand: publicBrandProfile,
            utilities: utilities,
            meta: {
                show_powered_by: showPoweredBy,
            },
        });
    } catch (error) {
        console.error('Error fetching info sheet data:', error);
        return NextResponse.json({ error: 'Failed to fetch info sheet data' }, { status: 500 });
    }
}
