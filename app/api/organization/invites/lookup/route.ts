import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { checkRateLimit, getRateLimitHeaders, organizationInviteLookupRatelimit } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import {
    getOrCreateAccount,
    getOrganizationInviteSummaryByToken,
    getOrganizationMemberRole,
} from '@/lib/neon/queries';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * What an invitation link is, and how the visitor relates to it. Works signed
 * out: the token in the link is the capability, exactly as it is in the email.
 * Joining still goes through the accept route and its checks.
 */
export async function GET(request: Request) {
    try {
        const ip = getClientIpOrNull(request) || 'unknown';
        const rateLimitResult = await checkRateLimit(organizationInviteLookupRatelimit, ip);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Wait a minute and try again.' },
                { status: 429, headers: { ...NO_STORE, ...getRateLimitHeaders(rateLimitResult) } }
            );
        }

        const token = new URL(request.url).searchParams.get('token')?.trim() || '';
        if (!token || token.length > 200) {
            return NextResponse.json({ status: 'not_found' }, { status: 404, headers: NO_STORE });
        }

        const invite = await getOrganizationInviteSummaryByToken(token);
        if (!invite) {
            return NextResponse.json({ status: 'not_found' }, { status: 404, headers: NO_STORE });
        }

        const user = await stackServerApp.getUser();
        const account = user
            ? await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined)
            : null;
        // Same comparison the accept route makes.
        const viewerEmail = account ? (account.email || user?.primaryEmail || '').trim() : '';
        const invitedEmail = String(invite.email).trim();
        const isMember = account
            ? Boolean(await getOrganizationMemberRole(invite.organization_id, account.id))
            : false;

        const expiresAt = new Date(invite.expires_at);
        const status = invite.accepted_at
            ? 'accepted'
            : Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()
                ? 'expired'
                : 'open';

        return NextResponse.json({
            status,
            workspaceName: invite.organization_name,
            invitedByName: invite.invited_by_name,
            invitedEmail,
            role: invite.role === 'admin' ? 'admin' : 'member',
            expiresAt: invite.expires_at,
            workspaceOnTeams: invite.organization_subscription_status === 'team',
            viewer: {
                signedIn: Boolean(account),
                email: viewerEmail || null,
                emailMatches: Boolean(viewerEmail) && viewerEmail.toLowerCase() === invitedEmail.toLowerCase(),
                isMember,
                // Only a member is told which workspace to open.
                organizationId: isMember ? invite.organization_id : null,
            },
        }, { headers: NO_STORE });
    } catch (error) {
        console.error('Error looking up organization invite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE });
    }
}
