import { NextResponse } from 'next/server';
import { createBrandProfile, getBrandProfileRequestCounts, getBrandProfiles, getIntakeLinkByAccountId, getOrganizationById } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { brandProfileCreateBodySchema } from '@/lib/validation/schemas';
import { normalizeMessageTemplates } from '@/lib/message-templates';
import { invalidRequestBodyResponse } from '@/lib/security/api-response';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';

// GET /api/branding - Get all brand profiles
export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { account, activeOrganization } = activationState;
        const accountId = account.id;
        const organizationId = activeOrganization?.id || account.active_organization_id;
        const organization = activeOrganization || (organizationId ? await getOrganizationById(organizationId) : null);

        let profiles = await getBrandProfiles(accountId, organizationId || undefined);

        // Fallback for older accounts that still have account-scoped branding and no active organization.
        if (profiles.length === 0 && !organizationId) {
            profiles = await getBrandProfiles(accountId);
        }

        // Auto-create a default brand profile if none exist.
        if (profiles.length === 0) {
            const defaultProfile = await createBrandProfile({
                accountId,
                organizationId: organizationId || undefined,
                name: organization?.name || account.company_name || account.full_name || 'My Workspace',
                primaryColor: '#10b981',
                secondaryColor: '#059669',
                contactName: account.full_name || undefined,
                contactEmail: account.email || undefined,
                contactPhone: account.phone || undefined,
                isDefault: true,
            });

            if (defaultProfile) {
                profiles = [defaultProfile];
            }
        }

        // Additive usage context; the response stays an array of profiles.
        const [requestCounts, intakeLink] = await Promise.all([
            getBrandProfileRequestCounts(profiles.map((profile) => profile.id)),
            getIntakeLinkByAccountId(accountId),
        ]);

        const profilesWithUsage = profiles.map((profile) => ({
            ...profile,
            request_count: requestCounts[profile.id] ?? 0,
            is_intake_default: intakeLink?.default_brand_profile_id === profile.id,
        }));

        return NextResponse.json(profilesWithUsage);
    } catch (error) {
        console.error('Error fetching brand profiles:', error);
        return NextResponse.json({ error: 'Failed to fetch brand profiles' }, { status: 500 });
    }
}

// POST /api/branding - Create a new brand profile
export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const parsedBody = brandProfileCreateBodySchema.safeParse(body);
        if (!parsedBody.success) {
            return invalidRequestBodyResponse();
        }
        const payload = parsedBody.data;

        const activationState = await ensureAccountActivation(user);
        if (!activationState) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const { account, activeOrganization } = activationState;
        const accountId = account.id;
        const organizationId = activeOrganization?.id || account.active_organization_id;
        const organization = activeOrganization || (organizationId ? await getOrganizationById(organizationId) : null);
        const hasPaidAccess = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        if (!hasPaidAccess) {
            return NextResponse.json({
                error: 'Custom branding is available on the Pro plan',
                code: 'UPGRADE_REQUIRED',
            }, { status: 403 });
        }

        const profile = await createBrandProfile({
            accountId,
            organizationId: organizationId || undefined,
            name: payload.name,
            logoUrl: payload.logo_url,
            primaryColor: payload.primary_color,
            secondaryColor: payload.secondary_color,
            contactName: payload.contact_name,
            contactPhone: payload.contact_phone,
            contactEmail: payload.contact_email,
            contactWebsite: payload.contact_website,
            disclaimerText: payload.disclaimer_text,
            companyName: payload.company_name,
            professionalTitle: payload.professional_title,
            licenseNumber: payload.license_number,
            licenseState: payload.license_state,
            complianceLine: payload.compliance_line,
            messageTemplates: normalizeMessageTemplates(payload.message_templates),
            isDefault: payload.is_default,
            buyerNextSteps: payload.buyer_next_steps,
            nextStepsTitle: payload.next_steps_title,
            showPoweredBy: payload.show_powered_by,
            showGenerationDate: payload.show_generation_date,
            welcomeMessage: payload.welcome_message,
        });

        if (!profile) {
            return NextResponse.json({ error: 'Failed to create brand profile' }, { status: 500 });
        }

        return NextResponse.json(profile, { status: 201 });
    } catch (error) {
        console.error('Error creating brand profile:', error);
        return NextResponse.json({ error: 'Failed to create brand profile' }, { status: 500 });
    }
}
