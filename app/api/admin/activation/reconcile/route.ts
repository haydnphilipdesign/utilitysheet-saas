import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
    AdminAuthorizationError,
    AdminWriteDisabledError,
    assertAdminWritesEnabled,
    getRequestContext,
    requireAdmin,
} from '@/lib/admin';
import { reconcileAuthUsers } from '@/lib/activation/reconcile-auth-users';
import { insertAdminAudit } from '@/lib/neon/queries/admin-writes';
import { adminReconcileBodySchema } from '@/lib/validation/admin-schemas';

function parseLimit(value: string | null, fallback = 100) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(parsed, 200));
}

/** Stable, safe errors only. Raw SQL and provider messages stay in server logs. */
function errorResponse(error: unknown, operation: string) {
    if (error instanceof AdminAuthorizationError) {
        return NextResponse.json({ error: 'Admin access required', code: 'UNAUTHORIZED' }, { status: 403 });
    }
    if (error instanceof AdminWriteDisabledError) {
        return NextResponse.json(
            { error: 'Admin writes are disabled via ADMIN_WRITES_DISABLED=true', code: 'WRITES_DISABLED' },
            { status: 403 }
        );
    }
    if (error instanceof ZodError) {
        return NextResponse.json(
            { error: error.issues[0]?.message || 'Invalid input', code: 'INVALID_INPUT' },
            { status: 400 }
        );
    }

    const correlationId = crypto.randomUUID();
    console.error('[admin][reconcile_failed]', {
        operation,
        correlationId,
        errorName: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message.slice(0, 500) : null,
    });
    return NextResponse.json(
        {
            error: `Reconciliation could not be completed. Reference ${correlationId.slice(0, 8)}.`,
            code: 'INTERNAL',
            correlationId,
        },
        { status: 500 }
    );
}

export async function GET(request: Request) {
    try {
        await requireAdmin();

        const { searchParams } = new URL(request.url);
        const result = await reconcileAuthUsers({
            limit: parseLimit(searchParams.get('limit')),
            cursor: searchParams.get('cursor'),
            includeUnverified: searchParams.get('includeUnverified') === 'true',
            scanAll: searchParams.get('scanAll') === 'true',
            execute: false,
        });

        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error, 'preview');
    }
}

/**
 * Manual reconciliation. Requires a reason and confirmation of the reviewed
 * scope. An attempt record is committed before execution and a sanitized
 * outcome afterward. Reconciliation creates accounts one at a time and is not
 * one atomic operation, so partial and unknown outcomes are recorded as such.
 * The scheduled cron route is independent and needs no interactive reason.
 */
export async function POST(request: Request) {
    try {
        const { account } = await requireAdmin();
        assertAdminWritesEnabled();
        const { ipAddress, userAgent } = await getRequestContext();
        const actor = { adminId: account.id, ipAddress, userAgent };

        const parsed = adminReconcileBodySchema.parse(await request.json().catch(() => ({})));
        const attemptId = crypto.randomUUID();
        const scope = {
            limit: parsed.limit,
            scanAll: parsed.scanAll,
            includeUnverified: parsed.includeUnverified,
            reviewedEligibleCount: parsed.reviewedEligibleCount,
        };

        // Evidence of the attempt exists before any account is created.
        await insertAdminAudit({
            actor,
            action: 'auth_reconciliation_started',
            metadata: { reason: parsed.reason, attemptId, scope },
        });

        let result: Awaited<ReturnType<typeof reconcileAuthUsers>> | null = null;
        let executionError: unknown = null;
        try {
            result = await reconcileAuthUsers({
                limit: parsed.limit,
                cursor: parsed.cursor,
                includeUnverified: parsed.includeUnverified,
                scanAll: parsed.scanAll,
                execute: true,
            });
        } catch (error) {
            executionError = error;
        }

        // Counts only: no user lists, emails or raw provider responses.
        const outcome = !result
            ? 'unknown'
            : result.failures.length === 0
                ? 'completed'
                : result.createdCount > 0 ? 'partial' : 'failed';
        const summary = result
            ? {
                scanned: result.scanned,
                eligible: result.eligibleCount,
                created: result.createdCount,
                skipped: result.skipped.length,
                failures: result.failures.length,
            }
            : null;

        let outcomeRecorded = true;
        try {
            await insertAdminAudit({
                actor,
                action: 'auth_reconciliation_finished',
                metadata: { reason: parsed.reason, attemptId, scope, outcome, summary },
            });
        } catch (error) {
            // The accounts already exist; say so rather than implying a rollback.
            outcomeRecorded = false;
            console.error('[admin][reconcile_outcome_audit_failed]', {
                attemptId,
                outcome,
                errorName: error instanceof Error ? error.name : typeof error,
            });
        }

        if (!result) {
            console.error('[admin][reconcile_execution_failed]', {
                attemptId,
                errorName: executionError instanceof Error ? executionError.name : typeof executionError,
                message: executionError instanceof Error ? executionError.message.slice(0, 500) : null,
            });
            return NextResponse.json(
                {
                    error: 'Reconciliation stopped before finishing. Some accounts may have been created. Refresh the preview before retrying.',
                    code: 'RECONCILIATION_OUTCOME_UNKNOWN',
                    attemptId,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ ...result, attemptId, outcome, outcomeRecorded });
    } catch (error) {
        return errorResponse(error, 'execute');
    }
}
