'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, ExternalLink, Loader2, Mail, Download } from 'lucide-react';
import type { Request } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generatePacketPdf } from '@/lib/pdf-generator';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border' },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    submitted: { label: 'Submitted', color: 'bg-slate-600/20 text-slate-500 border-emerald-500/30' },
} as const;

export default function RequestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [request, setRequest] = useState<Request | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    const sellerToken = request?.seller_token || request?.public_token || '';
    const sellerLink = useMemo(() => {
        if (!sellerToken) return '';
        return `${window.location.origin}/s/${sellerToken}`;
    }, [sellerToken]);

    const packetLink = useMemo(() => {
        if (!request?.public_token) return '';
        return `${window.location.origin}/packet/${request.public_token}`;
    }, [request?.public_token]);

    useEffect(() => {
        let canceled = false;
        async function fetchRequest() {
            setLoading(true);
            try {
                const res = await fetch(`/api/requests/${resolvedParams.id}`);
                if (!res.ok) {
                    if (!canceled) setRequest(null);
                    return;
                }
                const data = await res.json();
                if (!canceled) setRequest(data);
            } catch (error) {
                console.error('Error fetching request:', error);
                if (!canceled) setRequest(null);
            } finally {
                if (!canceled) setLoading(false);
            }
        }

        fetchRequest();
        return () => {
            canceled = true;
        };
    }, [resolvedParams.id]);

    const copyToClipboard = async (value: string, successMessage: string) => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        toast.success(successMessage);
    };

    const handleSendReminder = async () => {
        if (!request) return;
        setSendingReminder(true);
        try {
            const res = await fetch(`/api/requests/${request.id}/remind`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'Failed to send reminder');
                return;
            }
            toast.success('Reminder sent');
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder');
        } finally {
            setSendingReminder(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!request) return;
        setDownloadingPdf(true);
        try {
            await generatePacketPdf(request.public_token);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdf(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!request) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => router.push('/dashboard/requests')}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Requests
                </Button>
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-foreground">Request not found</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            This request may have been deleted or you may not have access.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const status = statusConfig[request.status] || statusConfig.draft;
    const canRemind = (request.status === 'sent' || request.status === 'in_progress') && !!request.seller_email;
    const canViewPacket = request.status === 'submitted';

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground px-0"
                        onClick={() => router.push('/dashboard/requests')}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Requests
                    </Button>
                    <h1 className="text-3xl font-bold text-foreground">{request.property_address}</h1>
                    <div className="flex items-center gap-3">
                        <Badge className={status.color}>{status.label}</Badge>
                        <span className="text-sm text-muted-foreground">
                            Created {format(new Date(request.created_at), 'MMMM d, yyyy')}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        className="border-input text-foreground hover:bg-muted"
                        onClick={() => copyToClipboard(sellerLink, 'Seller link copied')}
                        disabled={!sellerLink}
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Seller Link
                    </Button>
                    {canRemind && (
                        <Button
                            variant="outline"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={handleSendReminder}
                            disabled={sendingReminder}
                        >
                            {sendingReminder ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Mail className="mr-2 h-4 w-4" />
                            )}
                            {sendingReminder ? 'Sending...' : 'Send Reminder'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-border bg-card/50 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-foreground">Seller Details</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Contact info and intake status
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Name</p>
                                <p className="text-foreground">{request.seller_name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Email</p>
                                <p className="text-foreground">{request.seller_email || '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Phone</p>
                                <p className="text-foreground">{request.seller_phone || '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Closing date</p>
                                <p className="text-foreground">
                                    {request.closing_date ? format(new Date(request.closing_date), 'MMM d, yyyy') : '—'}
                                </p>
                            </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Links</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Seller form</p>
                                        <p className="text-sm text-foreground truncate">{sellerLink}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-input"
                                            onClick={() => copyToClipboard(sellerLink, 'Seller link copied')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-input"
                                            onClick={() => window.open(sellerLink, '_blank')}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Utility info sheet</p>
                                        <p className="text-sm text-foreground truncate">
                                            {canViewPacket ? packetLink : 'Available after seller submission'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-input"
                                            onClick={() => copyToClipboard(packetLink, 'Info sheet link copied')}
                                            disabled={!canViewPacket}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-input"
                                            onClick={() => window.open(packetLink, '_blank')}
                                            disabled={!canViewPacket}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-foreground">Actions</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Share and export
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                            onClick={handleDownloadPdf}
                            disabled={!canViewPacket || downloadingPdf}
                        >
                            {downloadingPdf ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            {downloadingPdf ? 'Generating...' : 'Download PDF'}
                        </Button>

                        {canViewPacket ? (
                            <Link href={`/packet/${request.public_token}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" className="w-full border-input text-foreground hover:bg-muted">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Info Sheet
                                </Button>
                            </Link>
                        ) : (
                            <Button variant="outline" className="w-full border-input text-muted-foreground" disabled>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Info Sheet
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

