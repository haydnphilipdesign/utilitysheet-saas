import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import {
    acceptOrganizationInviteWithSeatGuard,
    getOrganizationById,
    getOrganizationInviteByToken,
    getOrCreateAccount,
    setActiveOrganization,
} from '@/lib/neon/queries';

export async function POST(request: Request) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const body = await request.json().catch(() => ({}));
        const token = typeof body?.token === 'string' ? body.token.trim() : '';
        if (!token) {
            return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
        }

        const invite = await getOrganizationInviteByToken(token);
        if (!invite) {
            return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
        }

        if (invite.accepted_at) {
            return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
        }

        const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
        if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
        }

        const accountEmail = (account.email || user.primaryEmail || '').trim().toLowerCase();
        const inviteEmail = (invite.email as string).trim().toLowerCase();
        if (!accountEmail || accountEmail !== inviteEmail) {
            return NextResponse.json(
                { error: 'Email mismatch', message: 'Please sign in with the email address that was invited.' },
                { status: 403 }
            );
        }

        const organizationId = invite.organization_id as string;
        const organization = await getOrganizationById(organizationId);
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        if (organization.subscription_status !== 'team') {
            return NextResponse.json(
                { error: 'Team plan required', message: 'This organization is not currently on a Teams plan.' },
                { status: 402 }
            );
        }

        const acceptanceResult = await acceptOrganizationInviteWithSeatGuard({
            organizationId,
            inviteId: invite.id as string,
            accountId: account.id,
            role: invite.role === 'admin' ? 'admin' : 'member',
        });

        if (acceptanceResult.status === 'no_seat') {
            return NextResponse.json(
                { error: 'No seats available', message: 'This organization has no available seats.' },
                { status: 409 }
            );
        }

        if (acceptanceResult.status === 'already_accepted') {
            return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
        }

        await setActiveOrganization(account.id, organizationId);

        return NextResponse.json({ success: true, organizationId });
    } catch (error) {
        console.error('Error accepting organization invite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
