'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { AdminActionReasonField } from '@/components/admin/AdminActionReasonField';
import { buildTestimonialOutreachEmail } from '@/lib/admin/testimonial-outreach-content';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    sendTestimonialRequestAdminAction,
    sendTestimonialRequestTestToSelfAdminAction,
} from '@/app/(admin)/admin/testimonial-candidates/actions';

function createActionId(prefix: string) {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${randomId}`;
}

const testEmailPreview = buildTestimonialOutreachEmail({ recipientName: null, businessName: null });

type TestimonialOutreachButtonProps = {
    userId: string;
    recipientName: string | null;
    recipientEmail: string;
    businessName: string | null;
    selectionReasons: string[];
    alreadySent: boolean;
};

export function TestimonialOutreachButton({
    userId,
    recipientName,
    recipientEmail,
    businessName,
    selectionReasons,
    alreadySent,
}: TestimonialOutreachButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const reasonOk = reason.trim().length >= 3;
    const preview = useMemo(
        () => buildTestimonialOutreachEmail({ recipientName, businessName }),
        [businessName, recipientName]
    );

    const reset = () => {
        setReason('');
        setConfirmed(false);
        setIdempotencyKey('');
        setErrorMessage('');
    };

    const openReview = () => {
        reset();
        setIdempotencyKey(createActionId('testimonial-outreach'));
        setOpen(true);
    };

    const handleSend = () => {
        if (!reasonOk || !confirmed || isPending) return;

        startTransition(async () => {
            const result = await sendTestimonialRequestAdminAction(userId, {
                reason: reason.trim(),
                confirmed: true,
                idempotencyKey,
                expectedRecipientEmail: recipientEmail,
                expectedSubject: preview.subject,
                expectedBody: preview.text,
                allowResend: alreadySent,
            });

            if (!result.success) {
                setErrorMessage(result.error || 'Failed to send testimonial request');
                toast.error(result.error || 'Failed to send testimonial request');
                return;
            }

            toast.success(result.dryRun ? 'Dry run logged. No email was sent.' : `Request sent to ${recipientEmail}`);
            setOpen(false);
            reset();
            router.refresh();
        });
    };

    return (
        <>
            <Button
                type="button"
                variant={alreadySent ? 'outline' : 'default'}
                size="sm"
                disabled={isPending}
                onClick={openReview}
                aria-label={`${alreadySent ? 'Review testimonial resend' : 'Review outreach'} for ${recipientEmail}`}
            >
                {alreadySent ? <RotateCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {alreadySent ? 'Review resend' : 'Review outreach'}
            </Button>

            <Dialog
                open={open}
                onOpenChange={(nextOpen) => {
                    if (isPending) return;
                    setOpen(nextOpen);
                    if (!nextOpen) reset();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Review testimonial outreach</DialogTitle>
                        <DialogDescription>
                            Review the recipient, selection rationale, and exact message before confirming this external email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <section aria-labelledby={`recipient-${userId}`} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                            <h3 id={`recipient-${userId}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Recipient
                            </h3>
                            <p className="mt-1 font-medium text-foreground">{recipientName || 'Customer'}</p>
                            <p className="text-sm text-muted-foreground">{recipientEmail}</p>
                            {alreadySent ? (
                                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                    A successful request was already sent. This confirmation will send another email.
                                </p>
                            ) : null}
                        </section>

                        <section aria-labelledby={`selection-${userId}`} className="space-y-2">
                            <h3 id={`selection-${userId}`} className="text-sm font-medium text-foreground">Why this person was selected</h3>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                {selectionReasons.map((selectionReason) => <li key={selectionReason}>{selectionReason}</li>)}
                            </ul>
                        </section>

                        <section aria-labelledby={`message-${userId}`} className="space-y-2">
                            <h3 id={`message-${userId}`} className="text-sm font-medium text-foreground">Message preview</h3>
                            <div className="rounded-lg border border-border/70 bg-background p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                                <p className="mt-1 text-sm font-medium text-foreground">{preview.subject}</p>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{preview.text}</p>
                            </div>
                        </section>

                        <AdminActionReasonField value={reason} onChange={setReason} disabled={isPending} />

                        {errorMessage ? (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {errorMessage}
                            </p>
                        ) : null}

                        <label className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(event) => setConfirmed(event.target.checked)}
                                disabled={isPending}
                                className="mt-0.5 h-4 w-4 accent-primary"
                            />
                            <span>I have reviewed the recipient and message and confirm this email should be sent.</span>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSend} disabled={!reasonOk || !confirmed || isPending}>
                            <Send className="h-4 w-4" />
                            {isPending ? 'Sending testimonial request...' : alreadySent ? 'Send another request' : 'Send testimonial request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function TestimonialOutreachTestButton() {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const reasonOk = reason.trim().length >= 3;

    const close = () => {
        setOpen(false);
        setReason('');
        setConfirmed(false);
        setErrorMessage('');
    };

    const handleSendTest = () => {
        if (!reasonOk || !confirmed || isPending) return;

        startTransition(async () => {
            const result = await sendTestimonialRequestTestToSelfAdminAction({
                reason: reason.trim(),
                confirmed: true,
                idempotencyKey: createActionId('testimonial-test'),
            });

            if (!result.success) {
                setErrorMessage(result.error || 'Failed to send test email');
                toast.error(result.error || 'Failed to send test email');
                return;
            }

            toast.success(result.dryRun ? 'Dry run test logged. No email was sent.' : 'Test email sent to your admin inbox');
            close();
        });
    };

    return (
        <>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => setOpen(true)}>
                <Mail className="h-4 w-4" />
                Review test email
            </Button>
            <Dialog open={open} onOpenChange={(nextOpen) => !isPending && (nextOpen ? setOpen(true) : close())}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Review test outreach email</DialogTitle>
                        <DialogDescription>
                            This sends the current testimonial message to your Admin inbox and records an audit entry.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border/70 bg-background p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                            <p className="mt-1 text-sm font-medium text-foreground">[Test] {testEmailPreview.subject}</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{testEmailPreview.text}</p>
                        </div>
                        <AdminActionReasonField value={reason} onChange={setReason} disabled={isPending} />
                        {errorMessage ? (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {errorMessage}
                            </p>
                        ) : null}
                        <label className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(event) => setConfirmed(event.target.checked)}
                                disabled={isPending}
                                className="mt-0.5 h-4 w-4 accent-primary"
                            />
                            <span>I have reviewed the test message and confirm it should be sent to my Admin inbox.</span>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={isPending}>Cancel</Button>
                        <Button onClick={handleSendTest} disabled={!reasonOk || !confirmed || isPending}>
                            <Mail className="h-4 w-4" />
                            {isPending ? 'Sending test email...' : 'Send test email'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
