'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
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

const STALE_BLOCKED_SIGNUP_DAYS = 30;

function pluralize(count: number, singular: string, plural: string) {
    return count === 1 ? singular : plural;
}

function isStaleBlockedSignup(signedUpAt: string) {
    const signedUpAtMs = Date.parse(signedUpAt);
    if (!Number.isFinite(signedUpAtMs)) return false;

    const ageMs = Date.now() - signedUpAtMs;
    return ageMs >= STALE_BLOCKED_SIGNUP_DAYS * 24 * 60 * 60 * 1000;
}

export function AuthReconciliationCard() {
    const router = useRouter();
    const [preview, setPreview] = useState<ReconcilePreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPreview = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/activation/reconcile?limit=200&scanAll=true', {
                method: 'GET',
                cache: 'no-store',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to inspect pending auth signups');
            }

            setPreview(data as ReconcilePreview);
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to inspect pending auth signups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPreview();
    }, []);

    const runReconciliation = async () => {
        setRunning(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/activation/reconcile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 200, scanAll: true }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to sync verified auth signups');
            }

            setPreview(data as ReconcilePreview);
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
            <div className="rounded-xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for auth signups that have not been activated in UtilitySheet yet...
                </div>
            </div>
        );
    }

    if (error && !preview) {
        return (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (!preview || preview.missingCount === 0) {
        return null;
    }

    const staleBlockedCount = preview.skipped.filter((record) => isStaleBlockedSignup(record.signedUpAt)).length;
    const recentBlockedCount = Math.max(0, preview.skipped.length - staleBlockedCount);
    const visiblePendingCount = preview.eligibleCount + recentBlockedCount;
    const createdCount = preview.createdCount;

    if (visiblePendingCount === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                        <AlertCircle className="h-4 w-4" />
                        Auth signups are waiting to be activated
                    </div>
                    <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                        {preview.eligibleCount > 0
                            ? `${preview.eligibleCount} verified ${pluralize(preview.eligibleCount, 'signup is', 'signups are')} ready to sync into your admin users table.`
                            : 'No verified signups are ready to sync right now.'}
                        {recentBlockedCount > 0
                            ? ` ${recentBlockedCount} recent ${pluralize(recentBlockedCount, 'record is', 'records are')} still blocked by missing or unverified email.`
                            : ''}
                    </p>
                    <p className="text-xs text-amber-900/70 dark:text-amber-100/70">
                        Scanned {preview.scanned} auth {pluralize(preview.scanned, 'user', 'users')} and found {visiblePendingCount} pending app {pluralize(visiblePendingCount, 'activation', 'activations')}.
                        {staleBlockedCount > 0 ? ` ${staleBlockedCount} older unverified ${pluralize(staleBlockedCount, 'signup is', 'signups are')} hidden from this alert.` : ''}
                        {createdCount > 0 ? ` The last sync created ${createdCount} ${pluralize(createdCount, 'account', 'accounts')}.` : ''}
                    </p>
                    {error ? (
                        <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()} disabled={loading || running}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void runReconciliation()}
                        disabled={running || preview.eligibleCount === 0}
                    >
                        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Sync Verified Signups
                    </Button>
                </div>
            </div>
        </div>
    );
}
