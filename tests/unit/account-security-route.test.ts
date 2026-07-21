import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getContext: vi.fn(),
    getProject: vi.fn(),
    recordEvent: vi.fn(),
    updateAccountEmail: vi.fn(),
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(),
    isRateLimitUnavailable: vi.fn(),
    stripeCustomerUpdate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/account/security', () => ({
    getAccountSecurityContext: mocks.getContext,
    accountSecurityErrorResponse: () => null,
    serializeStackSession: (session: Record<string, unknown>) => ({
        ...session,
        createdAt: (session.createdAt as Date).toISOString(),
        lastUsedAt: session.lastUsedAt ? (session.lastUsedAt as Date).toISOString() : null,
        location: null,
    }),
}));
vi.mock('@/lib/stack/server', () => ({
    stackServerApp: {
        getProject: mocks.getProject,
        sendForgotPasswordEmail: vi.fn(),
    },
}));
vi.mock('@/lib/neon/queries', () => ({
    recordAccountSecurityEvent: mocks.recordEvent,
    updateAccountEmail: mocks.updateAccountEmail,
}));
vi.mock('@/lib/rate-limit', () => ({
    accountSecurityRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: mocks.getRateLimitHeaders,
    isRateLimitUnavailable: mocks.isRateLimitUnavailable,
}));
vi.mock('@/lib/stripe/client', () => ({
    stripe: { customers: { update: mocks.stripeCustomerUpdate } },
}));

import { GET, POST } from '@/app/api/account/security/route';

function buildContext() {
    const primary = {
        id: 'email_primary',
        value: 'owner@example.com',
        isPrimary: true,
        isVerified: true,
        usedForAuth: true,
        update: vi.fn(),
        sendVerificationEmail: vi.fn(),
    };
    const verified = {
        id: 'email_verified',
        value: 'new@example.com',
        isPrimary: false,
        isVerified: true,
        usedForAuth: false,
        update: vi.fn(),
        sendVerificationEmail: vi.fn(),
    };
    return {
        account: { id: 'acct_1' },
        user: {
            id: 'stack_1',
            primaryEmail: primary.value,
            primaryEmailVerified: true,
            hasPassword: true,
            listContactChannels: vi.fn().mockResolvedValue([primary, verified]),
            createContactChannel: vi.fn(),
            revokeSession: vi.fn(),
        },
        sessions: [
            { id: 'current', createdAt: new Date(), lastUsedAt: new Date(), isCurrentSession: true, isImpersonation: false },
            { id: 'other', createdAt: new Date(), lastUsedAt: new Date(), isCurrentSession: false, isImpersonation: false },
        ],
        primary,
        verified,
    };
}

describe('/api/account/security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.checkRateLimit.mockResolvedValue({ success: true, reason: 'ok', limit: 12, remaining: 11, reset: 1000 });
        mocks.getRateLimitHeaders.mockReturnValue({});
        mocks.isRateLimitUnavailable.mockReturnValue(false);
        mocks.getProject.mockResolvedValue({
            config: { credentialEnabled: true, magicLinkEnabled: false, passkeyEnabled: false, oauthProviders: [] },
        });
        mocks.recordEvent.mockResolvedValue(true);
    });

    it('returns only configured sign-in methods and sessions after recent authentication', async () => {
        const context = buildContext();
        mocks.getContext.mockResolvedValue(context);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.getContext).toHaveBeenCalledWith({ requireRecentAuth: true });
        expect(body.methods).toEqual({ credential: true, magicLink: false, passkey: false, oauthProviders: [] });
        expect(body.sessions).toHaveLength(2);
    });

    it('never revokes the current session through the session control', async () => {
        const context = buildContext();
        mocks.getContext.mockResolvedValue(context);

        const response = await POST(new Request('http://localhost/api/account/security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revoke_session', sessionId: 'current' }),
        }));

        expect(response.status).toBe(409);
        expect(context.user.revokeSession).not.toHaveBeenCalled();
    });

    it('rejects a session id that is not owned by the authenticated Stack user', async () => {
        const context = buildContext();
        mocks.getContext.mockResolvedValue(context);

        const response = await POST(new Request('http://localhost/api/account/security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revoke_session', sessionId: 'someone-else' }),
        }));

        expect(response.status).toBe(404);
        expect(context.user.revokeSession).not.toHaveBeenCalled();
    });

    it('promotes only a verified contact channel and reconciles the personal account customer', async () => {
        const context = buildContext();
        mocks.getContext.mockResolvedValue(context);
        mocks.updateAccountEmail.mockResolvedValue({ id: 'acct_1', email: 'new@example.com', stripe_customer_id: 'cus_personal' });

        const response = await POST(new Request('http://localhost/api/account/security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'make_primary_email', contactChannelId: 'email_verified' }),
        }));

        expect(response.status).toBe(200);
        expect(context.verified.update).toHaveBeenCalledWith({ isPrimary: true, usedForAuth: true });
        expect(mocks.updateAccountEmail).toHaveBeenCalledWith('acct_1', 'new@example.com');
        expect(mocks.stripeCustomerUpdate).toHaveBeenCalledWith('cus_personal', { email: 'new@example.com' });
    });
});
