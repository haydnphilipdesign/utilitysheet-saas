import { NextResponse } from 'next/server';
import { getBrandProfiles, createBrandProfile, getOrCreateAccount, getOrganizationById } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';
import { brandProfileCreateBodySchema } from '@/lib/validation/schemas';
import { normalizeMessageTemplates } from '@/lib/message-templates';

// GET /api/branding - Get all brand profiles
export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;
        const organization = organizationId ? await getOrganizationById(organizationId) : null;

        let profiles = await getBrandProfiles(accountId, organizationId);

        // Auto-create a default brand profile if none exist (uses UtilitySheet branding)
        if (profiles.length === 0) {
            const defaultProfile = await createBrandProfile({
                accountId,
                organizationId,
                name: organization?.name || account.company_name || account.full_name || 'UtilitySheet',
                primaryColor: '#475569', // Slate-600
                secondaryColor: '#0ea5e9', // Sky-500
                contactName: account.full_name || undefined,
                contactEmail: account.email || undefined,
                contactPhone: account.phone || undefined,
                isDefault: true,
            });

            if (defaultProfile) {
                profiles = [defaultProfile];
            }
        }

        return NextResponse.json(profiles);
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
            return NextResponse.json(
                { error: 'Invalid request body', details: parsedBody.error.flatten() },
                { status: 400 }
            );
        }
        const payload = parsedBody.data;

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;
        const organization = organizationId ? await getOrganizationById(organizationId) : null;
        const hasPaidAccess = account.subscription_status === 'pro' || organization?.subscription_status === 'team';

        if (!hasPaidAccess) {
            return NextResponse.json({
                error: 'Custom branding is available on the Pro plan',
                code: 'UPGRADE_REQUIRED'
            }, { status: 403 });
        }

        const profile = await createBrandProfile({
            accountId,
            organizationId,
            name: payload.name,
            logoUrl: payload.logo_url,
            primaryColor: payload.primary_color,
            secondaryColor: payload.secondary_color,
            contactName: payload.contact_name,
            contactPhone: payload.contact_phone,
            contactEmail: payload.contact_email,
            contactWebsite: payload.contact_website,
            disclaimerText: payload.disclaimer_text,
            messageTemplates: normalizeMessageTemplates(payload.message_templates),
            isDefault: payload.is_default,
            // Advanced customization
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
