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
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Request } from '@/types';
import { useEffect, useState } from 'react';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

export default function RequestsPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);

    useEffect(() => {
        async function fetchRequests() {
            try {
                const response = await fetch('/api/requests');
                if (response.ok) {
                    const data = await response.json();
                    setRequests(data);
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Requests</h1>
                    <p className="text-muted-foreground mt-1">All utility sheet requests</p>
                </div>
                <Link href="/dashboard/requests/new">
                    <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
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
                            className="w-full sm:w-[180px] h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Property</TableHead>
                                    <TableHead className="text-muted-foreground">Seller</TableHead>
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
                                        return (
                                            <TableRow key={request.id} className="border-border hover:bg-muted/30">
                                                <TableCell>
                                                    <p className="font-medium text-foreground">{request.property_address}</p>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
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
                                                                        View packet
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
                                                                    onClick={() => {
                                                                        // TODO: Implement reminder functionality
                                                                        console.log('Sending reminder to:', request.seller_name);
                                                                    }}
                                                                >
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
