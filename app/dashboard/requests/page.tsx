'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Plus,
    Search,
    MoreHorizontal,
    Copy,
    Eye,
    Download,
    Mail,
    ExternalLink,
    Filter,
    FileText,
    Send,
    Clock,
    CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Request } from '@/types';
import { useState } from 'react';

// Mock data - same as dashboard
const mockRequests: Request[] = [
    {
        id: '1',
        account_id: '1',
        brand_profile_id: '1',
        property_address: '123 Oak Street, Charlotte, NC 28202',
        property_address_structured: null,
        seller_name: 'John Smith',
        seller_email: 'john@example.com',
        seller_phone: null,
        closing_date: '2024-01-15',
        status: 'submitted',
        public_token: 'abc123',
        created_at: '2024-12-10T10:00:00Z',
        updated_at: '2024-12-12T14:30:00Z',
        last_activity_at: '2024-12-12T14:30:00Z',
    },
    {
        id: '2',
        account_id: '1',
        brand_profile_id: '1',
        property_address: '456 Maple Ave, Raleigh, NC 27601',
        property_address_structured: null,
        seller_name: 'Sarah Johnson',
        seller_email: 'sarah@example.com',
        seller_phone: null,
        closing_date: '2024-01-20',
        status: 'in_progress',
        public_token: 'def456',
        created_at: '2024-12-11T09:00:00Z',
        updated_at: '2024-12-13T11:00:00Z',
        last_activity_at: '2024-12-13T11:00:00Z',
    },
    {
        id: '3',
        account_id: '1',
        brand_profile_id: '1',
        property_address: '789 Pine Road, Durham, NC 27701',
        property_address_structured: null,
        seller_name: 'Mike Williams',
        seller_email: null,
        seller_phone: '555-0123',
        closing_date: null,
        status: 'sent',
        public_token: 'ghi789',
        created_at: '2024-12-12T15:00:00Z',
        updated_at: '2024-12-12T15:00:00Z',
        last_activity_at: '2024-12-12T15:00:00Z',
    },
    {
        id: '4',
        account_id: '1',
        brand_profile_id: null,
        property_address: '321 Elm Street, Chapel Hill, NC 27514',
        property_address_structured: null,
        seller_name: null,
        seller_email: null,
        seller_phone: null,
        closing_date: '2024-02-01',
        status: 'draft',
        public_token: 'jkl012',
        created_at: '2024-12-13T08:00:00Z',
        updated_at: '2024-12-13T08:00:00Z',
        last_activity_at: '2024-12-13T08:00:00Z',
    },
];

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

export default function RequestsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const filteredRequests = mockRequests.filter((request) => {
        const matchesSearch =
            request.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
            request.seller_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(link);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Requests</h1>
                    <p className="text-zinc-400 mt-1">All utility sheet requests</p>
                </div>
                <Link href="/dashboard/requests/new">
                    <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search by address or seller..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full sm:w-[180px] h-9 px-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="in_progress">In Progress</option>
                            <option value="submitted">Submitted</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="pt-6">
                    <div className="rounded-lg border border-zinc-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Property</TableHead>
                                    <TableHead className="text-zinc-400">Seller</TableHead>
                                    <TableHead className="text-zinc-400 hidden md:table-cell">Closing Date</TableHead>
                                    <TableHead className="text-zinc-400 hidden lg:table-cell">Created</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                                            No requests match your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const status = statusConfig[request.status];
                                        return (
                                            <TableRow key={request.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                                <TableCell>
                                                    <p className="font-medium text-white">{request.property_address}</p>
                                                </TableCell>
                                                <TableCell className="text-zinc-300">
                                                    {request.seller_name || '—'}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-zinc-300">
                                                    {request.closing_date
                                                        ? format(new Date(request.closing_date), 'MMM d, yyyy')
                                                        : '—'
                                                    }
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-zinc-400 text-sm">
                                                    {format(new Date(request.created_at), 'MMM d, yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`${status.color} border`}>
                                                        <status.icon className="mr-1 h-3 w-3" />
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                                            <DropdownMenuItem
                                                                className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                                                onClick={() => copyLink(request.public_token)}
                                                            >
                                                                <Copy className="mr-2 h-4 w-4" />
                                                                Copy seller link
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer">
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View details
                                                            </DropdownMenuItem>
                                                            {request.status === 'submitted' && (
                                                                <>
                                                                    <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer">
                                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                                        View packet
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer">
                                                                        <Download className="mr-2 h-4 w-4" />
                                                                        Download PDF
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {['sent', 'in_progress'].includes(request.status) && (
                                                                <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer">
                                                                    <Mail className="mr-2 h-4 w-4" />
                                                                    Send reminder
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
