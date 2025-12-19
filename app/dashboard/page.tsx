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
    Loader2,
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
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [requestsRes, statsRes] = await Promise.all([
                    fetch('/api/requests'),
                    fetch('/api/requests?stats=true')
                ]);

                if (requestsRes.ok) {
                    const data = await requestsRes.json();
                    setRequests(data);
                }

                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
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
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            {searchQuery ? 'No requests match your search' : 'No requests yet. Create your first one!'}
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
