'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    Plus,
    Search,
    MoreHorizontal,
    Copy,
    Eye,
    Download,
    Mail,
    ExternalLink,
    FileText,
    FilePenLine,
    Send,
    Clock,
    CheckCircle2,
    Loader2,
    Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Request } from '@/types';
import { useEffect, useState } from 'react';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics/events';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30', icon: CheckCircle2 },
};

export default function RequestsPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);
    const [sendingReminderRequestId, setSendingReminderRequestId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchRequests() {
            try {
                const response = await fetch('/api/requests');
                if (response.ok) {
                    const data = await response.json();
                    setRequests(data.data || []);
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            }
        }

        fetchRequests();
    }, []);

    const filteredRequests = requests.filter((request) => {
        const matchesSearch =
            request.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
            request.seller_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const copyLink = (token: string) => {
        if (!token) return;
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

    const handleSendReminder = async (requestId: string) => {
        setSendingReminderRequestId(requestId);
        try {
            const res = await fetch(`/api/requests/${requestId}/remind`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                toast.error(data.error || 'Failed to send reminder');
                return;
            }

            toast.success('Reminder sent');
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder. Please try again.');
        } finally {
            setSendingReminderRequestId(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Requests</h1>
                    <p className="text-muted-foreground mt-1">All utility sheet requests</p>
                </div>
                <Link href="/dashboard/requests/new">
                    <Button
                        data-testid="requests-new-request"
                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 dark:from-sky-500 dark:to-sky-600 dark:hover:from-sky-600 dark:hover:to-sky-700 text-white shadow-lg shadow-slate-500/20 dark:shadow-sky-500/20"
                        onClick={() =>
                            trackEvent('new_request_started', {
                                source: 'requests_header_button',
                                location: 'requests_page',
                            })
                        }
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <Card className="border-border bg-card/50">
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by address or seller..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full sm:w-[180px] h-11 sm:h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:focus:ring-sky-500"
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
            <Card className="border-border bg-card/50">
                <CardContent className="pt-6">
                    <div className="rounded-lg border border-border overflow-x-auto">
                        {filteredRequests.length > 0 && (
                            <div className="space-y-3 p-3 md:hidden">
                                {filteredRequests.map((request) => {
                                    const status = statusConfig[request.status];
                                    const isLocked = Boolean(request.is_locked);

                                    return (
                                        <div key={request.id} className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground truncate">{request.property_address}</p>
                                                    <p className="text-sm text-muted-foreground truncate">{request.seller_name || '—'}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {request.packet_mode === 'advanced' ? 'Advanced Utility Packet' : 'Simple Utility Sheet'}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className={`${status.color} border text-xs px-2 py-0.5 shrink-0`}>
                                                    {isLocked ? (
                                                        <Lock className="mr-1 h-3.5 w-3.5" />
                                                    ) : (
                                                        <status.icon className="mr-1 h-3.5 w-3.5" />
                                                    )}
                                                    {isLocked ? 'Locked' : status.label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">
                                                    Closing: {request.closing_date ? format(new Date(request.closing_date), 'MMM d, yyyy') : '—'}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {request.can_edit_submitted_sheet && !isLocked && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.open(`/dashboard/requests/${request.id}/edit`, '_self')}
                                                        >
                                                            <FilePenLine className="mr-1.5 h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(`/dashboard/requests/${request.id}`, '_self')}
                                                    >
                                                        <Eye className="mr-1.5 h-4 w-4" />
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className={filteredRequests.length > 0 ? 'hidden md:block' : ''}>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Property</TableHead>
                                    <TableHead className="text-muted-foreground hidden md:table-cell">Seller</TableHead>
                                    <TableHead className="text-muted-foreground hidden md:table-cell">Closing Date</TableHead>
                                    <TableHead className="text-muted-foreground hidden lg:table-cell">Created</TableHead>
                                    <TableHead className="text-muted-foreground">Status</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            No requests match your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const status = statusConfig[request.status];
                                        const isLocked = Boolean(request.is_locked);
                                        return (
                                            <TableRow key={request.id} className="border-border hover:bg-muted/30">
                                                <TableCell className="py-3 sm:py-4">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-foreground text-sm sm:text-base truncate max-w-[180px] sm:max-w-none">
                                                            {request.property_address}
                                                        </p>
                                                        <p className="text-xs sm:text-sm text-muted-foreground md:hidden truncate">
                                                            {request.seller_name || '—'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {request.packet_mode === 'advanced' ? 'Advanced' : 'Simple'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                    {request.seller_name || '—'}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground">
                                                    {request.closing_date
                                                        ? format(new Date(request.closing_date), 'MMM d, yyyy')
                                                        : '—'
                                                    }
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                                                    {format(new Date(request.created_at), 'MMM d, yyyy')}
                                                </TableCell>
                                                <TableCell className="py-3 sm:py-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={`${status.color} border text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}
                                                    >
                                                        {isLocked ? (
                                                            <Lock className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                        ) : (
                                                            <status.icon className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                        )}
                                                        <span className="hidden sm:inline">{isLocked ? 'Locked' : status.label}</span>
                                                        <span className="sm:hidden">{isLocked ? 'Locked' : status.label.split(' ')[0]}</span>
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right py-3 sm:py-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-popover border-border">
                                                            {!isLocked && (
                                                                <DropdownMenuItem
                                                                    className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                    onClick={() => copyLink(request.seller_token || request.public_token || '')}
                                                                >
                                                                    <Copy className="mr-2 h-4 w-4" />
                                                                    Copy seller link
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                onClick={() => window.open(`/dashboard/requests/${request.id}`, '_self')}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View details
                                                            </DropdownMenuItem>
                                                            {!isLocked && request.can_edit_submitted_sheet && (
                                                                <DropdownMenuItem
                                                                    className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                    onClick={() => window.open(`/dashboard/requests/${request.id}/edit`, '_self')}
                                                                >
                                                                    <FilePenLine className="mr-2 h-4 w-4" />
                                                                    Edit submitted sheet
                                                                </DropdownMenuItem>
                                                            )}
                                                            {!isLocked && request.status === 'submitted' && (
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
                                                            {!isLocked && ['sent', 'in_progress'].includes(request.status) && (
                                                                <DropdownMenuItem
                                                                    className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                    onClick={() => handleSendReminder(request.id)}
                                                                    disabled={!request.seller_email || sendingReminderRequestId === request.id}
                                                                >
                                                                    {sendingReminderRequestId === request.id ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Mail className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    {sendingReminderRequestId === request.id ? 'Sending...' : 'Send reminder'}
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
