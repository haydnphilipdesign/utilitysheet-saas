'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { RequestStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUpDown, ExternalLink, Mail, Pencil } from 'lucide-react';
import {
    sendSellerReminderAdminAction,
    updateRequestSellerAdminAction,
    updateRequestStatusAdminAction,
} from '@/app/(admin)/admin/requests/actions';

const requestStatuses: RequestStatus[] = ['draft', 'sent', 'in_progress', 'submitted'];

function formatStatusLabel(status: RequestStatus) {
    switch (status) {
        case 'in_progress':
            return 'In progress';
        default:
            return status.charAt(0).toUpperCase() + status.slice(1);
    }
}

function getStatusBadgeVariant(status: RequestStatus) {
    if (status === 'submitted') return 'default' as const;
    if (status === 'in_progress') return 'secondary' as const;
    return 'outline' as const;
}

type RequestAdminActionsProps = {
    request: {
        id: string;
        status: RequestStatus;
        property_address: string;
        seller_name: string | null;
        seller_email: string | null;
        seller_phone: string | null;
        seller_token: string | null;
        public_token: string;
    };
};

export function RequestAdminActions({ request }: RequestAdminActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const sellerLinkPath = useMemo(() => {
        const token = request.seller_token || request.public_token;
        return `/s/${token}`;
    }, [request.public_token, request.seller_token]);

    const [statusOpen, setStatusOpen] = useState(false);
    const [statusValue, setStatusValue] = useState<RequestStatus>(request.status);
    const [statusReason, setStatusReason] = useState('');

    const [sellerOpen, setSellerOpen] = useState(false);
    const [sellerName, setSellerName] = useState(request.seller_name || '');
    const [sellerEmail, setSellerEmail] = useState(request.seller_email || '');
    const [sellerPhone, setSellerPhone] = useState(request.seller_phone || '');
    const [sellerReason, setSellerReason] = useState('');

    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderReason, setReminderReason] = useState('');

    const statusReasonOk = statusReason.trim().length >= 3;
    const sellerReasonOk = sellerReason.trim().length >= 3;
    const reminderReasonOk = reminderReason.trim().length >= 3;

    return (
        <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Support actions</CardTitle>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                        {formatStatusLabel(request.status)}
                    </Badge>
                    <Link href={sellerLinkPath} target="_blank" rel="noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open seller flow
                        </Button>
                    </Link>
                </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                        Status corrections, seller contact edits, and reminder sends are live Admin writes and are audited.
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setStatusValue(request.status);
                                setStatusReason('');
                                setStatusOpen(true);
                            }}
                            disabled={isPending}
                        >
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Change Status
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setSellerName(request.seller_name || '');
                                setSellerEmail(request.seller_email || '');
                                setSellerPhone(request.seller_phone || '');
                                setSellerReason('');
                                setSellerOpen(true);
                            }}
                            disabled={isPending}
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Seller Info
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setReminderReason('');
                                setReminderOpen(true);
                            }}
                            disabled={isPending || !request.seller_email}
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Send seller reminder
                        </Button>
                    </div>
                </div>

                {/* Status dialog */}
                <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Change request status</DialogTitle>
                            <DialogDescription>
                                This writes to production data and is logged in audit logs.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                                Request: <span className="font-mono">{request.id}</span>
                            </div>

                            <label className="text-xs text-muted-foreground">New status</label>
                            <select
                                value={statusValue}
                                onChange={(e) => setStatusValue(e.target.value as RequestStatus)}
                                className="h-7 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                                disabled={isPending}
                            >
                                {requestStatuses.map((s) => (
                                    <option key={s} value={s}>
                                        {formatStatusLabel(s)}
                                    </option>
                                ))}
                            </select>

                            <Textarea
                                placeholder="Reason (required)..."
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    const reason = statusReason.trim();
                                    if (reason.length < 3) {
                                        toast.error('Please add a short reason (min 3 characters).');
                                        return;
                                    }

                                    startTransition(async () => {
                                        const result = await updateRequestStatusAdminAction(request.id, statusValue, reason);
                                        if (!result.success) {
                                            toast.error(result.error || 'Failed to update status');
                                            return;
                                        }
                                        toast.success('Request status updated');
                                        setStatusOpen(false);
                                        setStatusReason('');
                                        router.refresh();
                                    });
                                }}
                                disabled={!statusReasonOk || isPending || statusValue === request.status}
                            >
                                Update Status
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Seller edit dialog */}
                <Dialog open={sellerOpen} onOpenChange={setSellerOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Edit seller info</DialogTitle>
                            <DialogDescription>
                                Update seller contact details for this request. Changes are audited.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <Input
                                placeholder="Seller name"
                                value={sellerName}
                                onChange={(e) => setSellerName(e.target.value)}
                                disabled={isPending}
                            />
                            <Input
                                placeholder="Seller email"
                                value={sellerEmail}
                                onChange={(e) => setSellerEmail(e.target.value)}
                                disabled={isPending}
                            />
                            <Input
                                placeholder="Seller phone"
                                value={sellerPhone}
                                onChange={(e) => setSellerPhone(e.target.value)}
                                disabled={isPending}
                            />
                            <Textarea
                                placeholder="Reason (required)..."
                                value={sellerReason}
                                onChange={(e) => setSellerReason(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSellerOpen(false)} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    const reason = sellerReason.trim();
                                    if (reason.length < 3) {
                                        toast.error('Please add a short reason (min 3 characters).');
                                        return;
                                    }

                                    startTransition(async () => {
                                        const result = await updateRequestSellerAdminAction(
                                            request.id,
                                            {
                                                sellerName,
                                                sellerEmail,
                                                sellerPhone,
                                            },
                                            reason
                                        );
                                        if (!result.success) {
                                            toast.error(result.error || 'Failed to update seller info');
                                            return;
                                        }
                                        toast.success('Seller info updated');
                                        setSellerOpen(false);
                                        setSellerReason('');
                                        router.refresh();
                                    });
                                }}
                                disabled={!sellerReasonOk || isPending}
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Reminder dialog */}
                <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Send reminder email</DialogTitle>
                            <DialogDescription>
                                Sends a reminder email to the seller and logs an event + audit entry.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                                To: <span className="text-foreground font-medium">{request.seller_email || '—'}</span>
                            </div>
                            <Textarea
                                placeholder="Reason (required)..."
                                value={reminderReason}
                                onChange={(e) => setReminderReason(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setReminderOpen(false)} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    const reason = reminderReason.trim();
                                    if (reason.length < 3) {
                                        toast.error('Please add a short reason (min 3 characters).');
                                        return;
                                    }

                                    startTransition(async () => {
                                        const result = await sendSellerReminderAdminAction(request.id, reason);
                                        if (!result.success) {
                                            toast.error(result.error || 'Failed to send reminder');
                                            return;
                                        }
                                        toast.success('Reminder sent');
                                        setReminderOpen(false);
                                        setReminderReason('');
                                        router.refresh();
                                    });
                                }}
                                disabled={!request.seller_email || !reminderReasonOk || isPending}
                            >
                                Send Email
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
