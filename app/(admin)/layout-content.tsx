'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Building2, FileText, Inbox, LayoutDashboard, Megaphone, Shield, Sparkles, TrendingDown, Users, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

const adminNavigationSections = [
    {
        name: 'Operations',
        items: [
            { name: 'Overview', href: '/admin', icon: LayoutDashboard },
            { name: 'Requests', href: '/admin/requests', icon: Inbox },
            { name: 'Seller Progress', href: '/admin/abandonment', icon: TrendingDown },
        ],
    },
    {
        name: 'Customers',
        items: [
            { name: 'Users', href: '/admin/users', icon: Users },
            { name: 'Workspaces', href: '/admin/organizations', icon: Building2 },
        ],
    },
    {
        name: 'Growth & Content',
        items: [
            { name: 'Top Users', href: '/admin/testimonial-candidates', icon: Sparkles },
            { name: 'Updates', href: '/admin/updates', icon: Megaphone },
        ],
    },
    {
        name: 'Security',
        items: [
            { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
        ],
    },
];

export function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-muted/20">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link
                                href="/dashboard"
                                aria-label="Back to UtilitySheet app"
                                title="Back to UtilitySheet app"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:text-foreground sm:h-8 sm:w-8"
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
                            <ThemeToggle triggerId="admin-theme-toggle" />
                            <Link
                                href="/dashboard"
                                className="inline-flex h-11 items-center gap-1 rounded-md border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-8"
                            >
                                <Zap className="h-3.5 w-3.5" />
                                Back to App
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border/60 bg-background/95">
                    <div className="mx-auto max-w-[96rem] overflow-x-auto px-4 sm:px-6 lg:px-8">
                        <nav aria-label="Admin navigation" className="flex min-w-max items-stretch gap-5 py-2">
                            {adminNavigationSections.map((section) => (
                                <div key={section.name} className="flex items-center gap-1.5">
                                    <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                        {section.name}
                                    </span>
                                    <div className="flex items-center gap-1 border-l border-border/70 pl-1.5">
                                        {section.items.map((item) => {
                                            const isActive = item.href === '/admin'
                                                ? pathname === '/admin'
                                                : pathname.startsWith(item.href);
                                            return (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    aria-current={isActive ? 'page' : undefined}
                                                    className={cn(
                                                        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:min-h-0',
                                                        isActive
                                                            ? 'bg-red-500/12 text-red-700 ring-1 ring-inset ring-red-500/15 dark:text-red-300'
                                                            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                                                    )}
                                                >
                                                    <item.icon className="h-3.5 w-3.5" />
                                                    {item.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
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
