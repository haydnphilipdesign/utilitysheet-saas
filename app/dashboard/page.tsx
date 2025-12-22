'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
    Loader2,
    Trash2,
} from 'lucide-react';
import type { Request, DashboardStats } from '@/types';
import { format } from 'date-fns';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

export default function DashboardPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [meta, setMeta] = useState({
        total: 0,
        page: 1,
        totalPages: 1,
        limit: 10
    });
    const [stats, setStats] = useState<DashboardStats>({
        total_requests: 0,
        draft: 0,
        sent: 0,
        in_progress: 0,
        submitted: 0,
        needs_attention: 0,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchRequests() {
            setLoading(true);
            try {
                const requestsRes = await fetch(`/api/requests?page=${currentPage}&limit=10`);
                if (requestsRes.ok) {
                    const data = await requestsRes.json();
                    setRequests(data.data);
                    setMeta({
                        total: data.total,
                        page: data.page,
                        totalPages: data.totalPages,
                        limit: data.limit
                    });
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchRequests();
    }, [currentPage]);

    useEffect(() => {
        async function fetchStats() {
            try {
                const statsRes = await fetch('/api/requests?stats=true');
                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            }
        }

        fetchStats();
    }, []);

    const filteredRequests = requests.filter((request) =>
        request.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.seller_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(link);
        toast.success('Link copied to clipboard');
    };

    const handleDownloadPdf = async (token: string) => {
        setDownloadingPdfToken(token);
        try {
            await generatePacketPdf(token);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdfToken(null);
        }
    };

    const handleSendReminder = async (id: string, sellerName?: string) => {
        setSendingReminderId(id);
        try {
            const response = await fetch(`/api/requests/${id}/remind`, {
                method: 'POST',
            });
            const data = await response.json();

            if (response.ok) {
                toast.success(`Reminder sent to ${sellerName || 'seller'}`);
            } else {
                toast.error(data.error || 'Failed to send reminder');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder. Please try again.');
        } finally {
            setSendingReminderId(null);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
            return;
        }

        setDeletingId(id);
        try {
            const response = await fetch(`/api/requests/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Request deleted successfully');
                // Update local state to remove the request
                setRequests(prev => prev.filter(req => req.id !== id));
                // Update stats
                setStats(prev => ({
                    ...prev,
                    total_requests: prev.total_requests - 1,
                    // Note: We don't know exactly which status it was without more logic, 
                    // but usually total_requests is enough for the brief dashboard refresh.
                    // A full re-fetch of stats might be better if we want exact numbers.
                }));
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to delete request');
            }
        } catch (error) {
            console.error('Error deleting request:', error);
            toast.error('Failed to delete request. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const statCards = [
        { label: 'Total Requests', value: stats.total_requests, icon: FileText, color: 'text-muted-foreground' },
        { label: 'Pending', value: stats.sent + stats.in_progress, icon: Clock, color: 'text-blue-400' },
        { label: 'Completed', value: stats.submitted, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: 'Needs Attention', value: stats.needs_attention, icon: AlertCircle, color: 'text-amber-400' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Manage your utility sheet requests</p>
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
                    <Card key={stat.label} className="border-border bg-card/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Requests Table */}
            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-foreground">Recent Requests</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Your utility sheet requests and their status
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by address or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Property</TableHead>
                                    <TableHead className="text-muted-foreground hidden md:table-cell">Seller</TableHead>
                                    <TableHead className="text-muted-foreground hidden lg:table-cell">Closing Date</TableHead>
                                    <TableHead className="text-muted-foreground">Status</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20 px-4">
                                            <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                <div className="relative mb-6">
                                                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                                                    <img
                                                        src="/utility_sheet_empty_state_illustration_1766440263415.png"
                                                        alt="No requests"
                                                        className="relative w-48 h-48 object-contain"
                                                    />
                                                </div>
                                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                                    {searchQuery ? 'No matching requests' : 'Ready to streamline your workflow?'}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mb-8">
                                                    {searchQuery
                                                        ? `We couldn't find any requests matching "${searchQuery}". Try a different search term.`
                                                        : "You haven't created any requests yet. Start by sending a link to your seller to collect their utility information."}
                                                </p>
                                                {!searchQuery && (
                                                    <Link href="/dashboard/requests/new">
                                                        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            Create First Request
                                                        </Button>
                                                    </Link>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const status = statusConfig[request.status];
                                        return (
                                            <TableRow key={request.id} className="border-border hover:bg-muted/30">
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-foreground">{request.property_address}</p>
                                                        <p className="text-sm text-muted-foreground md:hidden">
                                                            {request.seller_name || 'No seller info'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                    {request.seller_name || '—'}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-muted-foreground">
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
                                                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-popover border-border">
                                                            <DropdownMenuItem
                                                                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                onClick={() => copyLink(request.public_token)}
                                                            >
                                                                <Copy className="mr-2 h-4 w-4" />
                                                                Copy seller link
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                onClick={() => window.open(`/s/${request.public_token}`, '_blank')}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View details
                                                            </DropdownMenuItem>
                                                            {request.status === 'submitted' && (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                        onClick={() => window.open(`/packet/${request.public_token}`, '_blank')}
                                                                    >
                                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                                        View info sheet
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                        onClick={() => handleDownloadPdf(request.public_token)}
                                                                        disabled={downloadingPdfToken === request.public_token}
                                                                    >
                                                                        {downloadingPdfToken === request.public_token ? (
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Download className="mr-2 h-4 w-4" />
                                                                        )}
                                                                        {downloadingPdfToken === request.public_token ? 'Generating...' : 'Download PDF'}
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {['sent', 'in_progress'].includes(request.status) && (
                                                                <DropdownMenuItem
                                                                    className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                    disabled={sendingReminderId === request.id}
                                                                    onClick={() => handleSendReminder(request.id, request.seller_name || undefined)}
                                                                >
                                                                    {sendingReminderId === request.id ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Mail className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    {sendingReminderId === request.id ? 'Sending...' : 'Send reminder'}
                                                                </DropdownMenuItem>
                                                            )}
                                                            <Separator className="my-1 bg-border" />
                                                            <DropdownMenuItem
                                                                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                                                disabled={deletingId === request.id}
                                                                onClick={() => handleDeleteRequest(request.id)}
                                                            >
                                                                {deletingId === request.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                )}
                                                                {deletingId === request.id ? 'Deleting...' : 'Delete request'}
                                                            </DropdownMenuItem>
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

                    {/* Pagination */}
                    {meta.totalPages > 1 && (
                        <div className="flex items-center justify-between px-2 py-4 border-t border-border mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{((meta.page - 1) * meta.limit) + 1}</span> to <span className="font-medium text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-medium text-foreground">{meta.total}</span> results
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="border-border text-foreground hover:bg-muted"
                                >
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(pageNum => (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 p-0 ${currentPage === pageNum ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-muted-foreground'}`}
                                        >
                                            {pageNum}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(meta.totalPages, prev + 1))}
                                    disabled={currentPage === meta.totalPages}
                                    className="border-border text-foreground hover:bg-muted"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
