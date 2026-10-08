'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
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
import { ArrowUpDown, ExternalLink, Loader2, Mail, Pencil } from 'lucide-react';
import {
    getSellerReminderPreviewAdminAction,
    resolveSellerReminderAdminAction,
    sendSellerReminderAdminAction,
    updateRequestSellerAdminAction,
    updateRequestStatusAdminAction,
    type SellerReminderPreview,
} from '@/app/(admin)/admin/requests/actions';
import { allowedStatusCorrections } from '@/lib/admin/refusals';
import { formatAdminDate } from '@/lib/admin/date-format';

const REASON_MAX = 500;

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

function formatCooldown(seconds: number) {
    const minutes = Math.ceil(seconds / 60);
    return minutes <= 1 ? 'about a minute' : `about ${minutes} minutes`;
}

const OPERATION_STATE_LABELS: Record<string, string> = {
    pending: 'In progress or interrupted',
    accepted: 'Accepted by provider',
    failed: 'Not sent',
    unknown: 'Outcome unknown',
};

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
        /** A first submission was recorded (`metered_at`). */
        is_metered: boolean;
        is_deleted: boolean;
    };
};

export function RequestAdminActions({ request }: RequestAdminActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const sellerLinkPath = useMemo(() => {
        const token = request.seller_token || request.public_token;
        return `/s/${token}`;
    }, [request.public_token, request.seller_token]);

    const corrections = useMemo(
        () => allowedStatusCorrections({
            status: request.status,
            isMetered: request.is_metered,
            isDeleted: request.is_deleted,
        }),
        [request.is_deleted, request.is_metered, request.status]
    );

    const [statusOpen, setStatusOpen] = useState(false);
    const [statusValue, setStatusValue] = useState<RequestStatus | ''>('');
    const [statusReason, setStatusReason] = useState('');

    const [sellerOpen, setSellerOpen] = useState(false);
    const [sellerName, setSellerName] = useState(request.seller_name || '');
    const [sellerEmail, setSellerEmail] = useState(request.seller_email || '');
    const [sellerPhone, setSellerPhone] = useState(request.seller_phone || '');
    const [sellerReason, setSellerReason] = useState('');

    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderReason, setReminderReason] = useState('');
    const [reminderConfirmed, setReminderConfirmed] = useState(false);
    const [preview, setPreview] = useState<SellerReminderPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [operationId, setOperationId] = useState('');
    const [reminderNotice, setReminderNotice] = useState<string | null>(null);

    const statusReasonOk = statusReason.trim().length >= 3;
    const sellerReasonOk = sellerReason.trim().length >= 3;
    const reminderReasonOk = reminderReason.trim().length >= 3;

    const loadPreview = useCallback(async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        setReminderConfirmed(false);
        try {
            const result = await getSellerReminderPreviewAdminAction(request.id);
            if (!result.success) {
                setPreview(null);
                setPreviewError(result.error);
                return;
            }
            setPreview(result.preview);
            // An unresolved operation keeps its identity across refreshes and retries.
            setOperationId(result.preview.unresolved?.canRetry ? result.preview.unresolved.id : crypto.randomUUID());
        } catch {
            setPreview(null);
            setPreviewError('The preview could not be loaded. Nothing was sent.');
        } finally {
            setPreviewLoading(false);
        }
    }, [request.id]);

    const unresolved = preview?.unresolved ?? null;
    const blockedByUnresolved = Boolean(unresolved && !unresolved.canRetry);
    const coolingDown = Boolean(preview && preview.cooldownSecondsRemaining > 0 && !unresolved);
    const canSend = Boolean(
        preview?.eligible && preview.fingerprint && operationId && reminderReasonOk && reminderConfirmed
        && !blockedByUnresolved && !coolingDown && !isPending && !previewLoading
    );

    const sendReminder = () => {
        if (!preview?.fingerprint) return;
        startTransition(async () => {
            const result = await sendSellerReminderAdminAction({
                requestId: request.id,
                operationId,
                reason: reminderReason.trim(),
                confirmed: true,
                expectedFingerprint: preview.fingerprint!,
            });
            if (!result.success) {
                toast.error(result.error);
                setReminderNotice(result.error);
                await loadPreview();
                return;
            }
            if (result.state === 'accepted_unrecorded') {
                // Keep the dialog and the same operation ID so a retry only completes the record.
                toast.warning(result.message);
                setReminderNotice(result.message);
                return;
            }
            toast.success(result.message);
            setReminderOpen(false);
            setReminderReason('');
            setReminderNotice(null);
            router.refresh();
        });
    };

    const settleReminder = (resolution: 'accepted' | 'failed') => {
        if (!unresolved) return;
        startTransition(async () => {
            const result = await resolveSellerReminderAdminAction({
                operationId: unresolved.id,
                resolution,
                reason: reminderReason.trim(),
                confirmed: true,
            });
            if (!result.success) {
                toast.error(result.error);
            } else {
                toast.success(resolution === 'accepted' ? 'Recorded as sent' : 'Recorded as not sent');
                setReminderNotice(null);
                router.refresh();
            }
            await loadPreview();
        });
    };

    return (
        <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Support actions</CardTitle>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                        {formatStatusLabel(request.status)}
                    </Badge>
                    {request.is_deleted ? <Badge variant="destructive">Deleted</Badge> : null}
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
                        {request.is_deleted
                            ? 'This request was deleted. Corrections, contact edits and reminders are unavailable.'
                            : 'Status corrections, seller contact edits, and reminder sends are live Admin writes and are audited.'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setStatusValue(corrections.options[0] ?? '');
                                setStatusReason('');
                                setStatusOpen(true);
                            }}
                            disabled={isPending || request.is_deleted}
                        >
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Correct status
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
                            disabled={isPending || request.is_deleted}
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Seller Info
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setReminderReason('');
                                setReminderNotice(null);
                                setPreview(null);
                                setReminderOpen(true);
                                void loadPreview();
                            }}
                            disabled={isPending || request.is_deleted || !request.seller_email}
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
                            <DialogTitle>Correct request status</DialogTitle>
                            <DialogDescription>
                                A support correction of the displayed status. It does not record a submission, change
                                usage metering, send email or generate a sheet. The change is audited.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                                Request: <span className="font-mono break-all">{request.id}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{corrections.explanation}</p>

                            {corrections.options.length > 0 ? (
                                <>
                                    <label htmlFor="admin-status-correction" className="text-xs text-muted-foreground">
                                        New status
                                    </label>
                                    <select
                                        id="admin-status-correction"
                                        value={statusValue}
                                        onChange={(e) => setStatusValue(e.target.value as RequestStatus)}
                                        className="block h-8 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                                        disabled={isPending}
                                    >
                                        {corrections.options.map((s) => (
                                            <option key={s} value={s}>
                                                {formatStatusLabel(s)}
                                            </option>
                                        ))}
                                    </select>

                                    <Textarea
                                        aria-label="Reason for status correction"
                                        placeholder="Reason (required)..."
                                        value={statusReason}
                                        maxLength={REASON_MAX}
                                        onChange={(e) => setStatusReason(e.target.value)}
                                        disabled={isPending}
                                    />
                                </>
                            ) : null}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={isPending}>
                                {corrections.options.length > 0 ? 'Cancel' : 'Close'}
                            </Button>
                            {corrections.options.length > 0 ? (
                                <Button
                                    onClick={() => {
                                        if (!statusValue || !statusReasonOk) return;
                                        startTransition(async () => {
                                            const result = await updateRequestStatusAdminAction({
                                                requestId: request.id,
                                                status: statusValue,
                                                expectedStatus: request.status,
                                                reason: statusReason.trim(),
                                            });
                                            if (!result.success) {
                                                toast.error(result.error || 'Failed to update status');
                                                if (result.code === 'STALE' || result.code === 'NO_OP') router.refresh();
                                                return;
                                            }
                                            toast.success('Request status corrected');
                                            setStatusOpen(false);
                                            setStatusReason('');
                                            router.refresh();
                                        });
                                    }}
                                    disabled={!statusReasonOk || isPending || !statusValue}
                                >
                                    Correct status
                                </Button>
                            ) : null}
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
                                aria-label="Seller name"
                                placeholder="Seller name"
                                value={sellerName}
                                maxLength={120}
                                onChange={(e) => setSellerName(e.target.value)}
                                disabled={isPending}
                            />
                            <Input
                                aria-label="Seller email"
                                type="email"
                                placeholder="Seller email"
                                value={sellerEmail}
                                maxLength={254}
                                onChange={(e) => setSellerEmail(e.target.value)}
                                disabled={isPending}
                            />
                            <Input
                                aria-label="Seller phone"
                                placeholder="Seller phone"
                                value={sellerPhone}
                                maxLength={30}
                                onChange={(e) => setSellerPhone(e.target.value)}
                                disabled={isPending}
                            />
                            <Textarea
                                aria-label="Reason for seller contact edit"
                                placeholder="Reason (required)..."
                                value={sellerReason}
                                maxLength={REASON_MAX}
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
                                    if (!sellerReasonOk) return;
                                    startTransition(async () => {
                                        const result = await updateRequestSellerAdminAction({
                                            requestId: request.id,
                                            seller: { sellerName, sellerEmail, sellerPhone },
                                            expected: {
                                                sellerName: request.seller_name,
                                                sellerEmail: request.seller_email,
                                                sellerPhone: request.seller_phone,
                                            },
                                            reason: sellerReason.trim(),
                                        });
                                        if (!result.success) {
                                            toast.error(result.error || 'Failed to update seller info');
                                            if (result.code === 'STALE') router.refresh();
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
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Send seller reminder</DialogTitle>
                            <DialogDescription>
                                Review the exact message before sending. The attempt and its outcome are audited.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3" aria-live="polite">
                            {previewLoading ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading the exact message…
                                </p>
                            ) : null}

                            {previewError ? (
                                <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                                    {previewError}
                                </div>
                            ) : null}

                            {preview && !preview.eligible ? (
                                <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                                    {preview.ineligibleReason}
                                </div>
                            ) : null}

                            {reminderNotice ? (
                                <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                                    {reminderNotice}
                                </div>
                            ) : null}

                            {preview ? (
                                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                    <dt className="text-muted-foreground">Property</dt>
                                    <dd className="break-words text-foreground">{request.property_address}</dd>
                                    <dt className="text-muted-foreground">To</dt>
                                    <dd className="break-all font-medium text-foreground">{preview.recipient || 'Not available'}</dd>
                                    {preview.from ? (<><dt className="text-muted-foreground">From</dt><dd className="break-all text-foreground">{preview.from}</dd></>) : null}
                                    {preview.replyTo ? (<><dt className="text-muted-foreground">Reply-to</dt><dd className="break-all text-foreground">{preview.replyTo}</dd></>) : null}
                                    {preview.subject ? (<><dt className="text-muted-foreground">Subject</dt><dd className="break-words text-foreground">{preview.subject}</dd></>) : null}
                                    <dt className="text-muted-foreground">Last reminder</dt>
                                    <dd className="text-foreground">
                                        {preview.lastSentAt ? formatAdminDate(preview.lastSentAt) : 'None recorded'}
                                    </dd>
                                </dl>
                            ) : null}

                            {coolingDown && preview ? (
                                <div role="status" className="rounded-md border border-border/70 bg-secondary/30 p-3 text-xs text-foreground">
                                    A reminder was sent recently. Another can be sent in {formatCooldown(preview.cooldownSecondsRemaining)}.
                                    There is no override for the cooldown.
                                </div>
                            ) : null}

                            {unresolved ? (
                                <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                                    <p className="font-medium">
                                        An earlier reminder from {formatAdminDate(unresolved.createdAt)} is unresolved
                                        ({OPERATION_STATE_LABELS[unresolved.state]}).
                                    </p>
                                    <p className="mt-1">
                                        {unresolved.canRetry
                                            ? 'Sending below retries that same operation with the same provider key, so it cannot be delivered twice.'
                                            : 'It can no longer be retried safely. Check the email provider for this recipient, then record what happened. A reason is required.'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" onClick={() => settleReminder('accepted')} disabled={!reminderReasonOk || isPending}>
                                            Record as sent
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => settleReminder('failed')} disabled={!reminderReasonOk || isPending}>
                                            Record as not sent
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            {preview?.html ? (
                                <div>
                                    <p className="mb-1 text-xs text-muted-foreground">Exact message</p>
                                    <iframe
                                        title="Exact reminder email preview"
                                        sandbox=""
                                        srcDoc={preview.html}
                                        className="h-80 w-full rounded-md border border-border bg-white"
                                    />
                                </div>
                            ) : null}

                            {preview && preview.recent.length > 0 ? (
                                <details className="text-xs text-muted-foreground">
                                    <summary className="cursor-pointer">Recent reminder attempts ({preview.recent.length})</summary>
                                    <ul className="mt-2 space-y-1">
                                        {preview.recent.map((operation) => (
                                            <li key={operation.id}>
                                                {formatAdminDate(operation.createdAt)} · {operation.actorType === 'admin' ? 'Admin' : 'Customer'} ·{' '}
                                                {OPERATION_STATE_LABELS[operation.state]}
                                                {operation.state === 'accepted'
                                                    ? ` · delivery ${operation.deliveryStatus || 'not confirmed'}`
                                                    : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ) : null}

                            <Textarea
                                aria-label="Reason for sending or settling a reminder"
                                placeholder="Reason (required)..."
                                value={reminderReason}
                                maxLength={REASON_MAX}
                                onChange={(e) => setReminderReason(e.target.value)}
                                disabled={isPending}
                            />

                            {preview?.eligible && !blockedByUnresolved && !coolingDown ? (
                                <label className="flex items-start gap-2 text-xs text-foreground">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={reminderConfirmed}
                                        onChange={(e) => setReminderConfirmed(e.target.checked)}
                                        disabled={isPending}
                                    />
                                    <span>I reviewed the recipient and the exact message above and want to send it.</span>
                                </label>
                            ) : null}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setReminderOpen(false)} disabled={isPending}>
                                Close
                            </Button>
                            <Button onClick={sendReminder} disabled={!canSend}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {unresolved?.canRetry || reminderNotice ? 'Retry this reminder' : 'Send Email'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
