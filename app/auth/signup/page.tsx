'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stackClientApp } from '@/lib/stack/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';
import {
    consumePendingSignupVerification,
    rememberPendingSignupVerification,
    trackActivationResponse,
} from '@/lib/analytics/activation';

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const getSafeNext = (): string | null => {
        if (typeof window === 'undefined') return null;
        const nextParam = new URLSearchParams(window.location.search).get('next');
        return nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
    };

    const getPostAuthRoute = async (source: string): Promise<string | null> => {
        const safeNext = getSafeNext();
        if (safeNext) return safeNext;
        try {
            const response = await fetch('/api/account');
            if (response.status === 401) return null;
            if (!response.ok) return '/dashboard';

            const data = await response.json().catch(() => ({}));
            trackActivationResponse(data, source);
            if (consumePendingSignupVerification()) {
                trackEvent('signup_verified', { source });
            }
            return '/dashboard';
        } catch (e) {
            console.error(e);
            return '/dashboard';
        }
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const destination = await getPostAuthRoute('signup_page_existing_session');
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
    }, [router]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        trackEvent('signup_started', { method: 'email', source: 'signup_form' });

        try {
            const result = await stackClientApp.signUpWithCredential({
                email,
                password,
                noRedirect: true,
            });

            if (result.status === 'error') {
                throw new Error(result.error.message || 'Failed to create account');
            }

            trackEvent('signup_completed', { method: 'email', source: 'signup_form' });

            // Automatically sign in after successful signup
            const signInResult = await stackClientApp.signInWithCredential({
                email,
                password,
                noRedirect: true,
            });

            if (signInResult.status === 'error') {
                // Signup succeeded but sign-in failed - show success and let them sign in manually
                rememberPendingSignupVerification();
                trackEvent('signup_verification_required', { method: 'email', source: 'signup_form' });
                setSuccess(true);
                setLoading(false);
                return;
            }

            // Update the user's display name with the full name they provided
            const currentUser = await stackClientApp.getUser();
            if (currentUser && fullName) {
                await currentUser.update({ displayName: fullName });
            }

            const destination = (await getPostAuthRoute('signup_form_post_auth')) || '/dashboard';
            router.push(destination);
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        trackEvent('signup_started', { method: 'google', source: 'signup_google' });
        try {
            await stackClientApp.signInWithOAuth('google', {
                returnTo: getSafeNext() || '/dashboard',
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
            setGoogleLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8 sm:p-4">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-slate-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/10 rounded-full blur-3xl" />
                </div>

                <Card className="relative z-10 w-full max-w-md border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-3 sm:space-y-4 text-center pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
                        <div className="mx-auto p-2.5 sm:p-3 rounded-full bg-emerald-500/10">
                            <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-500" />
                        </div>
                        <CardTitle className="text-xl sm:text-2xl text-foreground">Check your email</CardTitle>
                        <CardDescription className="text-muted-foreground text-sm">
                            We&apos;ve sent a confirmation link to <span className="text-foreground font-medium break-all">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-3 sm:pt-4 px-4 sm:px-6">
                        <p className="text-xs sm:text-sm text-muted-foreground text-center">
                            Click the link in your email to verify your account and get started with UtilitySheet.
                        </p>
                    </CardContent>
                    <CardFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
                        <Button
                            variant="outline"
                            className="w-full h-10 sm:h-11 border-input text-muted-foreground hover:bg-accent hover:text-foreground text-sm sm:text-base active:scale-[0.98]"
                            onClick={() => router.push('/auth/login')}
                        >
                            Back to Sign In
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8 sm:p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-slate-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20">
                        <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">UtilitySheet</span>
                </div>

                <Card className="border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6">
                        <CardTitle className="text-xl sm:text-2xl text-center text-foreground">Create an account</CardTitle>
                        <CardDescription className="text-center text-muted-foreground text-sm">
                            Start creating utility info sheets in minutes
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSignup} data-testid="signup-form">
                        <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                            {error && (
                                <div className="p-2.5 sm:p-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5 sm:space-y-2">
                                <Label htmlFor="fullName" className="text-foreground text-sm">Full Name</Label>
                                <Input
                                    id="fullName"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Jane Smith"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20 h-10 sm:h-11 text-base"
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder="agent@realty.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20 h-10 sm:h-11 text-base"
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Min. 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20 h-10 sm:h-11 text-base"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3 sm:gap-4 px-4 sm:px-6 pb-4 sm:pb-6">
                            <Button
                                type="submit"
                                data-testid="signup-submit"
                                className="w-full h-10 sm:h-11 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/20 transition-all duration-200 text-sm sm:text-base active:scale-[0.98]"
                                disabled={loading || googleLoading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>

                            {/* Divider */}
                            <div className="relative w-full">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                                </div>
                            </div>

                            {/* Google OAuth Button */}
                            <Button
                                type="button"
                                data-testid="signup-google"
                                variant="outline"
                                className="w-full h-10 sm:h-11 border-input bg-background/50 hover:bg-accent text-foreground transition-all duration-200 text-sm sm:text-base active:scale-[0.98]"
                                onClick={handleGoogleSignIn}
                                disabled={loading || googleLoading}
                            >
                                {googleLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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

                            <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-slate-500 hover:text-slate-400 font-medium transition-colors">
                                    Sign in
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>

                {/* Features */}
                <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-4 text-center px-2">
                    <div className="space-y-1 sm:space-y-2">
                        <div className="text-xl sm:text-2xl">⚡</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">2-min seller forms</p>
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <div className="text-xl sm:text-2xl">📄</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Branded packets</p>
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <div className="text-xl sm:text-2xl">🔄</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Auto contact lookup</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
