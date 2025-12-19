'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@stackframe/stack';
import { stackClientApp } from '@/lib/stack/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Zap, LayoutDashboard, FileText, Palette, Settings, LogOut, Menu, X } from 'lucide-react';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Requests', href: '/dashboard/requests', icon: FileText },
    { name: 'Branding', href: '/dashboard/branding', icon: Palette },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function DashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useUser();
    const [organization, setOrganization] = useState<any>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Fetch organization info
        fetch('/api/account').then(res => res.json()).then(data => {
            if (data.activeOrganization) {
                setOrganization(data.activeOrganization);
            }
        });
    }, []);

    const handleSignOut = async () => {
        await stackClientApp.signOut();
        router.push('/auth/login');
        router.refresh();
    };

    const getInitials = (name?: string | null, email?: string | null) => {
        if (name) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name.slice(0, 2).toUpperCase();
        }
        if (email) {
            return email.slice(0, 2).toUpperCase();
        }
        return '??';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-8">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                                    <Zap className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                                    <span className="text-xl font-bold text-white">UtilitySheet</span>
                                    {organization && (
                                        <span className="text-sm font-medium text-zinc-500 hidden sm:block border-l border-zinc-700 pl-2">
                                            {organization.name}
                                        </span>
                                    )}
                                </div>
                            </Link>

                            {/* Desktop Navigation */}
                            <nav className="hidden md:flex items-center gap-1">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href ||
                                        (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                                ? 'bg-zinc-800 text-white'
                                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                                }`}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Right Side */}
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/requests/new">
                                <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20 hidden sm:flex">
                                    New Request
                                </Button>
                            </Link>

                            {/* User Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-800">
                                    <Avatar className="h-9 w-9 border-2 border-zinc-700">
                                        <AvatarFallback className="bg-zinc-800 text-zinc-300 text-sm">
                                            {getInitials(user?.displayName, user?.primaryEmail)}
                                        </AvatarFallback>
                                    </Avatar>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800" align="end">
                                    <div className="px-2 py-1.5 text-zinc-400 font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium text-white truncate">
                                                {user?.displayName || 'User'}
                                            </p>
                                            <p className="text-xs text-zinc-500 truncate">
                                                {user?.primaryEmail || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                    <DropdownMenuItem
                                        className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                        onClick={() => router.push('/dashboard/settings')}
                                    >
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                    <DropdownMenuItem
                                        className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                        onClick={handleSignOut}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Mobile Menu Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden text-zinc-400 hover:text-white"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-xl">
                        <nav className="mx-auto max-w-7xl px-4 py-4 space-y-2">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                            ? 'bg-zinc-800 text-white'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                            <Link
                                href="/dashboard/requests/new"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-center gap-2 px-4 py-3 mt-4 text-sm font-medium rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                            >
                                New Request
                            </Link>
                        </nav>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
