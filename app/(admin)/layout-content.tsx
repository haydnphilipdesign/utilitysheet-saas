'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, FileText, Inbox, LayoutDashboard, Megaphone, Menu, Shield, Sparkles, TrendingDown, TrendingUp, Users, X, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

// `id` is a slug because it is used to build `aria-labelledby` references, which are
// whitespace-separated lists of IDs; a name like "Growth & Content" would break them.
const adminNavigationSections = [
    {
        id: 'operations',
        name: 'Operations',
        items: [
            { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
            { name: 'Requests', href: '/admin/requests', icon: Inbox },
            { name: 'Seller Progress', href: '/admin/abandonment', icon: TrendingDown },
        ],
    },
    {
        id: 'customers',
        name: 'Customers',
        items: [
            { name: 'Users', href: '/admin/users', icon: Users },
            { name: 'Workspaces', href: '/admin/organizations', icon: Building2 },
        ],
    },
    {
        id: 'growth-content',
        name: 'Growth & Content',
        items: [
            { name: 'Growth', href: '/admin/growth', icon: TrendingUp },
            { name: 'Customer Outreach', href: '/admin/testimonial-candidates', icon: Sparkles },
            { name: 'Updates', href: '/admin/updates', icon: Megaphone },
        ],
    },
    {
        id: 'security',
        name: 'Security',
        items: [
            { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
        ],
    },
];

export function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [navOpen, setNavOpen] = useState(false);
    const sidebarId = useId();

    useEffect(() => {
        if (!navOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setNavOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [navOpen]);

    return (
        <div className="min-h-screen bg-muted/20 [--admin-header-height:4rem]">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
                <div className="mx-auto flex h-[var(--admin-header-height)] max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setNavOpen((open) => !open)}
                            aria-expanded={navOpen}
                            aria-controls={sidebarId}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                        >
                            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                            <span className="sr-only">{navOpen ? 'Close admin navigation' : 'Open admin navigation'}</span>
                        </button>
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
                            title="Back to UtilitySheet app"
                            className="inline-flex h-11 items-center gap-1 rounded-md border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-8"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Back to App
                        </Link>
                    </div>
                </div>
            </header>

            {navOpen ? (
                <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => setNavOpen(false)}
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                />
            ) : null}

            <div className="mx-auto flex max-w-[96rem] gap-6 px-4 sm:px-6 lg:px-8">
                <aside
                    id={sidebarId}
                    className={cn(
                        'w-64 shrink-0 overflow-y-auto border-border/70 bg-background',
                        'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:border-r max-lg:p-4 max-lg:shadow-xl',
                        'lg:sticky lg:top-[var(--admin-header-height)] lg:h-[calc(100vh-var(--admin-header-height))] lg:w-56 lg:bg-transparent lg:py-6',
                        navOpen ? 'max-lg:block' : 'max-lg:hidden'
                    )}
                >
                    <nav aria-label="Admin navigation" className="space-y-6">
                        {adminNavigationSections.map((section) => (
                            <div key={section.id}>
                                <h2
                                    id={`${sidebarId}-${section.id}`}
                                    className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
                                >
                                    {section.name}
                                </h2>
                                <ul aria-labelledby={`${sidebarId}-${section.id}`} className="mt-1.5 space-y-0.5">
                                    {section.items.map((item) => {
                                        const isActive = item.href === '/admin'
                                            ? pathname === '/admin'
                                            : pathname.startsWith(item.href);
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    href={item.href}
                                                    // The sidebar is one element that becomes a slide-over
                                                    // below `lg`; close it so a tapped link does not leave
                                                    // the panel covering the page it just opened.
                                                    onClick={() => setNavOpen(false)}
                                                    aria-current={isActive ? 'page' : undefined}
                                                    className={cn(
                                                        'flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors lg:min-h-0',
                                                        isActive
                                                            ? 'bg-red-500/12 text-red-700 ring-1 ring-inset ring-red-500/15 dark:text-red-300'
                                                            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4 shrink-0" />
                                                    {item.name}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                <main className="min-w-0 flex-1 py-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
