'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        // Demo mode - just redirect to dashboard
        if (!supabase) {
            router.push('/dashboard');
            router.refresh();
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push('/dashboard');
        router.refresh();
    };

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
                        <CardTitle className="text-2xl text-center text-white">Welcome back</CardTitle>
                        <CardDescription className="text-center text-zinc-400">
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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-zinc-300">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
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
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                            <p className="text-sm text-zinc-400 text-center">
                                Don&apos;t have an account?{' '}
                                <Link href="/auth/signup" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                                    Sign up
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>

                <p className="mt-8 text-center text-sm text-zinc-500">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="text-zinc-400 hover:text-white underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-zinc-400 hover:text-white underline">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
