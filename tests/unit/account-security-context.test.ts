import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getServerUser: vi.fn(),
    getSessionUser: vi.fn(),
    activate: vi.fn(),
    closureStatus: vi.fn(),
    clientOptions: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getServerUser } }));
vi.mock('@stackframe/stack', () => ({
    StackClientApp: class {
        constructor(options: unknown) { mocks.clientOptions(options); }
        getUser = mocks.getSessionUser;
    },
}));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation: mocks.activate }));
vi.mock('@/lib/neon/queries/account-closure', () => ({ getAccountClosureStatusByAuthUserId: mocks.closureStatus }));

import { getAccountSecurityContext, RECENT_AUTH_WINDOW_MS } from '@/lib/account/security';

function setup(createdAt = new Date()) {
    const auth = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' };
    const serverUser = {
        id: 'user_1', primaryEmail: 'owner@example.com', primaryEmailVerified: true,
        getAuthJson: vi.fn().mockResolvedValue(auth),
        getActiveSessions: vi.fn().mockRejectedValue(new TypeError('sessions.map is not a function')),
    };
    const current = { id: 'current', createdAt, isCurrentSession: true, isImpersonation: false };
    const sessionUser = {
        id: 'user_1',
        getActiveSessions: vi.fn().mockResolvedValue([
            { id: 'other', createdAt: new Date(), isCurrentSession: false, isImpersonation: false }, current,
        ]),
    };
    mocks.getServerUser.mockResolvedValue(serverUser);
    mocks.getSessionUser.mockResolvedValue(sessionUser);
    mocks.activate.mockResolvedValue({ account: { id: 'account_1' } });
    return { auth, serverUser, sessionUser, current };
}

describe('account security session context', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('uses request-scoped authenticated client sessions instead of the broken server listing', async () => {
        const { auth, serverUser, sessionUser, current } = setup();
        const result = await getAccountSecurityContext({ requireRecentAuth: true });
        expect(mocks.getSessionUser).toHaveBeenCalledWith({ tokenStore: auth });
        expect(serverUser.getActiveSessions).not.toHaveBeenCalled();
        expect(sessionUser.getActiveSessions).toHaveBeenCalledOnce();
        expect(result.user).toBe(serverUser);
        expect(result.currentSession).toBe(current);
        expect(result.sessions).toHaveLength(2);
    });

    it('rejects an expired current session even when another session is recent', async () => {
        setup(new Date(Date.now() - RECENT_AUTH_WINDOW_MS - 1000));
        await expect(getAccountSecurityContext({ requireRecentAuth: true })).rejects.toMatchObject({ code: 'RECENT_AUTH_REQUIRED' });
    });

    it('requires reauthentication when no session is marked current', async () => {
        const { current } = setup();
        current.isCurrentSession = false;
        await expect(getAccountSecurityContext({ requireRecentAuth: true })).rejects.toMatchObject({ code: 'RECENT_AUTH_REQUIRED' });
    });

    it.each([null, { id: 'different_user' }])('rejects a missing or mismatched session user: %j', async (sessionUser) => {
        setup();
        mocks.getSessionUser.mockResolvedValue(sessionUser);
        await expect(getAccountSecurityContext()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('propagates session lookup failures without unlocking settings', async () => {
        const { sessionUser } = setup();
        sessionUser.getActiveSessions.mockRejectedValue(new Error('Session service unavailable'));
        await expect(getAccountSecurityContext({ requireRecentAuth: true })).rejects.toThrow('Session service unavailable');
    });

    it('rejects missing tokens before requesting a client session', async () => {
        const { serverUser } = setup();
        serverUser.getAuthJson.mockResolvedValue({ accessToken: null, refreshToken: null });
        await expect(getAccountSecurityContext()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        expect(mocks.getSessionUser).not.toHaveBeenCalled();
    });

    it('preserves impersonation detection for closure guards', async () => {
        const { current } = setup();
        current.isImpersonation = true;
        expect((await getAccountSecurityContext({ requireRecentAuth: true })).isImpersonation).toBe(true);
    });
});
