'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
    MoreHorizontal,
    Search,
    UserCheck,
    Ban,
    Shield,
    User,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import type { Account, UserRole } from '@/types';
import { impersonateUser, updateUserRoleAction, banUserAction, unbanUserAction } from './actions';

interface UsersTableProps {
    users: Account[];
}

export function UsersTable({ users }: UsersTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const handleImpersonate = async (userId: string) => {
        startTransition(async () => {
            await impersonateUser(userId);
            router.push('/dashboard');
            router.refresh();
        });
    };

    const handleBan = async (userId: string) => {
        startTransition(async () => {
            await banUserAction(userId);
            router.refresh();
        });
    };

    const handleUnban = async (userId: string) => {
        startTransition(async () => {
            await unbanUserAction(userId);
            router.refresh();
        });
    };

    const handlePromote = async (userId: string) => {
        startTransition(async () => {
            await updateUserRoleAction(userId, 'admin');
            router.refresh();
        });
    };

    const handleDemote = async (userId: string) => {
        startTransition(async () => {
            await updateUserRoleAction(userId, 'user');
            router.refresh();
        });
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
                    <span className="font-medium text-foreground">
                        {row.original.full_name || 'No name'}
                    </span>
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
            accessorKey: 'role',
            header: 'Role',
            cell: ({ row }) => getRoleBadge(row.original.role),
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id));
            },
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
                        <DropdownMenuTrigger
                            className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                            disabled={isPending}
                        >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => handleImpersonate(user.id)}
                                className="cursor-pointer"
                            >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Impersonate
                            </DropdownMenuItem>
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
                            {user.role === 'banned' ? (
                                <DropdownMenuItem
                                    onClick={() => handleUnban(user.id)}
                                    className="cursor-pointer text-emerald-500"
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
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: 'includesString',
    });

    return (
        <div className="p-4">
            {/* Search */}
            <div className="flex items-center py-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={globalFilter ?? ''}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
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

            {/* Pagination */}
            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {users.length} users
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
