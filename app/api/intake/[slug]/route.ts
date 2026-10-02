import { NextResponse } from 'next/server';
import {
    getIntakeBrandProfile,
    getIntakeLinkBySlug,
    normalizeIntakeUtilityCategories,
} from '@/lib/neon/queries';

import { publicFormScope } from '@/lib/seller-forms/public';
import { formRequestFields } from '@/lib/seller-forms/config';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const intakeLink = await getIntakeLinkBySlug(slug);
        if (!intakeLink || !intakeLink.is_active) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const scope = await publicFormScope(intakeLink);
        if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { account, organization: activeOrg } = scope;
        const brandProfile = await getIntakeBrandProfile(
            account.id,
            activeOrg?.id,
            intakeLink.default_brand_profile_id
        );
        const publicBrandProfile = brandProfile
            ? {
                name: brandProfile.name,
                logo_url: brandProfile.logo_url,
                primary_color: brandProfile.primary_color,
                contact_email: brandProfile.contact_email,
                contact_phone: brandProfile.contact_phone,
                contact_website: brandProfile.contact_website,
            }
            : null;

        return NextResponse.json({
            accepting: true,
            sellerIntro: intakeLink.seller_intro || null,
            configuration: formRequestFields(intakeLink, scope.isPaid),
            brandProfile: publicBrandProfile,
            utility_categories: normalizeIntakeUtilityCategories(intakeLink.default_utility_categories),
        });
    } catch (error) {
        console.error('Error fetching intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
