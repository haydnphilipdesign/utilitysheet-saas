import 'server-only';

import { NextResponse } from 'next/server';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { stackServerApp } from '@/lib/stack/server';

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

export async function getAccountSecurityContext(options: { requireRecentAuth?: boolean } = {}) {
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
    if (!activation?.account) {
        throw new AccountSecurityError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    }

    const sessions = await user.getActiveSessions();
    const currentSession = sessions.find((session) => session.isCurrentSession);
    if (options.requireRecentAuth) {
        const createdAt = currentSession?.createdAt ? new Date(currentSession.createdAt).getTime() : 0;
        if (!createdAt || Date.now() - createdAt > RECENT_AUTH_WINDOW_MS) {
            throw new AccountSecurityError(
                'RECENT_AUTH_REQUIRED',
                'Please verify your password to continue.',
                403,
            );
        }
    }

    return {
        user,
        account: activation.account,
        sessions,
        currentSession,
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
