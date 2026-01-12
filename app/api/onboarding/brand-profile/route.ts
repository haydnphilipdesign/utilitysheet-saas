import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { createBrandProfile, getOrCreateAccount } from '@/lib/neon/queries';

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const primaryColor = typeof body?.primaryColor === 'string' ? body.primaryColor.trim() : undefined;

        if (name.length < 2 || name.length > 100) {
            return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        // Allow all users to create a brand profile during onboarding
        // Pro features like logo upload and advanced customization are gated elsewhere

        const profile = await createBrandProfile({
            accountId: account.id,
            organizationId: account.active_organization_id || undefined,
            name,
            primaryColor,
            isDefault: true,
            contactName: account.full_name || user.displayName || undefined,
            contactEmail: account.email || user.primaryEmail || undefined,
            contactPhone: account.phone || undefined,
        });

        if (!profile) {
            return NextResponse.json({ error: 'Failed to create brand profile' }, { status: 500 });
        }

        return NextResponse.json({ profile }, { status: 201 });
    } catch (error) {
        console.error('Error creating brand profile:', error);
        return NextResponse.json({ error: 'Failed to create brand profile' }, { status: 500 });
    }
}

