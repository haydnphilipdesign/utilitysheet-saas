'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Download, FileText, Loader2, MailWarning, RotateCcw } from 'lucide-react';

import { trackEvent } from '@/lib/analytics/events';
import type { TestDriveState } from '@/lib/test-drive/types';
import { wizardFocusRing } from '../wizard-ui';

type LoadState =
    | { kind: 'loading' }
    | { kind: 'ready'; state: TestDriveState }
    | { kind: 'signed_out' }
    | { kind: 'error' };

const secondaryAction = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted ${wizardFocusRing}`;
const primaryAction = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--brand-accent-border)] bg-[color:var(--brand-accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--brand-accent-strong)] ${wizardFocusRing}`;

async function loadTestDriveState(): Promise<LoadState> {
    try {
        const response = await fetch('/api/test-drive');
        if (response.status === 401) return { kind: 'signed_out' };
        if (!response.ok) return { kind: 'error' };
        return { kind: 'ready', state: (await response.json()) as TestDriveState };
    } catch {
        return { kind: 'error' };
    }
}

/**
 * Completion screen for the authenticated seller test. The completed sheet and
 * PDF paths come from GET /api/test-drive (session-scoped), never from the
 * seller token, and delivery is only described when its outcome is recorded.
 */
export function TestDriveSuccess() {
    const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
    const [attempt, setAttempt] = useState(0);

    // The review step is long; start the completion screen at the top.
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadTestDriveState().then((next) => {
            if (!cancelled) setLoad(next);
        });
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    const retry = () => {
        setLoad({ kind: 'loading' });
        setAttempt((value) => value + 1);
    };

    const completed = load.kind === 'ready' && load.state.status === 'completed' ? load.state : null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-start space-y-6 px-2 py-6 text-center sm:py-10"
            data-testid="test-drive-success"
        >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 sm:h-24 sm:w-24">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 sm:h-12 sm:w-12" aria-hidden="true" />
            </div>

            <div className="w-full max-w-md space-y-5">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Your test is complete</h2>
                    <p className="text-sm text-muted-foreground sm:text-base">
                        That is everything your seller does. Their answers become a finished utility sheet you can review, download, and share with the buyer.
                    </p>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4 text-left" aria-live="polite">
                    <p className="text-sm font-semibold text-foreground">See the sheet your test created</p>

                    {load.kind === 'loading' ? (
                        <p aria-busy="true" className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Getting your test sheet…
                        </p>
                    ) : null}

                    {completed ? (
                        <>
                            {completed.delivery === 'sent' ? (
                                <p className="text-xs text-muted-foreground">We also emailed it, with the PDF attached, to your account email.</p>
                            ) : null}
                            {completed.delivery === 'failed' ? (
                                <p role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                                    <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    We could not email your copy, but your test sheet is saved. Open it below.
                                </p>
                            ) : null}
                            <div className="grid gap-2 sm:grid-cols-2">
                                <a
                                    href={completed.reviewUrl}
                                    onClick={() => trackEvent('test_drive_output_opened', { source: 'seller_success', output: 'web' })}
                                    className={secondaryAction}
                                >
                                    <FileText className="h-4 w-4" aria-hidden="true" />
                                    Open test sheet
                                </a>
                                <a
                                    href={completed.pdfUrl}
                                    onClick={() => trackEvent('test_drive_output_opened', { source: 'seller_success', output: 'pdf' })}
                                    className={secondaryAction}
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    Download PDF
                                </a>
                            </div>
                        </>
                    ) : null}

                    {load.kind === 'signed_out' ? (
                        <p className="text-xs text-muted-foreground">
                            This browser is not signed in to UtilitySheet. Sign in from the dashboard to open your test sheet.
                        </p>
                    ) : null}

                    {load.kind === 'ready' && !completed ? (
                        <p className="text-xs text-muted-foreground">
                            Your test sheet is available from the dashboard of the account that started this test.
                        </p>
                    ) : null}

                    {load.kind === 'error' ? (
                        <div className="space-y-2">
                            <p role="alert" className="text-xs text-muted-foreground">
                                We could not load your test sheet links. Your answers were saved.
                            </p>
                            <button type="button" onClick={retry} className={secondaryAction}>
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                Try again
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4 text-left">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Next: use it on a real transaction</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Copy your reusable seller link from the dashboard and add it to your listing email, text template, or checklist.
                        </p>
                    </div>
                    <Link
                        href="/dashboard"
                        onClick={() => trackEvent('test_drive_dashboard_returned', { source: 'seller_success' })}
                        className={primaryAction}
                    >
                        Back to dashboard
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
