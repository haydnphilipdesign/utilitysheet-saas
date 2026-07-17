import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationMemberRole,
    updateOrganization,
} from '@/lib/neon/queries';
import { organizationUpdateBodySchema } from '@/lib/validation/schemas';

export async function PATCH(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const organizationId = account.active_organization_id as string | null;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization' }, { status: 404 });
        }

        const actorRole = await getOrganizationMemberRole(organizationId, account.id);
        if (actorRole !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can update workspace details' }, { status: 403 });
        }

        const parsed = organizationUpdateBodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Workspace name must be between 2 and 100 characters' }, { status: 400 });
        }

        const organization = await updateOrganization(organizationId, parsed.data.name);
        if (!organization) {
            return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
        }

        return NextResponse.json({ organization });
    } catch (error) {
        console.error('Error updating organization:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
