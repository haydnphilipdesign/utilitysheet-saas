'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type InviteStatus = 'loading' | 'success' | 'error';

export default function InvitePage() {
    const router = useRouter();
    const params = useParams<{ token: string }>();
    const token = params?.token;

    const [status, setStatus] = useState<InviteStatus>('loading');
    const [message, setMessage] = useState<string>('Accepting invite…');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!token) return;

            setStatus('loading');
            setMessage('Accepting invite…');

            try {
                const response = await fetch('/api/organization/invites/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                if (response.status === 401) {
                    const next = encodeURIComponent(`/invite/${token}`);
                    router.push(`/auth/login?next=${next}`);
                    return;
                }

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.message || data?.error || 'Failed to accept invite');
                }

                if (cancelled) return;
                setStatus('success');
                setMessage('Invite accepted! Redirecting to your dashboard…');

                setTimeout(() => {
                    router.push('/dashboard');
                    router.refresh();
                }, 800);
            } catch (error: unknown) {
                if (cancelled) return;
                setStatus('error');
                setMessage(error instanceof Error ? error.message : 'Failed to accept invite');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router, token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8">
            <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl text-foreground">Join your team</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {status === 'loading' ? 'One moment…' : status === 'success' ? 'Welcome aboard.' : 'Something went wrong.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                        <div className="mt-0.5">
                            {status === 'loading' ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : status === 'success' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            )}
                        </div>
                        <p className="text-sm text-foreground">{message}</p>
                    </div>

                    {status === 'error' && (
                        <Button className="w-full" onClick={() => router.push('/dashboard/settings?tab=billing')}>
                            Go to Settings
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

