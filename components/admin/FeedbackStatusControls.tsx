'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateFeedbackStatusAdminAction } from '@/app/(admin)/admin/feedback/actions';
import { formatAdminDate } from '@/lib/admin/date-format';
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from '@/lib/feedback/constants';

export type FeedbackStatusView = {
    id: string;
    status: FeedbackStatus;
    version: number;
    note: string | null;
    updatedByEmail: string | null;
    statusChangedAt: string | null;
};

const ACTION_LABELS: Record<FeedbackStatus, string> = {
    reviewed: 'Mark reviewed',
    resolved: 'Resolve',
    new: 'Reopen',
};

const DONE_LABELS: Record<FeedbackStatus, string> = {
    reviewed: 'Marked reviewed',
    resolved: 'Resolved',
    new: 'Reopened',
};

function targetsFor(status: FeedbackStatus): FeedbackStatus[] {
    if (status === 'resolved') return ['new'];
    if (status === 'reviewed') return ['resolved', 'new'];
    return ['reviewed', 'resolved'];
}

export function FeedbackStatusControls({
    item,
    disabledReason,
}: {
    item: FeedbackStatusView;
    /** Set when the status cannot be written (Admin writes disabled). */
    disabledReason?: string | null;
}) {
    const router = useRouter();
    const formId = useId();
    const [isPending, startTransition] = useTransition();
    const [target, setTarget] = useState<FeedbackStatus | null>(null);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const submit = () => {
        if (!target) return;
        startTransition(async () => {
            const result = await updateFeedbackStatusAdminAction({
                feedbackId: item.id,
                status: target,
                expectedVersion: item.version,
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(reason.trim() ? { reason: reason.trim() } : {}),
            });
            if (!result.success) {
                toast.error(result.error);
                if (result.code === 'STALE' || result.code === 'NOT_FOUND') router.refresh();
                return;
            }
            toast.success(DONE_LABELS[target]);
            setTarget(null);
            setReason('');
            setNote('');
            router.refresh();
        });
    };

    return (
        <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{FEEDBACK_STATUS_LABELS[item.status]}</span>
                {item.updatedByEmail && item.statusChangedAt
                    ? ` · last action by ${item.updatedByEmail}, ${formatAdminDate(item.statusChangedAt)}`
                    : ''}
            </p>
            {item.note ? (
                <p className="whitespace-pre-wrap break-words rounded-md border border-border/70 bg-secondary/20 p-2 text-foreground">
                    {item.note}
                </p>
            ) : null}

            {disabledReason ? (
                <p className="text-muted-foreground">{disabledReason}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {targetsFor(item.status).map((candidate) => (
                        <Button
                            key={candidate}
                            type="button"
                            size="sm"
                            variant={target === candidate ? 'default' : 'outline'}
                            aria-expanded={target === candidate}
                            aria-controls={formId}
                            onClick={() => setTarget(target === candidate ? null : candidate)}
                            disabled={isPending}
                        >
                            {ACTION_LABELS[candidate]}
                        </Button>
                    ))}
                </div>
            )}

            {target && !disabledReason ? (
                <div id={formId} className="space-y-2 rounded-md border border-border/70 bg-card p-3">
                    <Textarea
                        aria-label={`Reason to ${ACTION_LABELS[target].toLowerCase()} this feedback`}
                        placeholder="Reason (optional, audited)..."
                        value={reason}
                        maxLength={500}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={isPending}
                    />
                    <Textarea
                        aria-label="Internal note"
                        placeholder="Internal note (optional, never shown to the customer). Do not paste passwords or tokens."
                        value={note}
                        maxLength={1000}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={isPending}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setTarget(null)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
                            {ACTION_LABELS[target]}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
