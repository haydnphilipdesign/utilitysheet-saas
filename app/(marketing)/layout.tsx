'use client';

import { Suspense } from 'react';
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
    children: React.ReactNode;
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
                                <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-5 w-5" />
                                <span className="text-xl font-bold">UtilitySheet</span>
                            </Link>
                            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                                Standardizing and accelerating utility handoffs for real estate professionals.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Product</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/#features" className="hover:text-foreground">Features</Link></li>
                                <li><Link href="/#how-it-works" className="hover:text-foreground">How it Works</Link></li>
                                <li><Link href="/#pricing" className="hover:text-foreground">Pricing</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Company</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
                            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
                                <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
                                <li><Link href="/cookie-policy" className="hover:text-foreground">Cookie Policy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
                        <p>© {new Date().getFullYear()} UtilitySheet. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
