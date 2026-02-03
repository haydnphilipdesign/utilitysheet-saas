import { NextResponse } from 'next/server';
import { getRequestByToken, getBrandProfile, getUtilityEntriesByRequestId, getDefaultBrandProfile, getAccountById, getOrganizationById } from '@/lib/neon/queries';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const normalizeSteps = (value: unknown): string[] | null => {
            if (value === null || value === undefined) return null;
            if (Array.isArray(value)) {
                return value
                    .filter((step) => typeof step === 'string')
                    .map((step) => step.trim())
                    .filter(Boolean);
            }
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        return parsed
                            .filter((step) => typeof step === 'string')
                            .map((step) => step.trim())
                            .filter(Boolean);
                    }
                } catch {
                    // ignore
                }
            }
            return null;
        };

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

        const account = await getAccountById(requestData.account_id);
        const organization = requestData.organization_id ? await getOrganizationById(requestData.organization_id) : null;
        const isPro = account?.subscription_status === 'pro' || organization?.subscription_status === 'team';

        // If this request was created as a free-plan overage, keep the info sheet locked until upgrade.
        const isLocked = Boolean((requestData as unknown as { is_locked?: unknown }).is_locked);
        if (isLocked && !isPro) {
            return NextResponse.json(
                {
                    error: 'Upgrade required',
                    message: 'This utility info sheet is locked. Ask the agent to upgrade to view it.',
                },
                { status: 402 }
            );
        }

        const forceShowPoweredBy = !isPro;

        const buyerNextSteps = isPro ? normalizeSteps(brandProfile?.buyer_next_steps) : null;

        const publicBrandProfile = brandProfile ? {
            name: brandProfile.name,
            logo_url: brandProfile.logo_url,
            primary_color: brandProfile.primary_color,
            contact_name: brandProfile.contact_name,
            contact_email: brandProfile.contact_email,
            contact_phone: brandProfile.contact_phone,
            contact_website: brandProfile.contact_website,
            disclaimer_text: brandProfile.disclaimer_text ?? null,
            // Advanced customization (Pro only)
            buyer_next_steps: buyerNextSteps,
            next_steps_title: isPro ? (brandProfile.next_steps_title ?? null) : null,
            show_powered_by: forceShowPoweredBy ? true : brandProfile.show_powered_by,
            show_generation_date: isPro ? brandProfile.show_generation_date : true,
            welcome_message: isPro ? (brandProfile.welcome_message ?? null) : null,
        } : null;

        // 3. Get utility entries (map to public packet shape)
        const rawUtilities = await getUtilityEntriesByRequestId(requestData.id);
        const utilities = rawUtilities.map((u: any) => ({
            category: u.category,
            provider_name: u.provider_name || u.display_name || u.provider_display_name || u.raw_text || 'Not sure',
            provider_phone: u.provider_phone || u.contact_phone || null,
            provider_website: u.provider_website || u.contact_url || null,
        }));

        return NextResponse.json({
            request: {
                id: requestData.id,
                property_address: requestData.property_address,
                created_at: requestData.created_at,
                // Home Basics fields for well/septic cases
                water_source: (requestData as any).water_source || null,
                sewer_type: (requestData as any).sewer_type || null,
                heating_type: (requestData as any).heating_type || null,
            },
            brand: publicBrandProfile,
            utilities: utilities,
            meta: {
                show_powered_by: forceShowPoweredBy,
            },
        });
    } catch (error) {
        console.error('Error fetching info sheet data:', error);
        return NextResponse.json({ error: 'Failed to fetch info sheet data' }, { status: 500 });
    }
}
