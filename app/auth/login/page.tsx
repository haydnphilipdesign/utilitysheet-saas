'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { stackClientApp } from '@/lib/stack/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import {
    consumePendingSignupVerification,
    trackActivationResponse,
} from '@/lib/analytics/activation';
import { useAuthConfig } from '@/lib/stack/use-auth-config';
import { normalizePostAuthReturnTo, rememberPostAuthReturnTo } from '@/lib/auth/post-auth-return';

export default function LoginPage() {
    const router = useRouter();
    const authConfig = useAuthConfig();
    const googleEnabled = authConfig.oauthProviderIds.includes('google');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [safeNextPath, setSafeNextPath] = useState<string | null>(null);

    const getSafeNext = useCallback((): string | null => {
        if (typeof window === 'undefined') return null;
        const nextParam = new URLSearchParams(window.location.search).get('next');
        return normalizePostAuthReturnTo(nextParam);
    }, []);

    const getPostAuthRoute = useCallback(async (source: string): Promise<string | null> => {
        const safeNext = getSafeNext();
        try {
            const response = await fetch('/api/account');
            if (response.status === 401) return null;
            if (!response.ok) return safeNext || '/dashboard';

            const data = await response.json().catch(() => ({}));
            trackActivationResponse(data, source);
            if (consumePendingSignupVerification()) {
                trackEvent('signup_verified', { source });
            }
            return safeNext || '/dashboard';
        } catch (e) {
            console.error(e);
            return safeNext || '/dashboard';
        }
    }, [getSafeNext]);

    useEffect(() => {
        setSafeNextPath(getSafeNext());
    }, [getSafeNext]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const destination = await getPostAuthRoute('login_page_existing_session');
                if (!destination) return;
                if (cancelled) return;

                router.push(destination);
                router.refresh();
            } catch {
                // ignore
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [getPostAuthRoute, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await stackClientApp.signInWithCredential({
                email,
                password,
                noRedirect: true,
            });

            if (result.status === 'error') {
                throw new Error(result.error.message || 'Invalid email or password');
            }

            const destination = (await getPostAuthRoute('login_form_post_auth')) || '/dashboard';
            router.push(destination);
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            rememberPostAuthReturnTo(safeNextPath || getSafeNext());
            await stackClientApp.signInWithOAuth('google');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8 sm:p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20">
                        <Image src="/logo-sm.png" alt="UtilitySheet Logo" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">UtilitySheet</span>
                </div>

                <Card className="border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6">
                        <h1 className="text-xl sm:text-2xl font-medium text-center text-foreground">Welcome back</h1>
                        <CardDescription className="text-center text-muted-foreground text-sm">
                            Sign in to your account to continue
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin} data-testid="login-form">
                        <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                            {error && (
                                <div role="alert" className="p-2.5 sm:p-3 text-xs sm:text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                                    {error}
                                </div>
                            )}

                            {authConfig.loading && <p role="status" className="text-center text-sm text-muted-foreground">Loading sign-in options…</p>}
                            {authConfig.unavailable && <p role="alert" className="text-center text-sm text-destructive">Sign-in options are temporarily unavailable. Please refresh and try again.</p>}
                            {authConfig.credentialEnabled && (
                                <>
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            spellCheck={false}
                                            placeholder="agent@realty.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground h-10 sm:h-11 text-base"
                                        />
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground h-10 sm:h-11 text-base"
                                        />
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3 sm:gap-4 px-4 sm:px-6 pb-4 sm:pb-6">
                            {authConfig.credentialEnabled && (
                                <Button
                                    type="submit"
                                    data-testid="login-submit"
                                    className="w-full h-10 sm:h-11 transition-all duration-200 text-sm sm:text-base active:scale-[0.98]"
                                    disabled={loading || googleLoading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        'Sign In'
                                    )}
                                </Button>
                            )}

                            {googleEnabled && (
                                <>
                                    {authConfig.credentialEnabled && (
                                        <div className="relative w-full">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-border" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        type="button"
                                        data-testid="login-google"
                                        variant="outline"
                                        className="w-full h-10 sm:h-11 border-input bg-background/50 hover:bg-accent text-foreground transition-all duration-200 text-sm sm:text-base active:scale-[0.98]"
                                        onClick={handleGoogleSignIn}
                                        disabled={loading || googleLoading}
                                    >
                                        {googleLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                            </svg>
                                        )}
                                        Continue with Google
                                    </Button>
                                </>
                            )}

                            <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                Don&apos;t have an account?{' '}
                                <Link
                                    href={safeNextPath ? `/auth/signup?next=${encodeURIComponent(safeNextPath)}` : '/auth/signup'}
                                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                                >
                                    Sign up
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>

                <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground px-4">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-muted-foreground hover:text-foreground underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-muted-foreground hover:text-foreground underline">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
