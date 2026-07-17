'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ReconcilePreview = {
    scanned: number;
    existingAccountCount: number;
    missingCount: number;
    eligibleCount: number;
    createdCount: number;
    skipped: Array<{
        id: string;
        reason: string;
        signedUpAt: string;
        primaryEmail: string | null;
        primaryEmailVerified: boolean;
        displayName: string | null;
    }>;
    failures: Array<{ reason: string }>;
    dryRun: boolean;
    nextCursor: string | null;
};

export const AUTH_RECONCILIATION_TIMEOUT_MS = 15_000;
const STALE_BLOCKED_SIGNUP_DAYS = 30;

function pluralize(count: number, singular: string, plural: string) {
    return count === 1 ? singular : plural;
}

function isStaleBlockedSignup(signedUpAt: string) {
    const signedUpAtMs = Date.parse(signedUpAt);
    if (!Number.isFinite(signedUpAtMs)) return false;
    return Date.now() - signedUpAtMs >= STALE_BLOCKED_SIGNUP_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchReconciliation(url: string, init: RequestInit, timeoutMessage: string): Promise<ReconcilePreview> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), AUTH_RECONCILIATION_TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data?.error || timeoutMessage.replace(' timed out', ' failed'));
        return data as ReconcilePreview;
    } catch (error) {
        if (controller.signal.aborted) throw new Error(timeoutMessage);
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
}

export function AuthReconciliationCard() {
    const router = useRouter();
    const [preview, setPreview] = useState<ReconcilePreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

    const loadPreview = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const nextPreview = await fetchReconciliation(
                '/api/admin/activation/reconcile?limit=200&scanAll=true',
                { method: 'GET', cache: 'no-store' },
                'Auth reconciliation check timed out. Please retry.'
            );
            setPreview(nextPreview);
            setLastCheckedAt(new Date());
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to inspect pending auth signups');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPreview();
    }, [loadPreview]);

    const runReconciliation = async () => {
        setRunning(true);
        setError(null);

        try {
            const result = await fetchReconciliation(
                '/api/admin/activation/reconcile',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ limit: 200, scanAll: true }),
                },
                'Verified signup sync timed out. Its final server result is unknown; refresh the preview before retrying.'
            );
            setPreview(result);
            router.refresh();
            await loadPreview();
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to sync verified auth signups');
        } finally {
            setRunning(false);
        }
    };

    if (loading && !preview) {
        return (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm" aria-live="polite">
                <div className="flex items-start gap-3">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium text-foreground">Checking auth reconciliation status</p>
                        <p className="mt-1 text-xs text-muted-foreground">Read-only scan for verified auth signups missing a UtilitySheet account.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !preview) {
        return (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm" role="alert">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                        <div>
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Auth reconciliation check failed</p>
                            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">{error}</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry check
                    </Button>
                </div>
            </div>
        );
    }

    if (!preview) return null;

    const staleBlockedCount = preview.skipped.filter((record) => isStaleBlockedSignup(record.signedUpAt)).length;
    const recentBlockedCount = Math.max(0, preview.skipped.length - staleBlockedCount);
    const visiblePendingCount = preview.eligibleCount + recentBlockedCount;
    const hasPending = visiblePendingCount > 0;

    return (
        <div className={hasPending
            ? 'rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm'
            : 'rounded-xl border border-border/70 bg-card p-4 shadow-sm'}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    {hasPending ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    ) : (
                        <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    )}
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                            {hasPending ? 'Auth signups need review' : 'Auth reconciliation is current'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {hasPending
                                ? `${preview.eligibleCount} verified ${pluralize(preview.eligibleCount, 'signup is', 'signups are')} ready to create a UtilitySheet account.`
                                : `No verified auth signups are waiting for a UtilitySheet account. ${preview.scanned} ${pluralize(preview.scanned, 'record was', 'records were')} checked.`}
                            {recentBlockedCount > 0
                                ? ` ${recentBlockedCount} recent ${pluralize(recentBlockedCount, 'record is', 'records are')} blocked by a missing or unverified email.`
                                : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {lastCheckedAt ? `Last checked ${lastCheckedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. ` : ''}
                            Sync creates missing UtilitySheet account records only; it does not modify Stack Auth identities.
                            {staleBlockedCount > 0 ? ` ${staleBlockedCount} older unverified ${pluralize(staleBlockedCount, 'signup is', 'signups are')} omitted from the action count.` : ''}
                            {preview.createdCount > 0 ? ` The previous sync created ${preview.createdCount} ${pluralize(preview.createdCount, 'account', 'accounts')}.` : ''}
                        </p>
                        {error ? <p className="text-xs text-red-600 dark:text-red-300" role="alert">{error}</p> : null}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()} disabled={loading || running}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh status
                    </Button>
                    {hasPending ? (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void runReconciliation()}
                            disabled={running || loading || preview.eligibleCount === 0}
                        >
                            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Sync verified signups
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
