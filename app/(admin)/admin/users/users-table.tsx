'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Ban, ExternalLink, Shield, User, UserCheck } from 'lucide-react';
import type { Account } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { updateUserRoleAction, banUserAction, unbanUserAction, updateUserPlanAction } from './actions';

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
    users: Account[];
    sortBy: UserSortField;
    sortDir: SortDirection;
    sortHrefs: Record<UserSortField, string>;
    latestActions: Record<string, LatestAction>;
}

type ConfirmableAction =
    | { type: 'promote'; user: Account }
    | { type: 'demote'; user: Account }
    | { type: 'ban'; user: Account }
    | { type: 'unban'; user: Account }
    | { type: 'upgradePlan'; user: Account }
    | { type: 'downgradePlan'; user: Account };

function getActionCopy(action: ConfirmableAction['type']) {
    switch (action) {
        case 'promote':
            return { title: 'Promote to Admin', confirm: 'Promote', tone: 'default' as const };
        case 'demote':
            return { title: 'Demote to User', confirm: 'Demote', tone: 'default' as const };
        case 'ban':
            return { title: 'Ban User', confirm: 'Ban', tone: 'destructive' as const };
        case 'unban':
            return { title: 'Unban User', confirm: 'Unban', tone: 'default' as const };
        case 'upgradePlan':
            return { title: 'Upgrade Plan to Pro', confirm: 'Upgrade', tone: 'default' as const };
        case 'downgradePlan':
            return { title: 'Downgrade Plan to Free', confirm: 'Downgrade', tone: 'default' as const };
    }
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDirection }) {
    if (!active) return null;
    return dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function planBadge(plan: Account['subscription_status']) {
    if (plan === 'pro') return <Badge className="bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30">Pro</Badge>;
    if (plan === 'canceled') return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">Canceled</Badge>;
    return <Badge variant="outline">Free</Badge>;
}

function roleBadge(role: Account['role']) {
    if (role === 'admin') return <Badge className="bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/25">Admin</Badge>;
    if (role === 'banned') return <Badge variant="destructive">Banned</Badge>;
    return <Badge variant="secondary">User</Badge>;
}

function actionGroups(user: Account): Array<{ label: string; actions: ConfirmableAction['type'][] }> {
    return [
        {
            label: 'Access',
            actions: [user.role === 'admin' ? 'demote' : 'promote'],
        },
        {
            label: 'Subscription',
            actions: [user.subscription_status === 'pro' ? 'downgradePlan' : 'upgradePlan'],
        },
        {
            label: 'Enforcement',
            actions: [user.role === 'banned' ? 'unban' : 'ban'],
        },
    ];
}

export function UsersTable({ users, sortBy, sortDir, sortHrefs, latestActions }: UsersTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmableAction | null>(null);
    const [reason, setReason] = useState('');

    const selectedUser = useMemo(
        () => users.find((user) => user.id === selectedUserId) || null,
        [selectedUserId, users]
    );

    const reasonOk = reason.trim().length >= 3;

    const openAction = (type: ConfirmableAction['type'], user: Account) => {
        setConfirmAction({ type, user });
        setReason('');
    };

    const closeDrawer = () => {
        setSelectedUserId(null);
        setConfirmAction(null);
        setReason('');
    };

    const confirm = () => {
        if (!confirmAction) return;
        const reasonText = reason.trim();

        if (reasonText.length < 3) {
            toast.error('Please add a short reason (min 3 characters).');
            return;
        }

        startTransition(async () => {
            try {
                const userId = confirmAction.user.id;
                const userEmail = confirmAction.user.email;
                let result: { success: boolean; error?: string; code?: string } = { success: false, error: 'Unknown action' };

                switch (confirmAction.type) {
                    case 'promote':
                        result = await updateUserRoleAction(userId, 'admin', reasonText);
                        break;
                    case 'demote':
                        result = await updateUserRoleAction(userId, 'user', reasonText);
                        break;
                    case 'ban':
                        result = await banUserAction(userId, reasonText);
                        break;
                    case 'unban':
                        result = await unbanUserAction(userId, reasonText);
                        break;
                    case 'upgradePlan':
                        result = await updateUserPlanAction(userId, 'pro', reasonText);
                        break;
                    case 'downgradePlan':
                        result = await updateUserPlanAction(userId, 'free', reasonText);
                        break;
                }

                if (!result.success) {
                    toast.error(result.error || 'Action failed');
                    return;
                }

                const { title } = getActionCopy(confirmAction.type);
                toast.success(`${title}: ${userEmail}`);
                setConfirmAction(null);
                setReason('');
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Action failed');
            }
        });
    };

    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-[880px] w-full text-sm">
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
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
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
                        ) : (
                            users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="cursor-pointer transition-colors hover:bg-secondary/35"
                                    onClick={() => setSelectedUserId(user.id)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{user.full_name || 'No name'}</span>
                                            <span className="text-xs text-muted-foreground font-mono">ID: {user.id.slice(0, 8)}...</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                                    <td className="px-4 py-3">{planBadge(user.subscription_status)}</td>
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Sheet open={!!selectedUser} onOpenChange={(open) => !open && closeDrawer()}>
                <SheetContent side="right" className="w-full sm:max-w-xl">
                    {selectedUser ? (
                        <>
                            <SheetHeader className="border-b border-border/70">
                                <SheetTitle className="text-lg">{selectedUser.full_name || selectedUser.email}</SheetTitle>
                                <SheetDescription className="space-y-2">
                                    <span className="block">{selectedUser.email}</span>
                                    <span className="block font-mono text-[11px]">ID: {selectedUser.id}</span>
                                </SheetDescription>
                                <div className="flex items-center gap-2 pt-2">
                                    {roleBadge(selectedUser.role)}
                                    {planBadge(selectedUser.subscription_status)}
                                    <Link href={`/admin/users/${selectedUser.id}`} className="inline-flex">
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                            View Profile
                                        </Button>
                                    </Link>
                                </div>
                            </SheetHeader>

                            <div className="space-y-5 overflow-y-auto p-6">
                                <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest Admin Activity</h3>
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

                                {actionGroups(selectedUser).map((group) => (
                                    <section key={group.label}>
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {group.actions.map((type) => {
                                                const copy = getActionCopy(type);
                                                const icon =
                                                    type === 'promote' ? <Shield className="h-4 w-4" /> :
                                                        type === 'demote' ? <User className="h-4 w-4" /> :
                                                            type === 'ban' ? <Ban className="h-4 w-4" /> :
                                                                type === 'unban' ? <UserCheck className="h-4 w-4" /> :
                                                                    <ArrowUp className="h-4 w-4" />;
                                                return (
                                                    <Button
                                                        key={type}
                                                        variant={copy.tone}
                                                        size="sm"
                                                        onClick={() => openAction(type, selectedUser)}
                                                        disabled={isPending}
                                                    >
                                                        {icon}
                                                        {copy.title}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}

                                {confirmAction ? (
                                    <section className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                        <h3 className="text-sm font-semibold text-foreground">{getActionCopy(confirmAction.type).title}</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            This action is audited. Add a short reason to proceed.
                                        </p>
                                        <Textarea
                                            className="mt-3"
                                            placeholder="Reason (required)..."
                                            value={reason}
                                            onChange={(event) => setReason(event.target.value)}
                                            disabled={isPending}
                                        />
                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)} disabled={isPending}>
                                                Cancel
                                            </Button>
                                            <Button
                                                variant={getActionCopy(confirmAction.type).tone}
                                                size="sm"
                                                onClick={confirm}
                                                disabled={!reasonOk || isPending}
                                            >
                                                {getActionCopy(confirmAction.type).confirm}
                                            </Button>
                                        </div>
                                    </section>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>
        </>
    );
}
