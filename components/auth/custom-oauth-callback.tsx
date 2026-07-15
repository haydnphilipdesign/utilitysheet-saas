'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { stackClientApp } from '@/lib/stack/client';

export function CustomOAuthCallback() {
    const called = useRef(false);
    const [error, setError] = useState<unknown>(null);

    useEffect(() => {
        if (called.current) return;
        called.current = true;

        (async () => {
            try {
                const redirected = await stackClientApp.callOAuthCallback();
                if (!redirected) {
                    window.location.replace('/auth/login');
                }
            } catch (e) {
                console.error('OAuth callback failed', e);
                setError(e);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                {error ? (
                    <>
                        <p className="text-foreground font-medium">We couldn&apos;t finish signing you in.</p>
                        <p className="text-sm text-muted-foreground">
                            Please try again. If it keeps happening, email{' '}
                            <a className="underline" href="mailto:Haydn@multimedium.dev">
                                Haydn@multimedium.dev
                            </a>
                            .
                        </p>
                        <Link
                            href="/auth/login"
                            className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                        >
                            Back to sign in
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-muted-foreground text-sm">Signing you in…</p>
                        <Link href="/dashboard" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                            Taking too long? Go to your dashboard
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
