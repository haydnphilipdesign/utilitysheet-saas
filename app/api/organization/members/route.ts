import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationMemberRole,
    getOrganizationMembers,
    getOrganizationSeatUsage,
} from '@/lib/neon/queries';

export async function GET() {
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

        const [role, organization, members, seatUsage] = await Promise.all([
            getOrganizationMemberRole(organizationId, account.id),
            getOrganizationById(organizationId),
            getOrganizationMembers(organizationId),
            getOrganizationSeatUsage(organizationId),
        ]);

        if (!role) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        return NextResponse.json({
            organization,
            role,
            members,
            seatUsage,
        });
    } catch (error) {
        console.error('Error fetching organization members:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

