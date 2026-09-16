'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SUPPORT_EMAIL = 'haydn@multimedium.dev';

type ViewState =
    | { kind: 'loading' }
    | { kind: 'closed' }
    | { kind: 'closing'; errorCode: string | null }
    | { kind: 'active' }
    | { kind: 'unknown' };

function describeStall(errorCode: string | null) {
    if (errorCode === 'auth_delete_failed') {
        return 'Your data has been removed, but we couldn’t finish deleting your sign-in.';
    }
    if (errorCode) {
        return 'Your data has been removed, but one final step didn’t finish.';
    }
    return 'We’re finishing the last steps.';
}

export default function AccountClosedPage() {
    const [view, setView] = useState<ViewState>({ kind: 'loading' });
    const [retrying, setRetrying] = useState(false);
    const [retryMessage, setRetryMessage] = useState<string | null>(null);

    const applyStatus = useCallback((data: Record<string, unknown>) => {
        if (data.status === 'closing') {
            setView({ kind: 'closing', errorCode: typeof data.errorCode === 'string' ? data.errorCode : null });
        } else if (data.status === 'active') {
            setView({ kind: 'active' });
        } else {
            setView({ kind: 'closed' });
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch('/api/account/closure', { cache: 'no-store' });
                const data = await response.json().catch(() => ({})) as Record<string, unknown>;
                if (cancelled) return;
                // An active account that hasn't confirmed recently still gets a 403.
                if (response.status === 403 && data.code === 'RECENT_AUTH_REQUIRED') {
                    setView({ kind: 'active' });
                    return;
                }
                if (response.status === 401) {
                    // Stack removes the session when the sign-in is deleted.
                    setView({ kind: 'closed' });
                    return;
                }
                if (!response.ok) {
                    setView({ kind: 'unknown' });
                    return;
                }
                applyStatus(data);
            } catch {
                if (!cancelled) setView({ kind: 'unknown' });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [applyStatus]);

    const retry = async () => {
        setRetrying(true);
        setRetryMessage(null);
        try {
            const response = await fetch('/api/account/closure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'retry' }),
            });
            const data = await response.json().catch(() => ({})) as Record<string, unknown>;
            if (response.status === 401) {
                setView({ kind: 'closed' });
                return;
            }
            applyStatus(data);
            if (data.status === 'closing') {
                setRetryMessage('That didn’t finish either. We’ll keep trying automatically, or you can email us.');
            }
        } catch {
            setRetryMessage('We couldn’t reach UtilitySheet. Check your connection and try again.');
        } finally {
            setRetrying(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8">
            <Card className="w-full max-w-md border-border bg-card/80 shadow-xl">
                {view.kind === 'loading' && (
                    <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Checking your account…
                    </CardContent>
                )}

                {view.kind === 'closed' && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h1>Your account is closed</h1>
                            </CardTitle>
                            <CardDescription>
                                Your sign-in, personal requests, seller links, and Branding Profiles have been deleted, and any subscription was canceled.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground">
                            <p>
                                Requests you shared in a team workspace now belong to the admin you chose. We keep billing and security records without your name or contact details.
                            </p>
                            <p>
                                Didn’t close your account yourself? Email{' '}
                                <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                            </p>
                            <Link href="/" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                                Go to the UtilitySheet homepage
                            </Link>
                        </CardContent>
                    </>
                )}

                {view.kind === 'closing' && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                                <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h1>We’re finishing closing your account</h1>
                            </CardTitle>
                            <CardDescription>{describeStall(view.errorCode)}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground">
                            <p>
                                You can’t use this account anymore. We retry automatically each day. If it still isn’t finished tomorrow, email{' '}
                                <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                            </p>
                            {retryMessage && <p role="status">{retryMessage}</p>}
                            <Button className="w-full" onClick={() => void retry()} disabled={retrying}>
                                {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                {retrying ? 'Trying again…' : 'Try again now'}
                            </Button>
                        </CardContent>
                    </>
                )}

                {view.kind === 'active' && (
                    <>
                        <CardHeader>
                            <CardTitle className="text-xl text-foreground">
                                <h1>Your account is still open</h1>
                            </CardTitle>
                            <CardDescription>
                                Nothing has been closed. You can close your account from Account settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/settings?tab=account" className={buttonVariants({ className: 'w-full' })}>
                                Open Account settings
                            </Link>
                        </CardContent>
                    </>
                )}

                {view.kind === 'unknown' && (
                    <>
                        <CardHeader>
                            <CardTitle className="text-xl text-foreground">
                                <h1>We couldn’t check your account</h1>
                            </CardTitle>
                            <CardDescription>
                                Your connection or UtilitySheet may be temporarily unavailable. We won’t say closure is complete until we can verify it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button className="w-full" onClick={() => window.location.reload()}>
                                Check again
                            </Button>
                            <Link href="/" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                                Go to the UtilitySheet homepage
                            </Link>
                        </CardContent>
                    </>
                )}
            </Card>
        </main>
    );
}
