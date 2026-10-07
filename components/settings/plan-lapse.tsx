'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export type PlanLapseReason = 'payment_failed' | 'payment_failed_ended' | 'ended';

export type PlanLapse = { reason: PlanLapseReason; date: string | null };

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

/** A workspace's stopped Teams plan, or null when it is on Teams or never had a plan. */
export function readPlanLapse(organization: {
    subscription_status?: string | null;
    subscription_lapse_reason?: string | null;
    subscription_lapsed_at?: string | null;
} | null | undefined): PlanLapse | null {
    if (!organization || organization.subscription_status === 'team') return null;
    const reason = organization.subscription_lapse_reason;
    if (reason !== 'payment_failed' && reason !== 'payment_failed_ended' && reason !== 'ended') return null;

    const at = organization.subscription_lapsed_at ? new Date(organization.subscription_lapsed_at) : null;
    return { reason, date: at && !Number.isNaN(at.getTime()) ? longDate.format(at) : null };
}

export function planLapseHeadline({ reason, date }: PlanLapse) {
    if (reason === 'payment_failed') {
        return 'Teams is paused because the last payment didn’t go through.';
    }
    const when = date ? ` on ${date}` : '';
    return reason === 'payment_failed_ended'
        ? `Your Teams plan ended${when} because the payment didn’t go through.`
        : `Your Teams plan ended${when}.`;
}

/** What happened to the Teams plan and what to do about it, for Settings > Billing. */
export function PlanLapseNotice({ lapse, isAdmin, action }: {
    lapse: PlanLapse;
    isAdmin: boolean;
    /** The button that fixes it, shown to admins. */
    action?: ReactNode;
}) {
    const paused = lapse.reason === 'payment_failed';
    return (
        <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-start sm:justify-between"
        >
            <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">{planLapseHeadline(lapse)}</p>
                    <p className="text-muted-foreground">
                        {paused && lapse.date ? `Since ${lapse.date} this workspace has been on the Free plan. ` : 'This workspace is on the Free plan now. '}
                        Nothing was deleted, and everyone is still a member.{' '}
                        {!isAdmin
                            ? 'A workspace admin can bring Teams back in Billing.'
                            : paused
                                ? 'Update the card in Manage Teams billing. When the payment goes through, Teams comes back by itself.'
                                : 'To bring Teams back, start it again below.'}
                    </p>
                </div>
            </div>
            {isAdmin && action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
