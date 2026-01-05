import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function DemoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
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

                    {/* Demo Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium border border-border/60">
                        <Sparkles className="h-3.5 w-3.5" />
                        Demo Mode
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                                Back to Site
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button className="bg-slate-600 text-white hover:bg-slate-500 shadow-lg shadow-slate-500/20">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 pt-16">
                {children}
            </main>
        </div>
    );
}
