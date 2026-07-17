'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import type { AdminUserRow, EffectivePlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { AdminUserControls } from '@/components/admin/AdminUserControls';
import { formatAdminDate } from '@/lib/admin/date-format';
import type { UserLatestRequest } from '@/lib/admin';

type UserSortField = 'created' | 'email' | 'name';
type SortDirection = 'asc' | 'desc';

type LatestAction = {
    userId: string;
    action: string;
    createdAt: string;
    adminEmail: string | null;
    adminName: string | null;
    metadata: Record<string, unknown> | null;
};

interface UsersTableProps {
    users: AdminUserRow[];
    sortBy: UserSortField;
    sortDir: SortDirection;
    sortHrefs: Record<UserSortField, string>;
    latestActions: Record<string, LatestAction>;
    latestRequests?: Record<string, UserLatestRequest[]>;
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDirection }) {
    if (!active) return null;
    return dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function getEffectivePlan(user: AdminUserRow): EffectivePlan {
    if (user.effective_subscription_status) return user.effective_subscription_status;
    if (user.active_organization_subscription_status === 'team') return 'team';
    return user.subscription_status;
}

function planBadge(plan: EffectivePlan) {
    if (plan === 'team') return <Badge className="border-indigo-500/30 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">Team</Badge>;
    if (plan === 'pro') return <Badge className="border-sky-500/30 bg-sky-500/20 text-sky-600 dark:text-sky-300">Pro</Badge>;
    if (plan === 'canceled') return <Badge className="border-amber-500/30 bg-amber-500/20 text-amber-700 dark:text-amber-300">Canceled</Badge>;
    return <Badge variant="outline">Free</Badge>;
}

function roleBadge(role: AdminUserRow['role']) {
    if (role === 'admin') return <Badge className="border-red-500/25 bg-red-500/15 text-red-600 dark:text-red-300">Admin</Badge>;
    if (role === 'banned') return <Badge variant="destructive">Banned</Badge>;
    return <Badge variant="secondary">User</Badge>;
}

export function UsersTable({ users, sortBy, sortDir, sortHrefs, latestActions, latestRequests = {} }: UsersTableProps) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const selectedUser = useMemo(
        () => users.find((user) => user.id === selectedUserId) || null,
        [selectedUserId, users]
    );

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card">
                        <tr className="border-b border-border/70">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Link href={sortHrefs.name} className="inline-flex items-center gap-1 hover:text-foreground">
                                    Name
                                    <SortIndicator active={sortBy === 'name'} dir={sortDir} />
                                </Link>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Link href={sortHrefs.email} className="inline-flex items-center gap-1 hover:text-foreground">
                                    Email
                                    <SortIndicator active={sortBy === 'email'} dir={sortDir} />
                                </Link>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entitlement</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Link href={sortHrefs.created} className="inline-flex items-center gap-1 hover:text-foreground">
                                    Created
                                    <SortIndicator active={sortBy === 'created'} dir={sortDir} />
                                </Link>
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="h-28 px-4 text-center text-muted-foreground">
                                    No users found for the current filters.
                                </td>
                            </tr>
                        ) : users.map((user) => (
                            <tr
                                key={user.id}
                                className="cursor-pointer transition-colors hover:bg-secondary/35"
                                onClick={() => setSelectedUserId(user.id)}
                            >
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{user.full_name || 'No name'}</span>
                                        <span className="font-mono text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                                <td className="px-4 py-3">{planBadge(getEffectivePlan(user))}</td>
                                <td className="px-4 py-3">{roleBadge(user.role)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{format(new Date(user.created_at), 'MMM d, yyyy')}</td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedUserId(user.id);
                                        }}
                                    >
                                        Manage
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Sheet open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUserId(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl">
                    {selectedUser ? (
                        <>
                            <SheetHeader className="border-b border-border/70">
                                <SheetTitle className="text-lg">{selectedUser.full_name || selectedUser.email}</SheetTitle>
                                <SheetDescription className="space-y-2">
                                    <span className="block">{selectedUser.email}</span>
                                    <span className="block font-mono text-[11px]">ID: {selectedUser.id}</span>
                                </SheetDescription>
                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                    {roleBadge(selectedUser.role)}
                                    {planBadge(getEffectivePlan(selectedUser))}
                                    <Link href={`/admin/users/${selectedUser.id}`} className="inline-flex">
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                            View full profile
                                        </Button>
                                    </Link>
                                </div>
                            </SheetHeader>

                            <div className="space-y-5 overflow-y-auto p-6">
                                <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest admin activity</h3>
                                    {latestActions[selectedUser.id] ? (
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="font-medium text-foreground">
                                                {String(latestActions[selectedUser.id].action).replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                by {latestActions[selectedUser.id].adminName || latestActions[selectedUser.id].adminEmail || 'Unknown'} on{' '}
                                                {format(new Date(latestActions[selectedUser.id].createdAt), 'MMM d, yyyy h:mm a')}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">No admin actions recorded yet.</p>
                                    )}
                                </section>

                                <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest requests</h3>
                                        <Link href={`/admin/requests?q=${selectedUser.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                                            View all
                                        </Link>
                                    </div>
                                    {latestRequests[selectedUser.id]?.length ? (
                                        <div className="mt-3 divide-y divide-border/70">
                                            {latestRequests[selectedUser.id].map((request) => (
                                                <Link
                                                    key={request.id}
                                                    href={`/admin/requests/${request.id}`}
                                                    className="block rounded-md py-2 text-sm hover:bg-background/70"
                                                >
                                                    <span className="block truncate font-medium text-foreground">{request.propertyAddress}</span>
                                                    <span className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                        <span>{request.status.replace(/_/g, ' ')}</span>
                                                        <span>{formatAdminDate(request.createdAt)}</span>
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">No requests found for this account.</p>
                                    )}
                                </section>

                                <AdminUserControls user={selectedUser} />
                            </div>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>
        </>
    );
}
