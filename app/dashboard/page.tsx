'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import {
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle,
    Send,
    Plus,
    Search,
    MoreHorizontal,
    Copy,
    Eye,
    Download,
    Mail,
    ExternalLink,
} from 'lucide-react';
import type { Request, DashboardStats } from '@/types';
import { format } from 'date-fns';

// Mock data for demo
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

const mockStats: DashboardStats = {
    total_requests: 47,
    draft: 5,
    sent: 12,
    in_progress: 8,
    submitted: 22,
    needs_attention: 3,
};

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

export default function DashboardPage() {
    const [requests, setRequests] = useState<Request[]>(mockRequests);
    const [stats, setStats] = useState<DashboardStats>(mockStats);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const filteredRequests = requests.filter((request) =>
        request.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.seller_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(link);
        // TODO: Add toast notification
    };

    const statCards = [
        { label: 'Total Requests', value: stats.total_requests, icon: FileText, color: 'text-zinc-400' },
        { label: 'Pending', value: stats.sent + stats.in_progress, icon: Clock, color: 'text-blue-400' },
        { label: 'Completed', value: stats.submitted, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: 'Needs Attention', value: stats.needs_attention, icon: AlertCircle, color: 'text-amber-400' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-zinc-400 mt-1">Manage your utility sheet requests</p>
                </div>
                <Link href="/dashboard/requests/new">
                    <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Button>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.label} className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-500">{stat.label}</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl bg-zinc-800/50 ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Requests Table */}
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-white">Recent Requests</CardTitle>
                            <CardDescription className="text-zinc-400">
                                Your utility sheet requests and their status
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search by address or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-zinc-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Property</TableHead>
                                    <TableHead className="text-zinc-400 hidden md:table-cell">Seller</TableHead>
                                    <TableHead className="text-zinc-400 hidden lg:table-cell">Closing Date</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                                            {searchQuery ? 'No requests match your search' : 'No requests yet. Create your first one!'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const status = statusConfig[request.status];
                                        return (
                                            <TableRow key={request.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-white">{request.property_address}</p>
                                                        <p className="text-sm text-zinc-500 md:hidden">
                                                            {request.seller_name || 'No seller info'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-zinc-300">
                                                    {request.seller_name || '—'}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-zinc-300">
                                                    {request.closing_date
                                                        ? format(new Date(request.closing_date), 'MMM d, yyyy')
                                                        : '—'
                                                    }
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
