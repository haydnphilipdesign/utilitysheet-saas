'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Loader2, Mail, Download, Lock, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { DeleteRequestDialog } from '@/components/requests/DeleteRequestDialog';
import { ReopenRequestDialog } from '@/components/requests/ReopenRequestDialog';
import type { Request } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { ADVANCED_MODULE_DEFAULTS, PACKET_MODE_LABELS } from '@/lib/packet/modules';
import { trackEvent } from '@/lib/analytics/events';

function FieldValue({ value }: { value?: string | null }) {
    if (value) {
        return <p className="text-foreground">{value}</p>;
    }
    return <p className="text-muted-foreground/70 italic">Not provided</p>;
}

export default function RequestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [request, setRequest] = useState<(Request & { can_edit_submitted_sheet?: boolean }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [updatingMode, setUpdatingMode] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [reopenOpen, setReopenOpen] = useState(false);
    const [closingReopen, setClosingReopen] = useState(false);

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
                toast.error(data.error || 'We couldn’t send the reminder. Try again.');
                return;
            }
            toast.success('Reminder sent');
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('We couldn’t send the reminder. Try again.');
        } finally {
            setSendingReminder(false);
        }
    };

    const handleCloseReopen = async () => {
        if (!request) return;
        setClosingReopen(true);
        try {
            const res = await fetch(`/api/requests/${request.id}/reopen`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'We couldn’t close the request. Try again.');
                return;
            }
            // Editing access comes from the plan check on a fresh load.
            const refreshed = await fetch(`/api/requests/${request.id}`);
            setRequest(refreshed.ok ? await refreshed.json() : data);
            toast.success('Closed. The sheet is available again, unchanged.');
        } catch (error) {
            console.error('Error closing reopened request:', error);
            toast.error('We couldn’t close the request. Try again.');
        } finally {
            setClosingReopen(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!request) return;
        setDownloadingPdf(true);
        try {
            await generatePacketPdf(request.public_token);
            toast.success('PDF downloaded');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('We couldn’t create the PDF. Try again.');
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleSwitchMode = async (nextMode: 'simple' | 'advanced') => {
        if (!request) return;
        setUpdatingMode(true);
        trackEvent('mode_switch_attempted', {
            location: 'request_details',
            from_mode: (request.packet_mode || 'simple') as 'simple' | 'advanced',
            to_mode: nextMode,
        });
        try {
            const response = await fetch(`/api/requests/${request.id}/configuration`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packetMode: nextMode,
                    advancedModules: nextMode === 'advanced'
                        ? ((request.advanced_modules && request.advanced_modules.length > 0)
                            ? request.advanced_modules
                            : ADVANCED_MODULE_DEFAULTS)
                        : [],
                    advancedModuleExclusions: nextMode === 'advanced'
                        ? (request.advanced_module_exclusions || {})
                        : {},
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                trackEvent('mode_switch_blocked', {
                    location: 'request_details',
                    from_mode: (request.packet_mode || 'simple') as 'simple' | 'advanced',
                    to_mode: nextMode,
                    reason: data?.error || 'request_failed',
                });
                toast.error(data?.message || data?.error || 'We couldn’t change the sheet type. Try again.');
                return;
            }
            setRequest(data);
            toast.success(nextMode === 'advanced'
                ? `Switched to ${PACKET_MODE_LABELS.advanced}`
                : `Switched to ${PACKET_MODE_LABELS.simple}`);
        } catch (error) {
            console.error('Error switching request mode:', error);
            toast.error('We couldn’t change the sheet type. Try again.');
        } finally {
            setUpdatingMode(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

    const isLocked = Boolean(request.is_locked);
    const packetMode = request.packet_mode || 'simple';
    const modeSwitchAllowed = !isLocked && (request.status === 'draft' || request.status === 'sent');
    const canRemind = !isLocked && (request.status === 'sent' || request.status === 'in_progress') && !!request.seller_email;
    const canViewPacket = !isLocked && request.status === 'submitted';
    const canReopen = canViewPacket && request.is_demo !== true;
    // Reopened by a coordinator and waiting for the seller to submit again.
    const isReopened = !isLocked && request.status === 'in_progress' && Number(request.seller_edit_version ?? 0) > 0;
    const deleteDialog = (
        <DeleteRequestDialog
            request={deleteOpen ? request : null}
            onClose={() => setDeleteOpen(false)}
            onDeleted={() => {
                setDeleteOpen(false);
                router.push('/dashboard/requests');
            }}
        />
    );

    if (isLocked) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                {deleteDialog}
                <div className="space-y-2">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground px-0"
                        onClick={() => router.push('/dashboard/requests')}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Requests
                    </Button>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Your seller submitted. Upgrade to see it.</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Your seller filled out this form, but it arrived after you had used this month’s free submitted sheets. Upgrade to Pro to see their answers, download the utility sheet, and edit submitted sheets from the dashboard.
                    </p>
                </div>

                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
                                <Lock className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">This submission is locked</p>
                                <p className="text-sm text-muted-foreground">
                                    Created {format(new Date(request.created_at), 'MMMM d, yyyy')}. Your seller&apos;s answers are saved. Upgrade any time to unlock them.
                                </p>
                            </div>
                        </div>
                        <Separator className="bg-border" />
                        <div className="space-y-2.5">
                            {[
                                'See the utility providers your seller submitted',
                                'Download the PDF with your branding',
                                'Correct details on submitted sheets from the dashboard',
                                'Unlimited submitted sheets from now on, with no monthly limit',
                            ].map((item) => (
                                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
                                    </div>
                                    {item}
                                </div>
                            ))}
                        </div>
                        <Button
                            className="w-full sm:w-auto font-semibold px-8"
                            onClick={() => router.push('/dashboard/settings?tab=billing')}
                        >
                            Upgrade to Pro, $9/month
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteOpen(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete request
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const sellerLinkRow = (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Seller link</p>
                <p className="text-sm text-foreground truncate">{sellerLink}</p>
            </div>
            <div className="flex gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="outline"
                    className="border-input"
                    aria-label="Copy seller link"
                    onClick={() => copyToClipboard(sellerLink, 'Seller link copied')}
                >
                    <Copy className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="border-input"
                    aria-label="Open seller link in a new tab"
                    onClick={() => window.open(sellerLink, '_blank')}
                >
                    <ExternalLink className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
    const infoSheetLinkRow = (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Utility sheet</p>
                <p className="text-sm text-foreground truncate">
                    {canViewPacket ? packetLink : 'Available once the seller submits'}
                </p>
            </div>
            <div className="flex gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="outline"
                    className="border-input"
                    aria-label="Copy sheet link"
                    onClick={() => copyToClipboard(packetLink, 'Sheet link copied')}
                    disabled={!canViewPacket}
                >
                    <Copy className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="border-input"
                    aria-label="Open sheet in a new tab"
                    onClick={() => window.open(packetLink, '_blank')}
                    disabled={!canViewPacket}
                >
                    <ExternalLink className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {deleteDialog}
            <ReopenRequestDialog
                request={reopenOpen ? request : null}
                onClose={() => setReopenOpen(false)}
                onReopened={(updated) => {
                    setReopenOpen(false);
                    setRequest({ ...updated, can_edit_submitted_sheet: false });
                }}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground px-0"
                        onClick={() => router.push('/dashboard/requests')}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Requests
                    </Button>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">{request.property_address}</h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <StatusBadge status={request.status} />
                        <Badge variant="outline" className="border-border text-foreground">
                            {PACKET_MODE_LABELS[packetMode]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            Created {format(new Date(request.created_at), 'MMMM d, yyyy')}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {/* Once the sheet exists, sharing it is the next step; the seller link stays in Links below. */}
                    {canViewPacket ? (
                        <Button
                            variant="outline"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={() => copyToClipboard(packetLink, 'Sheet link copied')}
                            disabled={!packetLink}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy sheet link
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={() => copyToClipboard(sellerLink, 'Seller link copied')}
                            disabled={!sellerLink}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy seller link
                        </Button>
                    )}
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
                            {sendingReminder ? 'Sending…' : 'Send reminder'}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="border-input text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                </div>
            </div>

            {isReopened && (
                <div
                    role="status"
                    data-testid="request-reopened-notice"
                    className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Reopened for the seller</p>
                        <p className="text-sm text-muted-foreground">
                            The seller can change their answers again, starting from the current sheet. The sheet link and PDF are unavailable until the seller submits again. Their new answers will replace the sheet.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="shrink-0 border-input text-foreground hover:bg-muted"
                        onClick={handleCloseReopen}
                        disabled={closingReopen}
                    >
                        {closingReopen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {closingReopen ? 'Closing…' : 'Close Without Changes'}
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-border bg-card/50 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-foreground">Seller details</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Contact details, links and sheet type
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Name</p>
                                <FieldValue value={request.seller_name} />
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Email</p>
                                <FieldValue value={request.seller_email} />
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Phone</p>
                                <FieldValue value={request.seller_phone} />
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Closing date</p>
                                <FieldValue value={request.closing_date ? format(new Date(request.closing_date), 'MMM d, yyyy') : null} />
                            </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Links</p>
                            <div className="space-y-2">
                                {canViewPacket ? (
                                    <>
                                        {infoSheetLinkRow}
                                        {sellerLinkRow}
                                    </>
                                ) : (
                                    <>
                                        {sellerLinkRow}
                                        {infoSheetLinkRow}
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator className="bg-border" />
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Sheet type</p>
                            {modeSwitchAllowed ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant={packetMode === 'simple' ? 'default' : 'outline'}
                                        className={packetMode === 'simple' ? undefined : 'border-input text-foreground'}
                                        disabled={updatingMode || packetMode === 'simple'}
                                        onClick={() => handleSwitchMode('simple')}
                                    >
                                        {PACKET_MODE_LABELS.simple}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={packetMode === 'advanced' ? 'default' : 'outline'}
                                        className={packetMode === 'advanced' ? undefined : 'border-input text-foreground'}
                                        disabled={updatingMode || packetMode === 'advanced'}
                                        onClick={() => handleSwitchMode('advanced')}
                                    >
                                        {PACKET_MODE_LABELS.advanced}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    The sheet type can’t be changed once the seller has opened the request.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-foreground">Actions</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Review, edit and download
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            className="w-full"
                            onClick={handleDownloadPdf}
                            disabled={!canViewPacket || downloadingPdf}
                        >
                            {downloadingPdf ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            {downloadingPdf ? 'Generating…' : 'Download PDF'}
                        </Button>

                        {canViewPacket ? (
                            <Link href={`/packet/${request.public_token}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" className="w-full border-input text-foreground hover:bg-muted">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open sheet
                                </Button>
                            </Link>
                        ) : (
                            <Button variant="outline" className="w-full border-input text-muted-foreground" disabled>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open sheet
                            </Button>
                        )}

                        {request.can_edit_submitted_sheet ? (
                            <Link href={`/dashboard/requests/${request.id}/edit`}>
                                <Button variant="outline" className="w-full border-input text-foreground hover:bg-muted">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit sheet
                                </Button>
                            </Link>
                        ) : request.status === 'submitted' ? (
                            <p className="text-xs text-muted-foreground">
                                Editing a submitted sheet is part of Pro and Teams.
                            </p>
                        ) : null}

                        {canReopen ? (
                            <div className="space-y-1.5">
                                <Button
                                    variant="outline"
                                    className="w-full border-input text-foreground hover:bg-muted"
                                    onClick={() => setReopenOpen(true)}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reopen for Seller
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Lets the seller correct their answers. It doesn’t count as another submitted sheet.
                                </p>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
