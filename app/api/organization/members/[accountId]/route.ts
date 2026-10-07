import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    getOrganizationAdminCount,
    getOrganizationMemberRole,
    getOrCreateAccount,
    removeOrganizationMemberWithHandover,
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Removes a member (admins) or leaves the workspace (anyone, for themselves).
 * The requests and Branding Profiles the person created in the workspace are
 * handed to an admin who stays: the one named in `transferTo`, otherwise the
 * admin doing the removing, otherwise the longest-standing other admin.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
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

        const { accountId: targetAccountId } = await params;
        const leaving = targetAccountId === account.id;
        const actorRole = await getOrganizationMemberRole(organizationId, account.id);
        if (actorRole !== 'admin' && !(leaving && actorRole)) {
            return NextResponse.json({ error: 'Only organization admins can manage members' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const transferTo = body?.transferTo;
        if (transferTo !== undefined && transferTo !== null && (typeof transferTo !== 'string' || !UUID_PATTERN.test(transferTo))) {
            return NextResponse.json({ error: 'Invalid transfer recipient' }, { status: 400 });
        }

        const result = await removeOrganizationMemberWithHandover({
            organizationId,
            accountId: targetAccountId,
            recipientAccountId: transferTo || null,
            preferredAccountId: leaving ? null : account.id,
        });

        if (!result.removed) {
            if (result.reason === 'last_admin') {
                return NextResponse.json({
                    error: 'Cannot remove the last admin',
                    message: leaving
                        ? 'You’re the only admin of this workspace. Make someone else an admin first, then you can leave.'
                        : undefined,
                }, { status: 400 });
            }
            if (result.reason === 'no_recipient') {
                return NextResponse.json({
                    error: 'No admin can take over',
                    message: 'The requests and Branding Profiles this person created need an admin of this workspace to take them over, and that admin isn’t available. Nothing was changed.',
                }, { status: 400 });
            }
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            left: leaving,
            requestsMoved: result.requestsMoved,
            profilesMoved: result.profilesMoved,
            recipientAccountId: result.recipientAccountId,
        });
    } catch (error) {
        console.error('Error removing organization member:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
