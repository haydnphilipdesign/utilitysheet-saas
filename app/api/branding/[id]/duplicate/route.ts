import { NextResponse } from 'next/server';
import { createBrandProfile, getBrandProfile, getOrCreateAccount, getOrganizationById } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';

const COPY_SUFFIX = ' (Copy)';

function buildCopyName(name: string): string {
    const maxBaseLength = BRAND_PROFILE_LIMITS.brandNameMax - COPY_SUFFIX.length;
    return `${name.slice(0, maxBaseLength).trimEnd()}${COPY_SUFFIX}`;
}

// POST /api/branding/[id]/duplicate - Copy a brand profile's content into a new profile.
// The copy gets a new identity in the same scope and is never the default.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const profile = await getBrandProfile(id);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (profile.organization_id) {
            if (profile.organization_id !== account.active_organization_id) {
                return NextResponse.json({ error: 'Unauthorized access to organization profile' }, { status: 403 });
            }
        } else {
            if (profile.account_id !== account.id) {
                return NextResponse.json({ error: 'Unauthorized access to account profile' }, { status: 403 });
            }
        }

        let hasPaidAccess = account.subscription_status === 'pro';
        if (!hasPaidAccess && account.active_organization_id) {
            const org = await getOrganizationById(account.active_organization_id);
            hasPaidAccess = org?.subscription_status === 'team';
        }

        if (!hasPaidAccess) {
            return NextResponse.json({
                error: 'Custom branding is available on the Pro plan',
                code: 'UPGRADE_REQUIRED',
            }, { status: 403 });
        }

        const copy = await createBrandProfile({
            accountId: account.id,
            organizationId: profile.organization_id || undefined,
            name: buildCopyName(profile.name),
            logoUrl: profile.logo_url,
            primaryColor: profile.primary_color,
            secondaryColor: profile.secondary_color,
            contactName: profile.contact_name,
            contactPhone: profile.contact_phone,
            contactEmail: profile.contact_email,
            contactWebsite: profile.contact_website,
            disclaimerText: profile.disclaimer_text,
            companyName: profile.company_name,
            professionalTitle: profile.professional_title,
            licenseNumber: profile.license_number,
            licenseState: profile.license_state,
            complianceLine: profile.compliance_line,
            messageTemplates: profile.message_templates || {},
            isDefault: false,
            buyerNextSteps: profile.buyer_next_steps,
            nextStepsTitle: profile.next_steps_title,
            showPoweredBy: profile.show_powered_by,
            showGenerationDate: profile.show_generation_date,
            welcomeMessage: profile.welcome_message,
        });

        if (!copy) {
            return NextResponse.json({ error: 'Failed to duplicate brand profile' }, { status: 500 });
        }

        return NextResponse.json(copy, { status: 201 });
    } catch (error) {
        console.error('Error duplicating brand profile:', error);
        return NextResponse.json({ error: 'Failed to duplicate brand profile' }, { status: 500 });
    }
}
