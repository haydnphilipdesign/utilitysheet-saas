import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Ban, Shield, Sparkles, Users } from 'lucide-react';
import { searchUsers, getLatestAdminActionsForUsers, type SortDirection, type UserSortField } from '@/lib/admin';
import { UsersTable } from './users-table';
import { AuthReconciliationCard } from './auth-reconciliation-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminDataTableShell, AdminFilterBar, AdminPageHeader, AdminPagination, AdminStatStrip } from '@/components/admin/primitives';
import {
    DEFAULT_PAGE_SIZE,
    buildAdminHref,
    clampPage,
    getParam,
    parseDirection,
    parsePage,
    parsePageSize,
    resolveSearchParams,
    shouldCanonicalizePage,
} from '@/lib/admin/list-query';
import type { Plan, UserRole } from '@/types';

export const dynamic = 'force-dynamic';

type UsersSearchParams = Promise<Record<string, string | string[] | undefined>>;

function isUserRole(value: string): value is UserRole {
    return value === 'user' || value === 'admin' || value === 'banned';
}

function isPlan(value: string): value is Plan {
    return value === 'free' || value === 'pro' || value === 'canceled';
}

function isAdminPlanFilter(value: string): value is Plan | 'team' {
    return value === 'team' || isPlan(value);
}

function isUserSortField(value: string): value is UserSortField {
    return value === 'created' || value === 'email' || value === 'name';
}

function nextSortDir(currentSortBy: UserSortField, currentSortDir: SortDirection, field: UserSortField): SortDirection {
    if (currentSortBy === field) return currentSortDir === 'asc' ? 'desc' : 'asc';
    return field === 'created' ? 'desc' : 'asc';
}

export default async function AdminUsersPage({ searchParams }: { searchParams: UsersSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const query = (getParam(sp, 'q') || '').trim();
    const roleRaw = getParam(sp, 'role');
    const planRaw = getParam(sp, 'plan');
    const sortRaw = getParam(sp, 'sort');
    const dirRaw = getParam(sp, 'dir');

    const role = roleRaw && isUserRole(roleRaw) ? roleRaw : undefined;
    const plan = planRaw && isAdminPlanFilter(planRaw) ? planRaw : undefined;
    const sortBy: UserSortField = sortRaw && isUserSortField(sortRaw) ? sortRaw : 'created';
    const sortDir = parseDirection(dirRaw, 'desc');

    const offset = (page - 1) * pageSize;
    const { users, total, stats } = await searchUsers({ limit: pageSize, offset, query, role, plan, sortBy, sortDir });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        role,
        plan,
        pageSize,
        sort: sortBy,
        dir: sortDir,
    };

    const buildPageHref = (targetPage: number) =>
        buildAdminHref('/admin/users', {
            ...baseValues,
            page: targetPage,
        });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    const latestActions = await getLatestAdminActionsForUsers(users.map((user) => user.id));

    const buildSortHref = (field: UserSortField) =>
        buildAdminHref('/admin/users', {
            ...baseValues,
            sort: field,
            dir: nextSortDir(sortBy, sortDir, field),
            page: 1,
        });

    const resetHref = buildAdminHref('/admin/users', {
        page: 1,
        pageSize,
        sort: 'created',
        dir: 'desc',
    });

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="User Management"
                description={`Control access, plans, and enforcement for ${total} accounts.`}
            />

            <AdminStatStrip
                stats={[
                    { label: 'Total Users', value: stats.total.toLocaleString(), icon: Users },
                    { label: 'Admins', value: stats.admins.toLocaleString(), icon: Shield },
                    { label: 'Banned', value: stats.banned.toLocaleString(), icon: Ban },
                    { label: 'Pro / Team', value: `${stats.pro} / ${stats.team}`, hint: `${stats.canceled} canceled`, icon: Sparkles },
                ]}
            />

            <AuthReconciliationCard />

            <AdminFilterBar>
                <form method="GET" action="/admin/users" className="flex flex-col gap-3">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />
                    <input type="hidden" name="sort" value={sortBy} />
                    <input type="hidden" name="dir" value={sortDir} />

                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="flex flex-1 items-center gap-2">
                            <Input
                                name="q"
                                placeholder="Search name, email, company, id..."
                                defaultValue={query}
                                className="w-full"
                            />
                            <Button type="submit" variant="outline" size="sm">Search</Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                name="role"
                                defaultValue={role || ''}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="">All roles</option>
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                                <option value="banned">Banned</option>
                            </select>
                            <select
                                name="plan"
                                defaultValue={plan || ''}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="">All plans</option>
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="team">Team</option>
                                <option value="canceled">Canceled</option>
                            </select>
                            {(query || role || plan) ? (
                                <Link href={resetHref} className="text-xs text-muted-foreground hover:text-foreground">
                                    Reset
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </form>
            </AdminFilterBar>

            <AdminDataTableShell>
                <UsersTable
                    users={users}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    sortHrefs={{
                        name: buildSortHref('name'),
                        email: buildSortHref('email'),
                        created: buildSortHref('created'),
                    }}
                    latestActions={latestActions}
                />

                <AdminPagination
                    page={canonicalPage}
                    pageSize={pageSize}
                    total={total}
                    totalPages={totalPages}
                    prevHref={buildPageHref(Math.max(1, canonicalPage - 1))}
                    nextHref={buildPageHref(Math.min(totalPages, canonicalPage + 1))}
                    buildPageSizeHref={(size) =>
                        buildAdminHref('/admin/users', {
                            ...baseValues,
                            page: 1,
                            pageSize: size,
                        })
                    }
                />
            </AdminDataTableShell>
        </div>
    );
}
