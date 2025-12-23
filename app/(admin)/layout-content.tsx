'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, Shield, FileText, ArrowLeft, Zap, LayoutDashboard, Inbox, Building2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Requests', href: '/admin/requests', icon: Inbox },
    { name: 'Orgs', href: '/admin/organizations', icon: Building2 },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: FileText },
];

export function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-950/20 via-background to-background">
            {/* Admin Header */}
            <header className="sticky top-0 z-50 border-b border-red-500/20 bg-card/80 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/20">
                                    <Shield className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-foreground">Admin Panel</span>
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                    GOD MODE
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <nav className="flex items-center gap-1">
                                {adminNavigation.map((item) => {
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                                ? 'bg-red-500/10 text-red-500'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                                }`}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                            <ThemeToggle />
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
                            >
                                <Zap className="h-4 w-4" />
                                <span className="hidden sm:inline">Back to App</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
