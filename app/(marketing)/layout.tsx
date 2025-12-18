import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
            <header className="fixed top-0 z-50 w-full border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 p-1.5 shadow-lg shadow-emerald-500/20">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">UtilitySheet</span>
                        </Link>
                    </div>

                    <nav className="hidden items-center gap-8 md:flex">
                        <Link href="#features" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">
                            Features
                        </Link>
                        <Link href="#how-it-works" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">
                            How it Works
                        </Link>
                        <Link href="#pricing" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">
                            Pricing
                        </Link>
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link href="/auth/login">
                            <Button variant="ghost" className="text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50">
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 pt-16">
                {children}
            </main>

            <footer className="border-t border-zinc-900 bg-zinc-950 py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
                        <div className="col-span-2 lg:col-span-2">
                            <Link href="/" className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-emerald-500" />
                                <span className="text-xl font-bold">UtilitySheet</span>
                            </Link>
                            <p className="mt-4 max-w-xs text-sm text-zinc-400">
                                Standardizing and accelerating utility handoffs for real estate professionals.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Product</h3>
                            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                                <li><Link href="#how-it-works" className="hover:text-white">How it Works</Link></li>
                                <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Company</h3>
                            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                                <li><Link href="#" className="hover:text-white">About</Link></li>
                                <li><Link href="#" className="hover:text-white">Blog</Link></li>
                                <li><Link href="#" className="hover:text-white">Careers</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Legal</h3>
                            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                                <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                                <li><Link href="#" className="hover:text-white">Terms</Link></li>
                                <li><Link href="#" className="hover:text-white">Cookie Policy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-12 border-t border-zinc-900 pt-8 text-center text-sm text-zinc-500">
                        <p>© {new Date().getFullYear()} UtilitySheet. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
