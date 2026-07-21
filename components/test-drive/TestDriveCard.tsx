'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Beaker, Check, CheckCircle2, Copy, Loader2, MailWarning, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { trackEvent } from '@/lib/analytics/events';
import type { TestDriveSource, TestDriveState } from '@/lib/test-drive/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type TestDriveCardProps = {
    source: TestDriveSource;
    reusableSellerLink?: string | null;
};

async function fetchState(method: 'GET' | 'POST' = 'GET'): Promise<TestDriveState> {
    const response = await fetch('/api/test-drive', { method });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || 'Unable to load your test UtilitySheet.');
    }
    return body as TestDriveState;
}

export function TestDriveCard({ source, reusableSellerLink }: TestDriveCardProps) {
    const [state, setState] = useState<TestDriveState | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const viewedStateRef = useRef<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setState(await fetchState());
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load your test UtilitySheet.');
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

    useEffect(() => {
        if (state?.status !== 'ready') return;
        const refreshAfterSellerFlow = () => void load();
        window.addEventListener('focus', refreshAfterSellerFlow);
        return () => window.removeEventListener('focus', refreshAfterSellerFlow);
    }, [load, state?.status]);

    const start = async () => {
        setCreating(true);
        setError(null);
        trackEvent('test_drive_started', { source });
        try {
            setState(await fetchState('POST'));
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'Unable to start your test UtilitySheet.');
        } finally {
            setCreating(false);
        }
    };

    const openSellerFlow = (sellerUrl: string, action: 'open' | 'resume') => {
        trackEvent('test_drive_opened', { source, action });
        window.open(sellerUrl, '_blank', 'noopener,noreferrer');
    };

    const copyReusableSellerLink = async () => {
        if (!reusableSellerLink) return;
        try {
            await navigator.clipboard.writeText(reusableSellerLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            trackEvent('test_drive_seller_link_copied', { source });
            toast.success('Reusable seller link copied');
        } catch {
            toast.error('Failed to copy seller link');
        }
    };

    if (loading && !state) {
        return (
            <Card aria-busy="true" className="border-border/70 bg-card/70">
                <CardContent className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your test UtilitySheet…
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-border/70 bg-card/70">
                <CardHeader>
                    <CardTitle className="text-base">Test UtilitySheet unavailable</CardTitle>
                    <CardDescription role="alert">{error}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button type="button" variant="outline" onClick={load} disabled={loading} className="min-h-11">
                        {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Try again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!state) return null;

    return (
        <Card className="overflow-hidden border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-card to-card dark:border-blue-900/70 dark:from-blue-950/25">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100/70 px-2.5 py-1 text-xs font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100">
                            <Beaker className="h-3.5 w-3.5" />
                            Private product test
                        </div>
                        <CardTitle>
                            <h2 className="text-lg font-semibold text-foreground">
                                {state.status === 'eligible' && 'See the finished result before a real transaction'}
                                {state.status === 'ready' && 'Your test UtilitySheet is ready'}
                                {state.status === 'completed' && 'Your test UtilitySheet is complete'}
                                {state.status === 'ineligible' && 'You have already completed the real workflow'}
                            </h2>
                        </CardTitle>
                        <CardDescription className="mt-1 max-w-3xl">
                            {state.status === 'eligible' && 'Send a fictional request to yourself, complete the seller flow, and receive your branded email and production PDF.'}
                            {state.status === 'ready' && 'Open or resume the fictional seller flow. Your answers stay separate from real requests and reporting.'}
                            {state.status === 'completed' && 'Review the branded result, then put your reusable seller link where you manage every new listing.'}
                            {state.status === 'ineligible' && 'A real seller has already submitted a UtilitySheet for your account, so the test drive is no longer offered.'}
                        </CardDescription>
                    </div>
                    {state.status === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    ) : null}
                </div>
            </CardHeader>

            <CardContent className="space-y-4" aria-live="polite">
                {state.status === 'eligible' ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">Uses fictional property and seller information. It does not consume a request.</p>
                        <Button type="button" onClick={start} disabled={creating} className="min-h-11 w-full sm:w-auto">
                            {creating ? <Loader2 className="animate-spin" /> : <Beaker />}
                            {creating ? 'Creating your test…' : 'Send yourself a test UtilitySheet'}
                        </Button>
                    </div>
                ) : null}

                {state.status === 'ready' ? (
                    <div className="space-y-3">
                        {state.invitationDelivery === 'failed' ? (
                            <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                                <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                                The email could not be delivered, but your private test is ready to open here.
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">You can close the seller tab and resume from this card anytime.</p>
                            <Button type="button" onClick={() => openSellerFlow(state.sellerUrl, 'resume')} className="min-h-11 w-full sm:w-auto">
                                Open or resume test
                                <ArrowUpRight />
                            </Button>
                        </div>
                    </div>
                ) : null}

                {state.status === 'completed' ? (
                    <div className="space-y-4">
                        {state.delivery === 'failed' ? (
                            <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                                <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                                Email or PDF delivery did not finish, but your submission was saved. Review or download the completed result here.
                            </div>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-2 lg:flex">
                            <a
                                href={state.reviewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ className: 'min-h-11' })}
                            >
                                Review completed test
                                <ArrowUpRight />
                            </a>
                            <a
                                href={state.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ variant: 'outline', className: 'min-h-11' })}
                            >
                                Download production PDF
                                <ArrowUpRight />
                            </a>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-background/65 p-3 sm:p-4">
                            <p className="text-sm font-medium text-foreground">Next: place your reusable seller link</p>
                            <p className="mt-1 text-xs text-muted-foreground">Add it to your listing email, checklist, or transaction template so it is ready for the next real file.</p>
                            {reusableSellerLink ? (
                                <Button type="button" variant="outline" onClick={copyReusableSellerLink} className="mt-3 min-h-11 w-full sm:w-auto">
                                    {copied ? <Check /> : <Copy />}
                                    {copied ? 'Seller link copied' : 'Copy reusable seller link'}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
