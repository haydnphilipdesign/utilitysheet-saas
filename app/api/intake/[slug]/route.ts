import { NextResponse } from 'next/server';
import { getIntakeLinkBySlug, getAccountById, getAccountOrganizations, getDefaultBrandProfile } from '@/lib/neon/queries';
import { UTILITY_CATEGORY_KEYS } from '@/lib/constants';

type OrganizationSummary = { id: string; subscription_status?: string | null };

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

        const account = await getAccountById(intakeLink.account_id);
        if (!account || account.role === 'banned') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = (organizations as OrganizationSummary[]).find((o) => o.id === account.active_organization_id) || null;

        const brandProfile = await getDefaultBrandProfile(account.id, activeOrg?.id);
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
            brandProfile: publicBrandProfile,
            utility_categories: UTILITY_CATEGORY_KEYS,
        });
    } catch (error) {
        console.error('Error fetching intake link:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
