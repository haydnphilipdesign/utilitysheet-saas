import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';
import { generateToken } from '@/lib/neon/db';
import { sendOrganizationInviteEmail } from '@/lib/email/email-service';
import { checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable, organizationInviteRatelimit } from '@/lib/rate-limit';
import { getClientIpOrNull } from '@/lib/network/client-ip';
import {
    createOrganizationInvite,
    getOrganizationById,
    getOrganizationInvites,
    getOrganizationMemberRole,
    getOrganizationSeatUsage,
    getOrCreateAccount,
    getPendingOrganizationInvite,
    isOrganizationMemberByEmail,
} from '@/lib/neon/queries';

function isValidEmail(email: string) {
    if (email.length > 320) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

        const role = await getOrganizationMemberRole(organizationId, account.id);
        if (role !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can view invites' }, { status: 403 });
        }

        const invites = await getOrganizationInvites(organizationId);
        return NextResponse.json({ invites });
    } catch (error) {
        console.error('Error fetching organization invites:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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

        const organizationId = account.active_organization_id as string | null;
        if (!organizationId) {
            return NextResponse.json({ error: 'No active organization' }, { status: 404 });
        }

        const actorRole = await getOrganizationMemberRole(organizationId, account.id);
        if (actorRole !== 'admin') {
            return NextResponse.json({ error: 'Only organization admins can invite members' }, { status: 403 });
        }

        const ip = getClientIpOrNull(request) || 'unknown';
        const rateLimitResult = await checkRateLimit(
            organizationInviteRatelimit,
            `${organizationId}:${account.id}:${ip}`,
            { requirePersistent: process.env.NODE_ENV === 'production' }
        );
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json(
                { error: 'Temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            );
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down before sending more invites.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const body = await request.json().catch(() => ({}));
        const emailRaw = typeof body?.email === 'string' ? body.email.trim() : '';
        const email = emailRaw.toLowerCase();
        if (!email || !isValidEmail(email)) {
            return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
        }

        const role = body?.role === 'admin' ? 'admin' : 'member';

        const organization = await getOrganizationById(organizationId);
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        if (organization.subscription_status !== 'team') {
            return NextResponse.json(
                { error: 'Team plan required', message: 'Upgrade your organization to Teams to invite members.' },
                { status: 402 }
            );
        }

        const alreadyMember = await isOrganizationMemberByEmail(organizationId, email);
        if (alreadyMember) {
            return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
        }

        const existingInvite = await getPendingOrganizationInvite(organizationId, email);
        const baseUrl = getAppBaseUrl();
        if (existingInvite) {
            return NextResponse.json({
                invite: existingInvite,
                inviteUrl: `${baseUrl}/invite/${existingInvite.token}`,
                reused: true,
            }, { headers: getRateLimitHeaders(rateLimitResult) });
        }

        const seatQuantity = Number(organization.seat_quantity) || 0;
        const seatUsage = await getOrganizationSeatUsage(organizationId);
        if (seatQuantity <= 0 || seatUsage.used + seatUsage.pendingInvites >= seatQuantity) {
            return NextResponse.json(
                {
                    error: 'No seats available',
                    message: 'Your organization has no available seats. Increase seats to invite more members.',
                    seatQuantity,
                    seatUsage,
                },
                { status: 409 }
            );
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + getInviteExpiryDays() * 24 * 60 * 60 * 1000);

        const invite = await createOrganizationInvite({
            organizationId,
            email,
            role,
            token,
            invitedByAccountId: account.id,
            expiresAt,
        });

        if (!invite) {
            return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
        }

        const inviteUrl = `${baseUrl}/invite/${token}`;

        let emailSent = false;
        try {
            const orgName = organization.name as string | undefined;
            const invitedByName = account.full_name || user.displayName || undefined;
            const result = await sendOrganizationInviteEmail({
                toEmail: email,
                organizationName: orgName || 'your organization',
                invitedByName,
                inviteUrl,
            });
            emailSent = result.success;
        } catch {
            emailSent = false;
        }

        return NextResponse.json({
            invite,
            inviteUrl,
            emailSent,
        }, { headers: getRateLimitHeaders(rateLimitResult) });
    } catch (error) {
        console.error('Error creating organization invite:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

