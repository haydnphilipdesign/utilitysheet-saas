import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    clearActiveOrganizationIfMatches,
    getOrganizationAdminCount,
    getOrganizationMemberRole,
    getOrCreateAccount,
    removeOrganizationMember,
    updateOrganizationMemberRole,
} from '@/lib/neon/queries';

export async function PATCH(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
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
            return NextResponse.json({ error: 'Only organization admins can manage members' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const role = body?.role;
        if (role !== 'admin' && role !== 'member') {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const { accountId: targetAccountId } = await params;
        const targetRole = await getOrganizationMemberRole(organizationId, targetAccountId);
        if (!targetRole) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        if (targetRole === 'admin' && role === 'member') {
            const adminCount = await getOrganizationAdminCount(organizationId);
            if (adminCount <= 1) {
                return NextResponse.json({ error: 'Organization must have at least one admin' }, { status: 400 });
            }
        }

        const updated = await updateOrganizationMemberRole({
            organizationId,
            accountId: targetAccountId,
            role,
        });

        return NextResponse.json({ member: updated });
    } catch (error) {
        console.error('Error updating organization member:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
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
            return NextResponse.json({ error: 'Only organization admins can manage members' }, { status: 403 });
        }

        const { accountId: targetAccountId } = await params;
        const targetRole = await getOrganizationMemberRole(organizationId, targetAccountId);
        if (!targetRole) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        if (targetRole === 'admin') {
            const adminCount = await getOrganizationAdminCount(organizationId);
            if (adminCount <= 1) {
                return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
            }
        }

        const removed = await removeOrganizationMember({ organizationId, accountId: targetAccountId });
        if (!removed) {
            return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
        }

        await clearActiveOrganizationIfMatches(targetAccountId, organizationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing organization member:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
