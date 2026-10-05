'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateTriageAdminAction } from '@/app/(admin)/admin/operations/actions';
import { formatAdminDate } from '@/lib/admin/date-format';

export type TriageView = {
    sourceKey: string;
    state: 'open' | 'acknowledged' | 'snoozed' | 'resolved';
    returned: 'snooze_expired' | 'recurred' | null;
    /** 0 when no triage record exists yet. */
    version: number;
    note: string | null;
    snoozedUntil: string | null;
    updatedByEmail: string | null;
    stateChangedAt: string | null;
};

type Action = 'acknowledge' | 'snooze' | 'resolve' | 'reopen';

const STATE_LABELS: Record<TriageView['state'], string> = {
    open: 'Open',
    acknowledged: 'Acknowledged',
    snoozed: 'Snoozed',
    resolved: 'Resolved',
};

const ACTION_LABELS: Record<Action, string> = {
    acknowledge: 'Acknowledge',
    snooze: 'Snooze',
    resolve: 'Resolve',
    reopen: 'Reopen',
};

function actionsFor(state: TriageView['state']): Action[] {
    if (state === 'resolved') return ['reopen'];
    if (state === 'snoozed') return ['reopen', 'resolve'];
    if (state === 'acknowledged') return ['snooze', 'resolve'];
    return ['acknowledge', 'snooze', 'resolve'];
}

export function TriageControls({
    item,
    disabledReason,
    resolveHint,
}: {
    item: TriageView;
    /** Set when triage cannot be written (writes disabled, migration pending). */
    disabledReason?: string | null;
    /** Shown when resolving, e.g. that resolving does not mean the failure recovered. */
    resolveHint?: string;
}) {
    const router = useRouter();
    const formId = useId();
    const [isPending, startTransition] = useTransition();
    const [action, setAction] = useState<Action | null>(null);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [snoozeDays, setSnoozeDays] = useState(7);
    const reasonOk = reason.trim().length >= 3;

    const submit = () => {
        if (!action || !reasonOk) return;
        startTransition(async () => {
            const result = await updateTriageAdminAction({
                sourceKey: item.sourceKey,
                action,
                expectedVersion: item.version,
                ...(action === 'snooze' ? { snoozeDays } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
                reason: reason.trim(),
            });
            if (!result.success) {
                toast.error(result.error);
                if (result.code === 'STALE') router.refresh();
                return;
            }
            toast.success({ acknowledge: 'Acknowledged', snooze: 'Snoozed', resolve: 'Resolved', reopen: 'Reopened' }[action]);
            setAction(null);
            setReason('');
            setNote('');
            router.refresh();
        });
    };

    return (
        <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{STATE_LABELS[item.state]}</span>
                {item.returned === 'snooze_expired' ? ' · snooze ended, back in the queue' : ''}
                {item.returned === 'recurred' ? ' · happened again after it was resolved' : ''}
                {item.state === 'snoozed' && item.snoozedUntil ? ` until ${formatAdminDate(item.snoozedUntil)}` : ''}
                {item.updatedByEmail && item.stateChangedAt
                    ? ` · last action by ${item.updatedByEmail}, ${formatAdminDate(item.stateChangedAt)}`
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
                    {actionsFor(item.state).map((candidate) => (
                        <Button
                            key={candidate}
                            type="button"
                            size="sm"
                            variant={action === candidate ? 'default' : 'outline'}
                            aria-expanded={action === candidate}
                            aria-controls={formId}
                            onClick={() => setAction(action === candidate ? null : candidate)}
                            disabled={isPending}
                        >
                            {ACTION_LABELS[candidate]}
                        </Button>
                    ))}
                </div>
            )}

            {action && !disabledReason ? (
                <div id={formId} className="space-y-2 rounded-md border border-border/70 bg-card p-3">
                    {action === 'resolve' && resolveHint ? <p className="text-muted-foreground">{resolveHint}</p> : null}
                    {action === 'snooze' ? (
                        <label className="flex items-center gap-2 text-muted-foreground">
                            Snooze for
                            <select
                                value={snoozeDays}
                                onChange={(event) => setSnoozeDays(Number(event.target.value))}
                                className="h-8 rounded-md border border-border bg-input/20 px-2 text-foreground"
                                disabled={isPending}
                            >
                                {[1, 3, 7, 14, 30].map((days) => (
                                    <option key={days} value={days}>{days === 1 ? '1 day' : `${days} days`}</option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <Textarea
                        aria-label={`Reason to ${ACTION_LABELS[action].toLowerCase()} this item`}
                        placeholder="Reason (required, audited)..."
                        value={reason}
                        maxLength={500}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={isPending}
                    />
                    <Textarea
                        aria-label="Internal note"
                        placeholder="Internal note (optional). Do not paste passwords, tokens or seller answers."
                        value={note}
                        maxLength={1000}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={isPending}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setAction(null)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={submit} disabled={!reasonOk || isPending}>
                            {ACTION_LABELS[action]}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
