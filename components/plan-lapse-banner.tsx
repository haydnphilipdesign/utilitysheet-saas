'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { planLapseHeadline, readPlanLapse } from '@/components/settings/plan-lapse';

/**
 * Tells everyone in a workspace that its Teams plan is paused over a failed
 * payment, which can still be fixed. A plan that has ended is explained in
 * Settings > Billing only, so this does not stay on every page for good.
 */
export function PlanLapseBanner({ organization }: {
    organization: {
        role?: 'admin' | 'member' | null;
        subscription_status?: string | null;
        subscription_lapse_reason?: string | null;
        subscription_lapsed_at?: string | null;
    } | null;
}) {
    const lapse = readPlanLapse(organization);
    if (!lapse || lapse.reason !== 'payment_failed') return null;
    const isAdmin = organization?.role === 'admin';

    return (
        <div
            role="status"
            className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <p className="min-w-0 text-sm text-foreground">
                    <span className="font-medium">{planLapseHeadline(lapse)}</span>{' '}
                    <span className="text-muted-foreground">
                        This workspace is on the Free plan until it is fixed.{' '}
                        {isAdmin ? 'You can update the card in Billing.' : 'A workspace admin can fix it in Billing.'}
                    </span>
                </p>
            </div>
            {isAdmin && (
                <Link href="/dashboard/settings?tab=billing" className="shrink-0">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">Open Billing</Button>
                </Link>
            )}
        </div>
    );
}
