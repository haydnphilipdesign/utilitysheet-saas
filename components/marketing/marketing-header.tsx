'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

export function MarketingHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const hasTrackedPrimaryViewRef = useRef(false);
    const user = useUser();

    useEffect(() => {
        if (!mobileMenuOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        if (user || hasTrackedPrimaryViewRef.current) {
            return;
        }

        trackEvent('landing_primary_cta_viewed', {
            cta_id: 'primary_header_start_free',
            page: 'landing',
            location: 'marketing_header',
        });
        hasTrackedPrimaryViewRef.current = true;
    }, [user]);

    return (
        <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-1.5 shadow-lg shadow-slate-500/20">
                            <Image src="/logo-sm.png" alt="UtilitySheet logo" width={20} height={20} className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">UtilitySheet</span>
                        <span className="ml-1.5 text-xs font-normal text-norma-muted">by Norma</span>
                    </Link>
                </div>

                <nav className="hidden items-center gap-6 lg:gap-8 md:flex">
                    <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Home
                    </Link>
                    <Link href="/features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Features
                    </Link>
                    <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        How It Works
                    </Link>
                    <Link href="/pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Pricing
                    </Link>
                    <Link href="/faq" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        FAQ
                    </Link>
                    <Link href="/demo" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Demo
                    </Link>
                    <Link href="/about" className="hidden lg:block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                        About
                    </Link>
                </nav>

                <div className="flex items-center gap-2 sm:gap-4">
                    {user ? (
                        <Link href="/dashboard" className="hidden sm:block">
                            <Button className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20">
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
                                <Button
                                    className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                                    data-testid="marketing-header-signup-cta"
                                    onClick={() =>
                                        trackEvent('landing_primary_cta_clicked', {
                                            cta_id: 'primary_header_start_free',
                                            destination: '/auth/signup',
                                            location: 'marketing_header',
                                        })
                                    }
                                >
                                    Start Free
                                </Button>
                            </Link>

                            <Link href="/auth/signup" className="md:hidden">
                                <Button
                                    size="sm"
                                    className="h-9 bg-emerald-600 text-white hover:bg-emerald-500 px-3"
                                    data-testid="marketing-header-mobile-signup-cta"
                                    onClick={() =>
                                        trackEvent('landing_primary_cta_clicked', {
                                            cta_id: 'primary_header_mobile_start_free',
                                            destination: '/auth/signup',
                                            location: 'marketing_header_mobile',
                                        })
                                    }
                                >
                                    Start Free
                                </Button>
                            </Link>
                        </>
                    )}

                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden text-muted-foreground hover:text-foreground"
                        data-testid="marketing-mobile-menu-toggle"
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
                            href="/"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Home
                        </Link>
                        <Link
                            href="/features"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="/how-it-works"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            How It Works
                        </Link>
                        <Link
                            href="/pricing"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/faq"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            FAQ
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
                                    className="block px-4 py-3 text-sm font-medium text-center bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg transition-colors"
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
                                        onClick={() => {
                                            trackEvent('landing_primary_cta_clicked', {
                                                cta_id: 'primary_mobile_menu_start_free',
                                                destination: '/auth/signup',
                                                location: 'marketing_mobile_menu',
                                            });
                                            setMobileMenuOpen(false);
                                        }}
                                        className="block px-4 py-3 text-sm font-medium text-center bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg transition-colors"
                                        data-testid="marketing-mobile-signup-cta"
                                    >
                                        Start Free
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
