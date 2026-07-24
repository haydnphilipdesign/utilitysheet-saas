import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Ban, Shield, Sparkles, Users } from 'lucide-react';
import { searchUsers, getLatestAdminActionsForUsers, getLatestRequestsForUsers, type SortDirection, type UserSortField } from '@/lib/admin';
import { UsersTable } from './users-table';
import { AuthReconciliationCard } from './auth-reconciliation-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminDataTableShell, AdminFilterBar, AdminPageHeader, AdminPagination } from '@/components/admin/primitives';
import {
    DEFAULT_PAGE_SIZE,
    buildAdminHref,
    clampPage,
    getParam,
    parseAdminActivationFilter,
    parseAdminPlanFilter,
    parseDirection,
    parsePage,
    parsePageSize,
    resolveSearchParams,
    shouldCanonicalizePage,
} from '@/lib/admin/list-query';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

type UsersSearchParams = Promise<Record<string, string | string[] | undefined>>;

function isUserRole(value: string): value is UserRole {
    return value === 'user' || value === 'admin' || value === 'banned';
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
    const activationRaw = getParam(sp, 'activation');
    const sortRaw = getParam(sp, 'sort');
    const dirRaw = getParam(sp, 'dir');

    const role = roleRaw && isUserRole(roleRaw) ? roleRaw : undefined;
    const plan = parseAdminPlanFilter(planRaw);
    const activation = parseAdminActivationFilter(activationRaw);
    const sortBy: UserSortField = sortRaw && isUserSortField(sortRaw) ? sortRaw : 'created';
    const sortDir = parseDirection(dirRaw, 'desc');

    const offset = (page - 1) * pageSize;
    const { users, total, stats } = await searchUsers({ limit: pageSize, offset, query, role, plan, activation, sortBy, sortDir });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        role,
        plan,
        activation,
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

    const userIds = users.map((user) => user.id);
    const [latestActions, latestRequests] = await Promise.all([
        getLatestAdminActionsForUsers(userIds),
        getLatestRequestsForUsers(userIds),
    ]);

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
                description={`Search ${total.toLocaleString()} accounts, inspect activity, and apply audited access or entitlement controls.`}
            />

            <div className="grid overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Accounts', value: stats.total.toLocaleString(), detail: 'matching current filters', icon: Users },
                    { label: 'Admins', value: stats.admins.toLocaleString(), detail: 'privileged accounts', icon: Shield },
                    { label: 'Restricted', value: stats.banned.toLocaleString(), detail: 'banned accounts', icon: Ban },
                    { label: 'Paid access', value: `${stats.pro} Pro · ${stats.team} Team`, detail: `${stats.canceled} canceled overrides`, icon: Sparkles },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 border-b border-border/70 p-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                            <p className="truncate text-sm font-semibold text-foreground">{item.value}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                    </div>
                ))}
            </div>

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
                                aria-label="Role"
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
                                aria-label="Entitlement"
                                defaultValue={plan || ''}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="">All entitlements</option>
                                <option value="paying">Paying (Pro or Team)</option>
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="team">Team</option>
                                <option value="canceled">Canceled</option>
                            </select>
                            <select
                                name="activation"
                                aria-label="Setup state"
                                defaultValue={activation || ''}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="">Any setup state</option>
                                <option value="no-setup">No setup and no request</option>
                                <option value="missing-defaults">Core setup incomplete</option>
                                <option value="activated-7d">Activated this week</option>
                                <option value="habitual">Habitual (3+ in 30 days)</option>
                            </select>
                            {(query || role || plan || activation) ? (
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
                    latestRequests={latestRequests}
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
