import 'server-only';

import { stackServerApp } from '@/lib/stack/server';
import { getAccountsByAuthUserIds } from '@/lib/neon/queries';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';

type AuthUserRecord = {
    id: string;
    primaryEmail: string | null;
    primaryEmailVerified: boolean;
    displayName: string | null;
    signedUpAt: Date;
};

type MissingAuthUser = {
    id: string;
    primaryEmail: string | null;
    primaryEmailVerified: boolean;
    displayName: string | null;
    signedUpAt: string;
};

type SkippedMissingAuthUser = MissingAuthUser & {
    reason: 'missing_primary_email' | 'email_not_verified';
};

type FailedMissingAuthUser = MissingAuthUser & {
    reason: string;
};

export type ReconcileAuthUsersResult = {
    scanned: number;
    existingAccountCount: number;
    missingCount: number;
    eligibleCount: number;
    createdCount: number;
    skipped: SkippedMissingAuthUser[];
    failures: FailedMissingAuthUser[];
    dryRun: boolean;
    nextCursor: string | null;
};

function serializeAuthUser(user: AuthUserRecord): MissingAuthUser {
    return {
        id: user.id,
        primaryEmail: user.primaryEmail,
        primaryEmailVerified: user.primaryEmailVerified,
        displayName: user.displayName,
        signedUpAt: user.signedUpAt.toISOString(),
    };
}

export async function reconcileAuthUsers(options?: {
    cursor?: string | null;
    limit?: number;
    execute?: boolean;
    includeUnverified?: boolean;
    scanAll?: boolean;
}): Promise<ReconcileAuthUsersResult> {
    const limit = Math.max(1, Math.min(options?.limit ?? 100, 200));
    const execute = options?.execute === true;
    const includeUnverified = options?.includeUnverified === true;
    const scanAll = options?.scanAll === true;
    let cursor = options?.cursor || null;
    let scanned = 0;
    let existingAccountCount = 0;
    let missingCount = 0;
    let eligibleCount = 0;
    let createdCount = 0;
    const skipped: SkippedMissingAuthUser[] = [];
    const failures: FailedMissingAuthUser[] = [];

    do {
        const users = await stackServerApp.listUsers({
            cursor: cursor || undefined,
            limit,
            orderBy: 'signedUpAt',
            desc: true,
            includeAnonymous: false,
        });

        const authUsers = Array.from(users).map((user) => ({
            id: user.id,
            primaryEmail: user.primaryEmail,
            primaryEmailVerified: user.primaryEmailVerified,
            displayName: user.displayName,
            signedUpAt: user.signedUpAt,
        }));

        scanned += authUsers.length;

        const existingAccounts = await getAccountsByAuthUserIds(authUsers.map((user) => user.id));
        existingAccountCount += existingAccounts.length;

        const existingAuthIds = new Set(existingAccounts.map((account) => account.auth_user_id).filter(Boolean));
        const missingUsers = authUsers.filter((user) => !existingAuthIds.has(user.id));
        missingCount += missingUsers.length;

        const eligibleUsers = missingUsers.filter((user) => {
            if (!user.primaryEmail) {
                skipped.push({ ...serializeAuthUser(user), reason: 'missing_primary_email' });
                return false;
            }
            if (!includeUnverified && !user.primaryEmailVerified) {
                skipped.push({ ...serializeAuthUser(user), reason: 'email_not_verified' });
                return false;
            }
            return true;
        });

        eligibleCount += eligibleUsers.length;

        if (execute) {
            for (const user of eligibleUsers) {
                try {
                    const activation = await ensureAccountActivation({
                        id: user.id,
                        primaryEmail: user.primaryEmail,
                        displayName: user.displayName,
                        signedUpAt: user.signedUpAt,
                    });

                    if (!activation?.account) {
                        failures.push({ ...serializeAuthUser(user), reason: 'activation_failed' });
                        continue;
                    }

                    createdCount += 1;
                } catch (error) {
                    failures.push({
                        ...serializeAuthUser(user),
                        reason: error instanceof Error ? error.message : 'activation_failed',
                    });
                }
            }
        }

        cursor = users.nextCursor ?? null;
    } while (scanAll && cursor);

    return {
        scanned,
        existingAccountCount,
        missingCount,
        eligibleCount,
        createdCount,
        skipped,
        failures,
        dryRun: !execute,
        nextCursor: scanAll ? null : cursor,
    };
}
