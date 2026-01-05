'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export function MarketingHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const user = useUser();

    return (
        <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-1.5 shadow-lg shadow-slate-500/20">
                            <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">UtilitySheet</span>
                    </Link>
                </div>

                <nav className="hidden items-center gap-8 md:flex">
                    <Link href="/#for-tcs" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        For TCs
                    </Link>
                    <Link href="/#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Features
                    </Link>
                    <Link href="/#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        How it Works
                    </Link>
                    <Link href="/demo" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Demo
                    </Link>
                    <Link href="/#pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Pricing
                    </Link>
                    <Link href="/about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        About
                    </Link>
                </nav>

                <div className="flex items-center gap-2 sm:gap-4">
                    {user ? (
                        <Link href="/dashboard" className="hidden sm:block">
                            <Button className="bg-slate-600 text-white hover:bg-slate-700 shadow-lg shadow-slate-500/20">
                                Dashboard
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/auth/login" className="hidden sm:block">
                                <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                                    Sign In
                                </Button>
                            </Link>
                            <Link href="/auth/signup" className="hidden sm:block">
                                <Button className="bg-slate-600 text-white hover:bg-slate-700 shadow-lg shadow-slate-500/20">
                                    Get Started
                                </Button>
                            </Link>
                        </>
                    )}

                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
                    <nav className="mx-auto max-w-7xl px-4 py-4 space-y-2">
                        <Link
                            href="/#for-tcs"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            For TCs
                        </Link>
                        <Link
                            href="/#features"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="/#how-it-works"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            How it Works
                        </Link>
                        <Link
                            href="/#pricing"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/demo"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Demo
                        </Link>
                        <Link
                            href="/about"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            About
                        </Link>
                        <div className="pt-4 space-y-2 border-t border-border mt-2">
                            {user ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block px-4 py-3 text-sm font-medium text-center bg-slate-600 text-white hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/auth/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/auth/signup"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-4 py-3 text-sm font-medium text-center bg-slate-600 text-white hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
