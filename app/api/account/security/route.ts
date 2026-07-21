import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAccountSecurityContext, accountSecurityErrorResponse, serializeStackSession } from '@/lib/account/security';
import { recordAccountSecurityEvent, updateAccountEmail } from '@/lib/neon/queries';
import { accountSecurityRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';
import { enforceMaxRequestBodyBytes, invalidRequestBodyResponse } from '@/lib/security/api-response';
import { stackServerApp } from '@/lib/stack/server';
import { stripe } from '@/lib/stripe/client';

const MAX_BODY_BYTES = 8 * 1024;

const actionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('begin_email_change'), email: z.string().trim().email().max(254) }),
    z.object({ action: z.literal('make_primary_email'), contactChannelId: z.string().min(1).max(200) }),
    z.object({ action: z.literal('revoke_session'), sessionId: z.string().min(1).max(200) }),
    z.object({ action: z.literal('revoke_other_sessions') }),
    z.object({ action: z.literal('password_changed'), revokeOtherSessions: z.boolean().default(true) }),
    z.object({ action: z.literal('request_password_reset') }),
]);

async function applyRateLimit(userId: string) {
    const result = await checkRateLimit(accountSecurityRatelimit, userId, {
        requirePersistent: process.env.NODE_ENV === 'production',
    });
    if (isRateLimitUnavailable(result)) {
        return { response: NextResponse.json({ error: 'Security controls are temporarily unavailable.' }, { status: 503 }) };
    }
    if (!result.success) {
        return {
            response: NextResponse.json(
                { error: 'Too many account security requests. Please try again later.' },
                { status: 429, headers: getRateLimitHeaders(result) },
            ),
        };
    }
    return { result };
}

export async function GET() {
    try {
        const context = await getAccountSecurityContext({ requireRecentAuth: true });
        const limited = await applyRateLimit(context.user.id);
        if (limited.response) return limited.response;

        const [project, contactChannels] = await Promise.all([
            stackServerApp.getProject(),
            context.user.listContactChannels(),
        ]);

        return NextResponse.json({
            primaryEmail: context.user.primaryEmail,
            primaryEmailVerified: context.user.primaryEmailVerified,
            hasPassword: context.user.hasPassword,
            methods: {
                credential: project.config.credentialEnabled,
                magicLink: project.config.magicLinkEnabled,
                passkey: project.config.passkeyEnabled,
                oauthProviders: project.config.oauthProviders.map((provider) => provider.id),
            },
            contactChannels: contactChannels.map((channel) => ({
                id: channel.id,
                value: channel.value,
                isPrimary: channel.isPrimary,
                isVerified: channel.isVerified,
                usedForAuth: channel.usedForAuth,
            })),
            sessions: context.sessions.map(serializeStackSession),
        }, {
            headers: {
                ...getRateLimitHeaders(limited.result!),
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Failed to load account security settings', error);
        return NextResponse.json({ error: 'Failed to load account security settings.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const tooLarge = enforceMaxRequestBodyBytes(request, MAX_BODY_BYTES);
    if (tooLarge) return tooLarge;

    try {
        const context = await getAccountSecurityContext({ requireRecentAuth: true });
        const limited = await applyRateLimit(context.user.id);
        if (limited.response) return limited.response;

        const parsed = actionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return invalidRequestBodyResponse('INVALID_ACCOUNT_SECURITY_ACTION', 'Invalid account security action.');
        }

        const data = parsed.data;
        if (data.action === 'begin_email_change') {
            const normalized = data.email.toLowerCase();
            const channels = await context.user.listContactChannels();
            let channel = channels.find((candidate) => candidate.value.toLowerCase() === normalized);
            if (!channel) {
                channel = await context.user.createContactChannel({
                    type: 'email',
                    value: normalized,
                    usedForAuth: false,
                    isPrimary: false,
                });
            }
            if (!channel.isVerified) {
                await channel.sendVerificationEmail({ callbackUrl: '/dashboard/settings?tab=account' });
            }
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: 'email_change_started',
            });
            return NextResponse.json({ success: true, verificationRequired: !channel.isVerified }, {
                headers: { ...getRateLimitHeaders(limited.result!), 'Cache-Control': 'private, no-store' },
            });
        }

        if (data.action === 'make_primary_email') {
            const channels = await context.user.listContactChannels();
            const channel = channels.find((candidate) => candidate.id === data.contactChannelId);
            if (!channel || !channel.isVerified) {
                return NextResponse.json({ error: 'Verify this email before making it primary.' }, { status: 409 });
            }

            await channel.update({ isPrimary: true, usedForAuth: true });
            const account = await updateAccountEmail(context.account.id as string, channel.value);
            if (!account) {
                throw new Error('Primary email changed in Stack but account reconciliation failed.');
            }
            if (stripe && account.stripe_customer_id) {
                try {
                    await stripe.customers.update(account.stripe_customer_id as string, { email: channel.value });
                } catch (error) {
                    console.error('Personal Stripe customer email reconciliation failed', error);
                }
            }
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: 'primary_email_changed',
                metadata: { stripeEmailSyncAttempted: Boolean(account.stripe_customer_id) },
            });
            return NextResponse.json({ success: true, primaryEmail: channel.value }, {
                headers: { ...getRateLimitHeaders(limited.result!), 'Cache-Control': 'private, no-store' },
            });
        }

        if (data.action === 'revoke_session') {
            const target = context.sessions.find((session) => session.id === data.sessionId);
            if (!target) {
                return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
            }
            if (target.isCurrentSession) {
                return NextResponse.json({ error: 'Use Sign Out to end the current session.' }, { status: 409 });
            }
            await context.user.revokeSession(target.id);
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: 'session_revoked',
            });
        }

        if (data.action === 'revoke_other_sessions' || (data.action === 'password_changed' && data.revokeOtherSessions)) {
            const otherSessions = context.sessions.filter((session) => !session.isCurrentSession);
            await Promise.all(otherSessions.map((session) => context.user.revokeSession(session.id)));
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: data.action === 'password_changed' ? 'password_changed' : 'other_sessions_revoked',
                metadata: { revokedCount: otherSessions.length },
            });
        } else if (data.action === 'password_changed') {
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: 'password_changed',
                metadata: { revokedCount: 0 },
            });
        }

        if (data.action === 'request_password_reset') {
            const result = await stackServerApp.sendForgotPasswordEmail(context.user.primaryEmail!, {
                callbackUrl: '/dashboard/settings?tab=account',
            });
            if (result.status === 'error') {
                throw new Error('Stack Auth could not send the password setup email.');
            }
            await recordAccountSecurityEvent({
                accountId: context.account.id as string,
                action: 'password_reset_requested',
            });
        }

        return NextResponse.json({ success: true }, {
            headers: { ...getRateLimitHeaders(limited.result!), 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        const response = accountSecurityErrorResponse(error);
        if (response) return response;
        console.error('Account security action failed', error);
        return NextResponse.json({ error: 'Account security action failed.' }, { status: 500 });
    }
}
