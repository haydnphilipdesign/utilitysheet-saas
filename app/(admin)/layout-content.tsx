'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Building2, FileText, Inbox, LayoutDashboard, Megaphone, Shield, Sparkles, TrendingDown, Users, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Requests', href: '/admin/requests', icon: Inbox },
    { name: 'Abandonment', href: '/admin/abandonment', icon: TrendingDown },
    { name: 'Top Users', href: '/admin/testimonial-candidates', icon: Sparkles },
    { name: 'Orgs', href: '/admin/organizations', icon: Building2 },
    { name: 'Updates', href: '/admin/updates', icon: Megaphone },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
];

export function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_40%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_35%)]">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link
                                href="/dashboard"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span className="sr-only">Back to app</span>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="rounded-md bg-red-500 p-1.5 text-white shadow-sm">
                                    <Shield className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-foreground">Admin Control</div>
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Production operations</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Back to App
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border/60 bg-background/80">
                    <div className="mx-auto max-w-[96rem] overflow-x-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex min-w-max items-center gap-1 py-2">
                            {adminNavigation.map((item) => {
                                const isActive = item.href === '/admin'
                                    ? pathname === '/admin'
                                    : pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                            isActive
                                                ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                                        )}
                                    >
                                        <item.icon className="h-3.5 w-3.5" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
