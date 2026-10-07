import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { getOpenOrganizationInvitesForEmail, getOrCreateAccount } from '@/lib/neon/queries';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Open invitations addressed to the signed-in person, so the dashboard can show
 * them without the email. The link is only handed to someone who has proved
 * they own the invited address.
 */
export async function GET() {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
        }

        const email = (user.primaryEmail || '').trim();
        if (!email || !user.primaryEmailVerified) {
            return NextResponse.json({ invitations: [] }, { headers: NO_STORE });
        }

        const account = await getOrCreateAccount(user.id, email, user.displayName || undefined);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: NO_STORE });
        }

        const invites = await getOpenOrganizationInvitesForEmail(email, account.id);
        return NextResponse.json({
            invitations: invites.map((invite) => ({
                id: invite.id,
                workspaceName: invite.organization_name,
                invitedByName: invite.invited_by_name,
                expiresAt: invite.expires_at,
                url: `/invite/${invite.token}`,
            })),
        }, { headers: NO_STORE });
    } catch (error) {
        console.error('Error fetching invitations for account:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE });
    }
}
