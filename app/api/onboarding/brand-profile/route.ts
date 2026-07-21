import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { createBrandProfile } from '@/lib/neon/queries';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const primaryColor = typeof body?.primaryColor === 'string' ? body.primaryColor.trim() : undefined;
        const secondaryColor = typeof body?.secondaryColor === 'string' ? body.secondaryColor.trim() : undefined;

        if (name.length < 2 || name.length > 100) {
            return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
        }

        const activationState = await ensureAccountActivation(user);
        if (!activationState?.account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }
        const { account, activeOrganization } = activationState;

        // Allow all users to create a brand profile during onboarding
        // Pro features like logo upload and advanced customization are gated elsewhere

        const profile = await createBrandProfile({
            accountId: account.id,
            organizationId: activeOrganization?.id || undefined,
            name,
            primaryColor,
            secondaryColor,
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
