'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setMaintenanceAdminAction } from '@/app/(admin)/admin/maintenance/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MAINTENANCE_ESTIMATE_MINUTES } from '@/lib/validation/admin-schemas';

const estimateLabel = (minutes: number) => (minutes < 60 ? `About ${minutes} minutes` : minutes === 60 ? 'About 1 hour' : `About ${minutes / 60} hours`);

/**
 * The on/off control. Turning the pause on asks once, because customers see
 * it; turning it off does not.
 */
export function MaintenanceControl({ enabled, disabledReason }: {
    enabled: boolean;
    /** Why the control cannot be used right now; null when it can. */
    disabledReason: string | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState(false);
    const [estimate, setEstimate] = useState('');

    const submit = (next: boolean, successMessage: string) => {
        startTransition(async () => {
            const result = await setMaintenanceAdminAction({
                enabled: next,
                expectedBackInMinutes: next && estimate ? Number(estimate) : null,
            });
            setConfirming(false);
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success(result.unchanged ? 'Already set that way. Nothing changed.' : successMessage);
            router.refresh();
        });
    };

    if (disabledReason) {
        return <p className="text-sm text-muted-foreground" data-testid="maintenance-control-disabled">{disabledReason}</p>;
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="maintenance-estimate" className="text-sm font-medium text-foreground">
                    Estimated return shown to sellers and customers
                </label>
                <select
                    id="maintenance-estimate"
                    value={estimate}
                    onChange={(event) => setEstimate(event.target.value)}
                    disabled={pending}
                    className="block h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <option value="">No estimate</option>
                    {MAINTENANCE_ESTIMATE_MINUTES.map((minutes) => (
                        <option key={minutes} value={minutes}>{estimateLabel(minutes)}</option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                    Counted from the moment you save. Once that time passes the estimate is no longer shown; nothing reopens by itself.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {enabled ? (
                    <>
                        <Button onClick={() => submit(false, 'Maintenance is off. The paused features are available again.')} disabled={pending} data-testid="maintenance-turn-off">
                            Turn maintenance off
                        </Button>
                        <Button variant="outline" onClick={() => submit(true, 'Estimate updated.')} disabled={pending} data-testid="maintenance-update-estimate">
                            Update estimate
                        </Button>
                    </>
                ) : (
                    <Button onClick={() => setConfirming(true)} disabled={pending} data-testid="maintenance-turn-on">
                        Turn maintenance on
                    </Button>
                )}
            </div>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Pause seller forms and PDF downloads?"
                description="Sellers will not be able to send their forms, get provider suggestions or email themselves their link, and nobody will be able to download a sheet PDF, until you turn this off. Their answers stay in their browser. It takes effect within about 10 seconds."
                confirmLabel="Turn maintenance on"
                onConfirm={() => submit(true, 'Maintenance is on.')}
                busy={pending}
            />
        </div>
    );
}