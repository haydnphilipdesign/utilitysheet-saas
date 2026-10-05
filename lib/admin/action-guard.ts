import "server-only";
import { ZodError } from 'zod';
import { assertAdminWritesEnabled, getRequestContext, requireAdmin } from '@/lib/admin';
import { AdminActionRefusal } from '@/lib/admin/refusals';
import type { AdminActor } from '@/lib/neon/queries/admin-writes';

export { AdminActionRefusal, STALE_EDIT_MESSAGE } from '@/lib/admin/refusals';

export type AdminActionFailure = {
    success: false;
    error: string;
    code: string;
    /** Present for unexpected failures; quote it when investigating server logs. */
    correlationId?: string;
};

/**
 * Authorizes an Admin write at the callable boundary and captures request
 * context before any statement is built. Layout protection is not relied upon.
 */
export async function beginAdminWrite(): Promise<{
    actor: AdminActor;
    account: Awaited<ReturnType<typeof requireAdmin>>['account'];
    user: Awaited<ReturnType<typeof requireAdmin>>['user'];
}> {
    const { account, user } = await requireAdmin();
    assertAdminWritesEnabled();
    const { ipAddress, userAgent } = await getRequestContext();
    return { account, user, actor: { adminId: account.id, ipAddress, userAgent } };
}

/**
 * Converts any thrown value into a stable, safe failure. Raw SQL and provider
 * exceptions never reach the client: they are logged with a correlation ID.
 */
export function adminActionFailure(error: unknown, operation: string): AdminActionFailure {
    if (error instanceof AdminActionRefusal) {
        return { success: false, error: error.message, code: error.code };
    }

    if (error instanceof ZodError) {
        return {
            success: false,
            error: error.issues[0]?.message || 'Invalid input',
            code: 'INVALID_INPUT',
        };
    }

    const name = error instanceof Error ? error.name : '';
    if (name === 'AdminAuthorizationError') {
        return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
    }
    if (name === 'AdminWriteDisabledError') {
        return {
            success: false,
            error: 'Admin writes are disabled via ADMIN_WRITES_DISABLED=true',
            code: 'WRITES_DISABLED',
        };
    }
    if (name === 'DatabaseUnavailableError') {
        return { success: false, error: 'Database is not configured. Nothing was saved.', code: 'DATABASE_UNAVAILABLE' };
    }

    const correlationId = crypto.randomUUID();
    console.error('[admin][action_failed]', {
        operation,
        correlationId,
        errorName: name || typeof error,
        errorCode: (error as { code?: unknown } | null)?.code ?? null,
        message: error instanceof Error ? error.message.slice(0, 500) : null,
    });
    return {
        success: false,
        error: `The action could not be completed and nothing was saved. Reference ${correlationId.slice(0, 8)}.`,
        code: 'INTERNAL',
        correlationId,
    };
}

/**
 * Runs a post-commit side effect (cache refresh). A failure here must never be
 * reported as a failed or rolled-back mutation.
 */
export function afterCommit(operation: string, effect: () => void) {
    try {
        effect();
    } catch (error) {
        console.warn('[admin][post_commit_refresh_failed]', {
            operation,
            errorName: error instanceof Error ? error.name : typeof error,
        });
    }
}
