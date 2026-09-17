import 'server-only';

import { NextResponse } from 'next/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { getAccountClosureStatusByAuthUserId, type AccountClosureStatus } from '@/lib/neon/queries/account-closure';
import { stackServerApp } from '@/lib/stack/server';
import { stackSessionClientApp } from '@/lib/stack/session-client';

export const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export class AccountSecurityError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AccountSecurityError';
    }
}

export function assertRecentAuth(currentSession: { createdAt?: Date | string } | undefined) {
    const createdAt = currentSession?.createdAt ? new Date(currentSession.createdAt).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > RECENT_AUTH_WINDOW_MS) {
        throw new AccountSecurityError(
            'RECENT_AUTH_REQUIRED',
            'Confirm your password or sign in again to continue. Sensitive settings stay unlocked for five minutes.',
            403,
        );
    }
}

export async function getAccountSecurityContext(options: {
    requireRecentAuth?: boolean;
    /** Only the closure route may act on an account that is already closing. */
    allowClosing?: boolean;
} = {}) {
    const user = await stackServerApp.getUser();
    if (!user) {
        throw new AccountSecurityError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    if (!user.primaryEmail || !user.primaryEmailVerified) {
        throw new AccountSecurityError(
            'VERIFIED_EMAIL_REQUIRED',
            'A verified primary email is required for account security changes.',
            403,
        );
    }

    const activation = await ensureAccountActivation(user);
    let account: { id: string } & Record<string, unknown>;
    let closureStatus: AccountClosureStatus = 'active';
    if (activation?.account) {
        account = activation.account as { id: string } & Record<string, unknown>;
    } else {
        const closure = await getAccountClosureStatusByAuthUserId(user.id);
        if (!closure || closure.status === 'active') {
            throw new AccountSecurityError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
        }
        if (!options.allowClosing) {
            throw new AccountSecurityError('ACCOUNT_CLOSING', 'This account is being closed.', 409);
        }
        account = { id: closure.accountId };
        closureStatus = closure.status;
    }

    const { accessToken, refreshToken } = await user.getAuthJson();
    if (!accessToken || !refreshToken) {
        throw new AccountSecurityError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    const sessionUser = await stackSessionClientApp.getUser({ tokenStore: { accessToken, refreshToken } });
    if (!sessionUser || sessionUser.id !== user.id) {
        throw new AccountSecurityError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    const sessions = await sessionUser.getActiveSessions();
    const currentSession = sessions.find((session) => session.isCurrentSession);
    if (options.requireRecentAuth) {
        assertRecentAuth(currentSession);
    }

    return {
        user,
        account,
        closureStatus,
        sessions,
        currentSession,
        isImpersonation: Boolean(currentSession?.isImpersonation),
    };
}

export function accountSecurityErrorResponse(error: unknown) {
    if (error instanceof AccountSecurityError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status, headers: { 'Cache-Control': 'private, no-store' } },
        );
    }
    return null;
}

export function serializeStackSession(session: {
    id: string;
    createdAt: Date;
    lastUsedAt?: Date;
    isCurrentSession: boolean;
    isImpersonation: boolean;
    geoInfo?: {
        cityName?: string | null;
        regionCode?: string | null;
        countryCode?: string | null;
    };
}) {
    return {
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt?.toISOString() || null,
        isCurrentSession: session.isCurrentSession,
        isImpersonation: session.isImpersonation,
        location: [
            session.geoInfo?.cityName,
            session.geoInfo?.regionCode,
            session.geoInfo?.countryCode,
        ].filter(Boolean).join(', ') || null,
    };
}
