import { NextResponse } from 'next/server';
import { getBrandProfiles, createBrandProfile } from '@/lib/neon/queries';

// GET /api/branding - Get all brand profiles
export async function GET() {
    try {
        // TODO: Get real account ID from auth session
        const accountId = 'demo-account';

        const profiles = await getBrandProfiles(accountId);
        return NextResponse.json(profiles);
    } catch (error) {
        console.error('Error fetching brand profiles:', error);
        return NextResponse.json({ error: 'Failed to fetch brand profiles' }, { status: 500 });
    }
}

// POST /api/branding - Create a new brand profile
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // TODO: Get real account ID from auth session
        const accountId = 'demo-account';

        const profile = await createBrandProfile({
            accountId,
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
