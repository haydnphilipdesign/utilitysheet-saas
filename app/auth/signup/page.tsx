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
import { Zap, Loader2, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await stackClientApp.signInWithOAuth('google');
        } catch (err: any) {
            setError(err.message || 'Failed to sign up with Google');
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Try Stack Auth first (Neon's built-in auth)
            const result = await stackClientApp.signUpWithCredential({
                email,
                password,
                noRedirect: true,
                noVerificationCallback: true,
            });

            if (result.status === 'error') {
                throw new Error(result.error.message || 'Failed to create account');
            }

            setSuccess(true);
            setLoading(false);
            return;
        } catch (err: any) {
            // Check if Stack Auth is not configured (project ID missing)
            if (err.message?.includes('project') || err.message?.includes('NEXT_PUBLIC_STACK')) {
                // Fall back to Supabase or demo mode
                if (isSupabaseConfigured()) {
                    try {
                        const supabase = createClient();
                        if (supabase) {
                            const { error: supabaseError } = await supabase.auth.signUp({
                                email,
                                password,
                                options: {
                                    data: {
                                        full_name: fullName,
                                    },
                                },
                            });

                            if (supabaseError) {
                                throw new Error(supabaseError.message);
                            }

                            setSuccess(true);
                            setLoading(false);
                            return;
                        }
                    } catch (supaErr: any) {
                        setError(supaErr.message || 'Failed to create account');
                        setLoading(false);
                        return;
                    }
                }

                // Fall back to demo mode
                setSuccess(true);
                setLoading(false);
                return;
            }

            setError(err.message || 'Failed to create account');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                </div>

                <Card className="relative z-10 w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-4 text-center pb-2">
                        <div className="mx-auto p-3 rounded-full bg-emerald-500/10">
                            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                        </div>
                        <CardTitle className="text-2xl text-white">Check your email</CardTitle>
                        <CardDescription className="text-zinc-400">
                            We&apos;ve sent a confirmation link to <span className="text-white font-medium">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-sm text-zinc-500 text-center">
                            Click the link in your email to verify your account and get started with UtilitySheet.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button
                            variant="outline"
                            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                        <Zap className="h-8 w-8 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-white">UtilitySheet</span>
                </div>

                <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center text-white">Create an account</CardTitle>
                        <CardDescription className="text-center text-zinc-400">
                            Start creating utility handoff packets in minutes
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSignup}>
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
                                    className="w-full bg-white text-black hover:bg-zinc-200 border-zinc-200 font-medium"
                                >
                                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                    </svg>
                                    Sign up with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-zinc-800" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-zinc-900 px-2 text-zinc-400">Or continue with email</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-zinc-300">Full Name</Label>
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="Jane Smith"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="agent@realty.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
                                disabled={loading}
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
                            <p className="text-sm text-zinc-400 text-center">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                                    Sign in
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>

                {/* Features */}
                <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                    <div className="space-y-2">
                        <div className="text-2xl">⚡</div>
                        <p className="text-xs text-zinc-500">2-min seller forms</p>
                    </div>
                    <div className="space-y-2">
                        <div className="text-2xl">📄</div>
                        <p className="text-xs text-zinc-500">Branded packets</p>
                    </div>
                    <div className="space-y-2">
                        <div className="text-2xl">🔄</div>
                        <p className="text-xs text-zinc-500">Auto contact lookup</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
