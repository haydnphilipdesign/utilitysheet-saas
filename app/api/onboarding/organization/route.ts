import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { createOrganization, getAccountOrganizations, getOrCreateAccount, updateOrganization } from '@/lib/neon/queries';

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 100) {
            return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const organization = await createOrganization(name, account.id);
        if (!organization) {
            return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
        }

        return NextResponse.json({ organization }, { status: 201 });
    } catch (error) {
        console.error('Error creating organization:', error);
        return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 100) {
            return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Failed to access account' }, { status: 500 });
        }

        const organizationId = account.active_organization_id;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization to update' }, { status: 400 });
        }

        const organizations = await getAccountOrganizations(account.id);
        const activeOrg = organizations.find((o: any) => o.id === organizationId);
        if (!activeOrg || activeOrg.role !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can update organization details' }, { status: 403 });
        }

        const organization = await updateOrganization(organizationId, name);
        if (!organization) {
            return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
        }

        return NextResponse.json({ organization }, { status: 200 });
    } catch (error) {
        console.error('Error updating organization:', error);
        return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
    }
}
