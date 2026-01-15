'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stackClientApp } from '@/lib/stack/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getPostAuthRoute = async (): Promise<string | null> => {
        try {
            const response = await fetch('/api/account');
            if (response.status === 401) return null;
            if (!response.ok) return '/dashboard';

            const data = await response.json().catch(() => ({}));
            const account = data?.account || {};
            const hasCompletionFlag = Object.prototype.hasOwnProperty.call(account, 'onboarding_completed_at');

            if (hasCompletionFlag) {
                return account.onboarding_completed_at ? '/dashboard' : '/onboarding';
            }

            // Fallback for databases that haven't run the onboarding completion migration yet
            return account.active_organization_id ? '/dashboard' : '/onboarding';
        } catch (e) {
            console.error(e);
            return '/dashboard';
        }
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const destination = await getPostAuthRoute();
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

            const destination = (await getPostAuthRoute()) || '/dashboard';
            router.push(destination);
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
            setLoading(false);
        }
    };

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
                        <CardTitle className="text-xl sm:text-2xl text-center text-foreground">Welcome back</CardTitle>
                        <CardDescription className="text-center text-muted-foreground text-sm">
                            Sign in to your account to continue
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                            {error && (
                                <div className="p-2.5 sm:p-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    {error}
                                </div>
                            )}

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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-xs sm:text-sm text-slate-500 hover:text-slate-400 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20 h-10 sm:h-11 text-base"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3 sm:gap-4 px-4 sm:px-6 pb-4 sm:pb-6">
                            <Button
                                type="submit"
                                className="w-full h-10 sm:h-11 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/20 transition-all duration-200 text-sm sm:text-base active:scale-[0.98]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                            <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                Don&apos;t have an account?{' '}
                                <Link href="/auth/signup" className="text-slate-500 hover:text-slate-400 font-medium transition-colors">
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
