'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    MoreHorizontal,
    UserCheck,
    Ban,
    Shield,
    User,
    ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import type { Account, UserRole } from '@/types';
import { updateUserRoleAction, banUserAction, unbanUserAction, updateUserPlanAction } from './actions';

interface UsersTableProps {
    users: Account[];
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

export function UsersTable({ users }: UsersTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [confirmAction, setConfirmAction] = useState<ConfirmableAction | null>(null);
    const [reason, setReason] = useState('');

    const reasonOk = reason.trim().length >= 3;

    const runAction = (action: ConfirmableAction) => {
        setConfirmAction(action);
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
                let result: { success: boolean; error?: string } = { success: false, error: 'Unknown action' };

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

    const handleBan = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'ban', user });
    };

    const handleUnban = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'unban', user });
    };

    const handlePromote = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'promote', user });
    };

    const handleDemote = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'demote', user });
    };

    const handleUpgradePlan = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'upgradePlan', user });
    };

    const handleDowngradePlan = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        runAction({ type: 'downgradePlan', user });
    };

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">Admin</Badge>;
            case 'banned':
                return <Badge variant="destructive">Banned</Badge>;
            default:
                return <Badge variant="secondary">User</Badge>;
        }
    };

    const columns: ColumnDef<Account>[] = [
        {
            accessorKey: 'full_name',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="hover:bg-transparent -ml-4"
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <Link
                        href={`/admin/users/${row.original.id}`}
                        className="font-medium text-foreground hover:underline underline-offset-2"
                    >
                        {row.original.full_name || 'No name'}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        ID: {row.original.id.slice(0, 8)}...
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'email',
            header: 'Email',
            cell: ({ row }) => (
                <span className="text-muted-foreground">{row.original.email}</span>
            ),
        },
        {
            accessorKey: 'plan',
            header: 'Plan',
            cell: ({ row }) => (
                <Badge variant={row.original.subscription_status === 'pro' ? 'default' : 'outline'}>
                    {row.original.subscription_status === 'pro' ? 'Pro' : 'Free'}
                </Badge>
            ),
        },
        {
            accessorKey: 'role',
            header: 'Role',
            cell: ({ row }) => getRoleBadge(row.original.role),
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className="hover:bg-transparent -ml-4"
                >
                    Created
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {format(new Date(row.original.created_at), 'MMM d, yyyy')}
                </span>
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {user.role === 'admin' ? (
                                    <DropdownMenuItem
                                        onClick={() => handleDemote(user.id)}
                                        className="cursor-pointer"
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        Demote to User
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem
                                        onClick={() => handlePromote(user.id)}
                                        className="cursor-pointer"
                                    >
                                        <Shield className="mr-2 h-4 w-4" />
                                        Promote to Admin
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {user.subscription_status === 'pro' ? (
                                    <DropdownMenuItem
                                        onClick={() => handleDowngradePlan(user.id)}
                                        className="cursor-pointer"
                                    >
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                        Downgrade to Free
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem
                                        onClick={() => handleUpgradePlan(user.id)}
                                        className="cursor-pointer"
                                    >
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                        Upgrade to Pro
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {user.role === 'banned' ? (
                                    <DropdownMenuItem
                                        onClick={() => handleUnban(user.id)}
                                        className="cursor-pointer text-sky-500"
                                    >
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        Unban User
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem
                                        onClick={() => handleBan(user.id)}
                                        className="cursor-pointer text-destructive"
                                    >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Ban User
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const table = useReactTable({
        data: users,
        columns,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
        },
    });

    return (
        <div className="p-4">
            <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{confirmAction ? getActionCopy(confirmAction.type).title : 'Confirm action'}</DialogTitle>
                        <DialogDescription>
                            This action will be recorded in audit logs. Add a short reason before confirming.
                        </DialogDescription>
                    </DialogHeader>

                    {confirmAction && (
                        <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                                Target: <span className="text-foreground font-medium">{confirmAction.user.email}</span> (ID{' '}
                                <span className="font-mono">{confirmAction.user.id.slice(0, 8)}...</span>)
                            </div>
                            <Textarea
                                placeholder="Reason (required)..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmAction(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={confirmAction ? getActionCopy(confirmAction.type).tone : 'default'}
                            onClick={confirm}
                            disabled={!confirmAction || !reasonOk || isPending}
                        >
                            {confirmAction ? getActionCopy(confirmAction.type).confirm : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-secondary/50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-border">
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-secondary/30 transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No users found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
