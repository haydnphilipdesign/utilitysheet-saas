'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { buildSuiteUrl, suiteLinks } from '@/lib/norma-suite';

// Header and footer shared by the marketing pages and /demo. Render them
// inside an element with the `marketing-site` class so the marketing tokens
// and header rules in app/(marketing)/marketing.css apply.

// Rendered on the server (no Stack Auth on marketing pages), so the nav links
// are in the static HTML. Signed-in state is a cookie hint applied after load.
export { MarketingHeader } from '@/components/marketing/marketing-header';

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
                        <h2 className="text-sm font-semibold text-foreground">Product</h2>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                            <li><Link href="/how-it-works" className="hover:text-foreground transition-colors">How it works</Link></li>
                            <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                            <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                            <li><Link href="/demo" className="hover:text-foreground transition-colors">Interactive demo</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Use cases</h2>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/utility-sheet-for-transaction-coordinators" className="hover:text-foreground transition-colors">For transaction coordinators</Link></li>
                            <li><Link href="/utility-sheet-for-real-estate-agents" className="hover:text-foreground transition-colors">For real estate agents</Link></li>
                            <li><Link href="/seller-utility-information-form" className="hover:text-foreground transition-colors">Seller utility information form</Link></li>
                            <li><Link href="/real-estate-closing-utility-checklist" className="hover:text-foreground transition-colors">Closing utility checklist</Link></li>
                            <li><Link href="/utility-sheet-template" className="hover:text-foreground transition-colors">Utility sheet template</Link></li>
                            <li><Link href="/guides/transfer-utilities-when-selling-a-house" className="hover:text-foreground transition-colors">Seller utilities guide</Link></li>
                            <li><Link href="/guides/set-up-utilities-when-buying-a-house" className="hover:text-foreground transition-colors">Buyer utilities guide</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Company</h2>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                            <li><Link href="/auth/signup" className="hover:text-foreground transition-colors">Start free</Link></li>
                            <li><Link href="/auth/login" className="hover:text-foreground transition-colors">Sign in</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Legal</h2>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                            <li><Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-12 border-t border-border pt-8 flex flex-col items-center gap-4 text-sm text-muted-foreground">
                    <p className="text-xs">
                        <a
                            href={buildSuiteUrl(suiteLinks.productsHub, 'utilitysheet_footer')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-6 items-center gap-1 hover:text-foreground underline-offset-4 hover:underline transition-colors"
                        >
                            Part of the Norma Suite
                            <ArrowUpRight size={13} aria-hidden="true" />
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
