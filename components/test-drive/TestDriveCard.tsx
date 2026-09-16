'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    CheckCircle2,
    Copy,
    Download,
    FileText,
    Loader2,
    MailWarning,
    RotateCcw,
    Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';

import { trackEvent } from '@/lib/analytics/events';
import type { TestDriveSource, TestDriveState } from '@/lib/test-drive/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SampleSheetDialog } from '@/components/test-drive/SampleSheetDialog';
import { cn } from '@/lib/utils';

type TestDriveCardProps = {
    source: TestDriveSource;
    reusableSellerLink?: string | null;
};

async function fetchState(method: 'GET' | 'POST' = 'GET'): Promise<TestDriveState> {
    const response = await fetch('/api/test-drive', { method });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || 'We could not load your seller test.');
    }
    return body as TestDriveState;
}

function PanelIcon({ children }: { children: ReactNode }) {
    return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
            {children}
        </span>
    );
}

function InlineNotice({ children }: { children: ReactNode }) {
    return (
        <p role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

const panelClassName = 'flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-4';
const newTabHint = <span className="sr-only"> (opens in a new tab)</span>;

// buttonVariants alone keeps the base border-transparent next to the outline
// border; cn() resolves the conflict the same way <Button> does.
function outlineLinkClass(className?: string) {
    return cn(buttonVariants({ variant: 'outline', className }));
}

/**
 * Optional first-use guide shared by onboarding and the dashboard: a sample
 * finished sheet (no request created) and the private seller test backed by
 * /api/test-drive. The reusable seller link stays the page's primary action,
 * so every action here is secondary.
 */
export function TestDriveCard({ source, reusableSellerLink }: TestDriveCardProps) {
    const headingId = useId();
    const [state, setState] = useState<TestDriveState | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [sampleOpen, setSampleOpen] = useState(false);
    const viewedStateRef = useRef<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setState(await fetchState());
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'We could not load your seller test.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!state || viewedStateRef.current === state.status) return;
        viewedStateRef.current = state.status;
        trackEvent('test_drive_offer_viewed', {
            source,
            state: state.status,
        });
    }, [source, state]);

    // A test opened from the emailed link (for example on a phone) can finish
    // elsewhere; refresh when the user comes back to this tab.
    useEffect(() => {
        if (state?.status !== 'ready') return;
        const refresh = () => void load();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [load, state?.status]);

    const start = async () => {
        setStarting(true);
        setError(null);
        trackEvent('test_drive_started', { source });
        try {
            const next = await fetchState('POST');
            if (next.status === 'ready') {
                trackEvent('test_drive_opened', { source, action: 'open' });
                // Same-tab navigation: one click, no popup blocking, and the
                // seller flow links back to the dashboard.
                window.location.assign(next.sellerUrl);
                return;
            }
            setState(next);
            setStarting(false);
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'We could not start your seller test.');
            setStarting(false);
        }
    };

    const copyReusableSellerLink = async () => {
        if (!reusableSellerLink) return;
        try {
            await navigator.clipboard.writeText(reusableSellerLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            trackEvent('test_drive_seller_link_copied', { source });
            toast.success('Seller link copied');
        } catch {
            toast.error('Failed to copy seller link');
        }
    };

    // The dashboard is a working surface: only show the guide once we know it
    // is relevant, and never to accounts that already have real submissions.
    if (source === 'dashboard' && !error && (!state || state.status === 'ineligible')) {
        return null;
    }

    const renderTestPanel = () => {
        if (error) {
            return (
                <>
                    <div className="flex items-start gap-3">
                        <PanelIcon><Smartphone className="h-4 w-4" /></PanelIcon>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">Try the seller experience</h3>
                            <p role="alert" className="mt-1 text-xs text-muted-foreground">{error}</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" onClick={load} disabled={loading} className="mt-auto w-full sm:h-9 sm:w-fit">
                        {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Try again
                    </Button>
                </>
            );
        }

        if (!state) {
            return (
                <div aria-busy="true" className="flex min-h-24 items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Checking your seller test…
                </div>
            );
        }

        if (state.status === 'eligible') {
            return (
                <>
                    <div className="flex items-start gap-3">
                        <PanelIcon><Smartphone className="h-4 w-4" /></PanelIcon>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">Try the seller experience</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Answer your own request as if you were the seller, using made-up details. It takes about 2 minutes and does not count toward your plan.
                            </p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" onClick={start} disabled={starting} className="mt-auto w-full sm:h-9 sm:w-fit">
                        {starting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        {starting ? 'Starting your test…' : 'Start seller test'}
                    </Button>
                </>
            );
        }

        if (state.status === 'ready') {
            return (
                <>
                    <div className="flex items-start gap-3">
                        <PanelIcon><Smartphone className="h-4 w-4" /></PanelIcon>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">Seller test in progress</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {state.invitationDelivery === 'sent'
                                    ? 'Pick up where you left off, or open the test link we emailed you to try it on your phone. Answers are saved in the browser where you enter them.'
                                    : 'Pick up where you left off. Answers are saved in the browser where you enter them.'}
                            </p>
                        </div>
                    </div>
                    {state.invitationDelivery === 'failed' ? (
                        <InlineNotice>We could not email you the test link. You can still open it here.</InlineNotice>
                    ) : null}
                    <Link
                        href={state.sellerUrl}
                        onClick={() => trackEvent('test_drive_opened', { source, action: 'resume' })}
                        className={outlineLinkClass('mt-auto w-full sm:h-9 sm:w-fit')}
                    >
                        <ArrowRight />
                        Resume seller test
                    </Link>
                </>
            );
        }

        if (state.status === 'completed') {
            return (
                <>
                    <div className="flex items-start gap-3">
                        <PanelIcon><Smartphone className="h-4 w-4" /></PanelIcon>
                        <div className="min-w-0">
                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                Seller test complete
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {state.delivery === 'sent'
                                    ? 'Here is the sheet your test created. We also emailed it with the PDF to your account email.'
                                    : 'Review the sheet your test created. Real seller submissions arrive the same way.'}
                            </p>
                        </div>
                    </div>
                    {state.delivery === 'failed' ? (
                        <InlineNotice>We could not email your copy, but your test sheet is saved. Open it here.</InlineNotice>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <a
                            href={state.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackEvent('test_drive_output_opened', { source, output: 'web' })}
                            className={outlineLinkClass('sm:h-9')}
                        >
                            <ArrowUpRight />
                            Open test sheet
                            {newTabHint}
                        </a>
                        <a
                            href={state.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackEvent('test_drive_output_opened', { source, output: 'pdf' })}
                            className={outlineLinkClass('sm:h-9')}
                        >
                            <Download />
                            Download PDF
                            {newTabHint}
                        </a>
                    </div>
                </>
            );
        }

        return (
            <>
                <div className="flex items-start gap-3">
                    <PanelIcon><Smartphone className="h-4 w-4" /></PanelIcon>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">You are already using UtilitySheet</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            A seller has already submitted a real sheet, so there is no need for a test. Your finished sheets are in Requests.
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/requests?status=submitted"
                    className={outlineLinkClass('mt-auto w-full sm:h-9 sm:w-fit')}
                >
                    View submitted sheets
                </Link>
            </>
        );
    };

    return (
        <Card aria-labelledby={headingId} className="gap-0 border-border/70 bg-card/70 py-0 backdrop-blur-sm">
            <CardHeader className="border-b border-border/60 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Optional</p>
                <CardTitle>
                    <h2 id={headingId} className="text-lg font-semibold text-foreground">See how UtilitySheet works</h2>
                </CardTitle>
                <CardDescription className="max-w-3xl">
                    Your seller answers a short mobile form. You get a finished utility sheet to review, download as a PDF, and share with the buyer. Neither step below is required before you share your link.
                </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 py-4 md:grid-cols-2">
                <section className={panelClassName} aria-label="Sample sheet">
                    <div className="flex items-start gap-3">
                        <PanelIcon><FileText className="h-4 w-4" /></PanelIcon>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">See a finished sheet</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Look at a sample with fictional details. There is nothing to fill in.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSampleOpen(true)}
                        className="mt-auto w-full sm:h-9 sm:w-fit"
                    >
                        <FileText />
                        View sample sheet
                    </Button>
                </section>

                {/* No aria-live on this wrapper: Base UI keeps live regions (and
                    everything inside them) interactive behind modal dialogs, which
                    would expose these buttons behind the sample dialog. Errors and
                    notices below announce themselves via role="alert"/"status". */}
                <section className={panelClassName} aria-label="Seller test">
                    {renderTestPanel()}
                </section>

                {state?.status === 'completed' ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
                        <div>
                            <p className="text-sm font-semibold text-foreground">Next: use it on a real transaction</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Paste your reusable seller link into your listing email, text template, or transaction checklist.
                            </p>
                        </div>
                        {reusableSellerLink ? (
                            <Button type="button" variant="outline" onClick={copyReusableSellerLink} className="w-full shrink-0 sm:h-9 sm:w-auto">
                                {copied ? <Check /> : <Copy />}
                                {copied ? 'Seller link copied' : 'Copy seller link'}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>

            <SampleSheetDialog open={sampleOpen} onOpenChange={setSampleOpen} source={source} />
        </Card>
    );
}
