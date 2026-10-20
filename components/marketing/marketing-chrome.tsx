'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { NormaSuitePanel } from '@/components/norma-suite-panel';

// Header and footer shared by the marketing pages and /demo. Render them
// inside an element with the `marketing-site` class so the marketing tokens
// and header rules in app/(marketing)/marketing.css apply.

// Dynamically import the header to avoid SSR issues with useUser
export const MarketingHeader = dynamic(
    () => import('@/components/marketing/marketing-header').then(mod => mod.MarketingHeader),
    {
        ssr: false,
        loading: () => (
            <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
                <div className="marketing-container marketing-header-row flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-1.5 shadow-lg shadow-slate-500/20">
                                <Image src="/logo-sm.png" alt="UtilitySheet logo" width={20} height={20} className="h-5 w-5" />
                            </div>
                            <span className="marketing-wordmark text-xl font-bold tracking-tight">UtilitySheet</span>
                        </Link>
                    </div>
                </div>
            </header>
        )
    }
);

export function MarketingFooter() {
    return (
        <footer className="border-t border-border bg-background py-12">
            <div className="marketing-container">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-6">
                    <div className="col-span-2 lg:col-span-2">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 p-1.5 shadow-lg shadow-slate-500/20">
                                <Image src="/logo-sm.png" alt="UtilitySheet logo" width={20} height={20} className="h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold">UtilitySheet</span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
                            A simpler way to collect seller utility details and give buyers a thoughtful, organized handoff.
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
                            <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                            <li><Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
                            <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                            <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                            <li><Link href="/demo" className="hover:text-foreground transition-colors">Interactive Demo</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Use Cases</h3>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/utility-sheet-for-transaction-coordinators" className="hover:text-foreground transition-colors">For Transaction Coordinators</Link></li>
                            <li><Link href="/utility-sheet-for-real-estate-agents" className="hover:text-foreground transition-colors">For Real Estate Agents</Link></li>
                            <li><Link href="/seller-utility-information-form" className="hover:text-foreground transition-colors">Seller Utility Information Form</Link></li>
                            <li><Link href="/real-estate-closing-utility-checklist" className="hover:text-foreground transition-colors">Closing Utility Checklist</Link></li>
                            <li><Link href="/utility-sheet-template" className="hover:text-foreground transition-colors">Utility Sheet Template</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Company</h3>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                            <li><Link href="/auth/signup" className="hover:text-foreground transition-colors">Start Free</Link></li>
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
                <NormaSuitePanel variant="footer" />
                <div className="mt-12 border-t border-border pt-8 flex flex-col items-center gap-4 text-sm text-muted-foreground">
                    <p className="text-xs text-norma-muted">
                        Part of the Norma ecosystem &middot;{' '}
                        <a
                            href="https://normatc.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
                        >
                            normatc.com
                        </a>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
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
            </div>
        </footer>
    );
}
