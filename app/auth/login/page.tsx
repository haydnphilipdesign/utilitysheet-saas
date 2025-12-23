'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { stackClientApp } from '@/lib/stack/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await stackClientApp.signInWithOAuth('google');
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Try Stack Auth first (Neon's built-in auth)
            const result = await stackClientApp.signInWithCredential({
                email,
                password,
                noRedirect: true,
            });

            if (result.status === 'error') {
                throw new Error(result.error.message || 'Invalid email or password');
            }

            router.push('/dashboard');
            router.refresh();
            return;
        } catch (err: any) {
            // Check if Stack Auth is not configured (project ID missing)
            if (err.message?.includes('project') || err.message?.includes('NEXT_PUBLIC_STACK')) {
                // Fall back to Supabase or demo mode
                if (isSupabaseConfigured()) {
                    try {
                        const supabase = createClient();
                        if (supabase) {
                            const { error: supabaseError } = await supabase.auth.signInWithPassword({
                                email,
                                password,
                            });

                            if (supabaseError) {
                                throw new Error(supabaseError.message);
                            }

                            router.push('/dashboard');
                            router.refresh();
                            return;
                        }
                    } catch (supaErr: any) {
                        setError(supaErr.message || 'Failed to sign in');
                        setLoading(false);
                        return;
                    }
                }

                // Fall back to demo mode
                router.push('/dashboard');
                router.refresh();
                return;
            }

            setError(err.message || 'Failed to sign in');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-background p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20">
                        <Zap className="h-8 w-8 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-foreground">UtilitySheet</span>
                </div>

                <Card className="border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center text-foreground">Welcome back</CardTitle>
                        <CardDescription className="text-center text-muted-foreground">
                            Sign in to your account to continue
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full bg-background text-foreground hover:bg-muted border-border font-medium"
                                >
                                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                    </svg>
                                    Sign in with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-foreground">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="agent@realty.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-foreground">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus:border-slate-500 focus:ring-slate-500/20"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/20 transition-all duration-200"
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
                            <p className="text-sm text-muted-foreground text-center">
                                Don&apos;t have an account?{' '}
                                <Link href="/auth/signup" className="text-slate-500 hover:text-slate-400 font-medium transition-colors">
                                    Sign up
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-muted-foreground hover:text-foreground underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-muted-foreground hover:text-foreground underline">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
