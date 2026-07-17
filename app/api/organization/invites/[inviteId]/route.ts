import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { generateToken } from '@/lib/neon/db';
import { sendOrganizationInviteEmail } from '@/lib/email/email-service';
import { checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable, organizationInviteRatelimit } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import {
    cancelPendingOrganizationInvite,
    getOrCreateAccount,
    getOrganizationById,
    getOrganizationInviteForOrganization,
    getOrganizationMemberRole,
    refreshPendingOrganizationInvite,
} from '@/lib/neon/queries';

type InviteRouteContext = { params: Promise<{ inviteId: string }> };
type AdminContext =
    | {
        ok: true;
        user: NonNullable<Awaited<ReturnType<typeof stackServerApp.getUser>>>;
        account: NonNullable<Awaited<ReturnType<typeof getOrCreateAccount>>>;
        organizationId: string;
    }
    | { ok: false; response: NextResponse };

function getAppBaseUrl(): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) return appUrl.replace(/\/$/, '');
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return 'http://localhost:3000';
}

function getInviteExpiryDays(): number {
    const raw = process.env.TEAM_INVITE_EXPIRY_DAYS;
    const parsed = raw ? Number(raw) : 7;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function publicInvite(invite: Record<string, unknown>) {
    return {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        invited_by_account_id: invite.invited_by_account_id,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
        updated_at: invite.updated_at,
    };
}

async function getAdminContext(): Promise<AdminContext> {
    const user = await stackServerApp.getUser();
    if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const account = await getOrCreateAccount(user.id, user.primaryEmail || '', user.displayName || undefined);
    if (!account) return { ok: false, response: NextResponse.json({ error: 'Account not found' }, { status: 404 }) };

    const organizationId = account.active_organization_id as string | null;
    if (!organizationId) return { ok: false, response: NextResponse.json({ error: 'No active organization' }, { status: 404 }) };

    const actorRole = await getOrganizationMemberRole(organizationId, account.id);
    if (actorRole !== 'admin') {
        return { ok: false, response: NextResponse.json({ error: 'Only organization admins can manage invites' }, { status: 403 }) };
    }

    return { ok: true, user, account, organizationId };
}

export async function PATCH(request: Request, { params }: InviteRouteContext): Promise<NextResponse> {
    try {
        const context = await getAdminContext();
        if (!context.ok) return context.response;

        const { user, account, organizationId } = context;
        const ip = getClientIpOrNull(request) || 'unknown';
        const rateLimitResult = await checkRateLimit(
            organizationInviteRatelimit,
            `${organizationId}:${account.id}:${ip}`,
            { requirePersistent: process.env.NODE_ENV === 'production' }
        );
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down before sending more invites.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const organization = await getOrganizationById(organizationId);
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }
        if (organization.subscription_status !== 'team') {
            return NextResponse.json({ error: 'Team plan required' }, { status: 402 });
        }

        const { inviteId } = await params;
        const existingInvite = await getOrganizationInviteForOrganization(inviteId, organizationId);
        if (!existingInvite) {
            return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + getInviteExpiryDays() * 24 * 60 * 60 * 1000);
        const invite = await refreshPendingOrganizationInvite({
            inviteId,
            organizationId,
            token,
            invitedByAccountId: account.id,
            expiresAt,
        });
        if (!invite) {
            return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
        }

        const inviteUrl = `${getAppBaseUrl()}/invite/${token}`;
        let emailSent = false;
        try {
            const result = await sendOrganizationInviteEmail({
                toEmail: String(invite.email),
                organizationName: String(organization.name || 'your organization'),
                invitedByName: account.full_name || user.displayName || undefined,
                inviteUrl,
            });
            emailSent = result.success;
        } catch {
            emailSent = false;
        }

        return NextResponse.json({
            invite: publicInvite(invite as Record<string, unknown>),
            inviteUrl,
            emailSent,
        }, { headers: getRateLimitHeaders(rateLimitResult) });
    } catch (error) {
        console.error('Error resending organization invite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: InviteRouteContext): Promise<NextResponse> {
    try {
        const context = await getAdminContext();
        if (!context.ok) return context.response;

        const { organizationId } = context;
        const { inviteId } = await params;
        const existingInvite = await getOrganizationInviteForOrganization(inviteId, organizationId);
        if (!existingInvite) {
            return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
        }

        const cancelled = await cancelPendingOrganizationInvite(inviteId, organizationId);
        if (!cancelled) {
            return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling organization invite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
