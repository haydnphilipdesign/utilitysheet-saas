'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the header to avoid SSR issues with useUser
const MarketingHeader = dynamic(
    () => import('@/components/marketing/marketing-header').then(mod => mod.MarketingHeader),
    {
        ssr: false,
        loading: () => (
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
                </div>
            </header>
        )
    }
);

export default function MarketingLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <MarketingHeader />

            <main className="flex-1 pt-16">
                {children}
            </main>

            <footer className="border-t border-border bg-background py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
                        <div className="col-span-2 lg:col-span-2">
                            <Link href="/" className="flex items-center gap-2">
                                <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-1.5 shadow-lg shadow-slate-500/20">
                                    <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-5 w-5" />
                                </div>
                                <span className="text-xl font-bold">UtilitySheet</span>
                            </Link>
                            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
                                The utility handoff tool for real estate transaction coordinators. One seller link. One clean sheet. Every time.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                    Free plan available
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                    No credit card required
                                </span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Product</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/#how-it-works" className="hover:text-foreground transition-colors">Workflow</Link></li>
                                <li><Link href="/#features" className="hover:text-foreground transition-colors">Features</Link></li>
                                <li><Link href="/#templates" className="hover:text-foreground transition-colors">Templates</Link></li>
                                <li><Link href="/demo" className="hover:text-foreground transition-colors">Demo</Link></li>
                                <li><Link href="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                                <li><Link href="/#faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Company</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                                <li><Link href="/auth/signup" className="hover:text-foreground transition-colors">Get Started</Link></li>
                                <li><Link href="/auth/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                                <li><Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                        <p>&copy; {new Date().getFullYear()} UtilitySheet. All rights reserved.</p>
                        <p className="text-xs">
                            Built by{' '}
                            <a
                                href="https://www.multimedium.dev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
                            >
                                Multimedium
                            </a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
