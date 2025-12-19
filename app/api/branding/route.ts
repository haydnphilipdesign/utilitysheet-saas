import { NextResponse } from 'next/server';
import { getBrandProfiles, createBrandProfile, getOrCreateAccount } from '@/lib/neon/queries';
import { stackServerApp } from '@/lib/stack/server';

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

        const profiles = await getBrandProfiles(accountId, organizationId);
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

        const account = await getOrCreateAccount(user.id, user.primaryEmail!, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const accountId = account.id;
        const organizationId = account.active_organization_id;

        if (account.subscription_status !== 'pro') {
            return NextResponse.json({
                error: 'Custom branding is available on the Pro plan',
                code: 'UPGRADE_REQUIRED'
            }, { status: 403 });
        }

        const profile = await createBrandProfile({
            accountId,
            organizationId,
            name: body.name,
            primaryColor: body.primary_color,
            secondaryColor: body.secondary_color,
            contactName: body.contact_name,
            contactPhone: body.contact_phone,
            contactEmail: body.contact_email,
            contactWebsite: body.contact_website,
            disclaimerText: body.disclaimer_text,
            isDefault: body.is_default,
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
