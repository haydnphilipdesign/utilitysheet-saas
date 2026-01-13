import Link from 'next/link';
import { redirect } from 'next/navigation';
import { searchUsers } from '@/lib/admin';
import { UsersTable } from './users-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Plan, UserRole } from '@/types';

export const dynamic = 'force-dynamic';

type UsersSearchParams = {
    q?: string;
    role?: string;
    plan?: string;
    page?: string;
};

function parseIntParam(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function isUserRole(value: string): value is UserRole {
    return value === 'user' || value === 'admin' || value === 'banned';
}

function isPlan(value: string): value is Plan {
    return value === 'free' || value === 'pro' || value === 'canceled';
}

export default async function AdminUsersPage({ searchParams }: { searchParams: UsersSearchParams }) {
    const page = Math.max(1, parseIntParam(searchParams.page, 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const query = searchParams.q?.trim() || '';
    const role = searchParams.role && isUserRole(searchParams.role) ? searchParams.role : undefined;
    const plan = searchParams.plan && isPlan(searchParams.plan) ? searchParams.plan : undefined;

    const { users, total } = await searchUsers({ limit, offset, query, role, plan });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    async function searchAction(formData: FormData) {
        'use server';

        const q = String(formData.get('q') || '').trim();
        const role = String(formData.get('role') || '').trim();
        const plan = String(formData.get('plan') || '').trim();

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (role && role !== 'all') params.set('role', role);
        if (plan && plan !== 'all') params.set('plan', plan);

        const qs = params.toString();
        redirect(qs ? `/admin/users?${qs}` : '/admin/users');
    }

    function buildPageHref(nextPage: number) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (role) params.set('role', role);
        if (plan) params.set('plan', plan);
        params.set('page', String(nextPage));
        return `/admin/users?${params.toString()}`;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1">
                        View and manage all {total} registered users
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form action={searchAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                        <Input
                            name="q"
                            placeholder="Search name, email, company, id..."
                            defaultValue={query}
                            className="w-full sm:w-80"
                        />
                        <Button type="submit" size="icon" variant="outline" aria-label="Search">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            name="role"
                            defaultValue={role || 'all'}
                            className="h-7 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                        >
                            <option value="all">All roles</option>
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="banned">Banned</option>
                        </select>
                        <select
                            name="plan"
                            defaultValue={plan || 'all'}
                            className="h-7 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                        >
                            <option value="all">All plans</option>
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="canceled">Canceled</option>
                        </select>
                        {(query || role || plan) && (
                            <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground">
                                Reset
                            </Link>
                        )}
                    </div>
                </form>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-xs text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Link
                            href={buildPageHref(Math.max(1, page - 1))}
                            aria-disabled={page <= 1}
                            className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button variant="outline" size="sm" disabled={page <= 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link
                            href={buildPageHref(Math.min(totalPages, page + 1))}
                            aria-disabled={page >= totalPages}
                            className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button variant="outline" size="sm" disabled={page >= totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm">
                <UsersTable users={users} />
            </div>
        </div>
    );
}
