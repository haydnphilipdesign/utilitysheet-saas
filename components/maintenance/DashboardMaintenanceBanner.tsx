'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { checkMaintenanceStatus, type MaintenanceNotice } from '@/lib/maintenance/client';
import { expectedBackSentence } from '@/components/maintenance/MaintenanceNotice';

/**
 * Tells signed-in users, while a pause is on, that sellers cannot send their
 * forms and PDFs cannot be downloaded. Renders nothing otherwise.
 */
export function DashboardMaintenanceBanner() {
    const [notice, setNotice] = useState<MaintenanceNotice | null>(null);

    useEffect(() => {
        let cancelled = false;
        void checkMaintenanceStatus().then((check) => {
            if (!cancelled && check.state === 'paused') setNotice(check.notice);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!notice) return null;
    const expected = expectedBackSentence(notice);

    return (
        <div
            role="status"
            data-testid="dashboard-maintenance-banner"
            className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
        >
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 text-sm text-foreground">
                <span className="font-medium">Planned maintenance is in progress.</span>{' '}
                <span className="text-muted-foreground">
                    Sellers can’t send their forms and PDF downloads are paused until it is finished.
                    Everything else works, and seller links you send now will work afterward.
                    {expected ? ` ${expected}` : ''}
                </span>
            </p>
        </div>
    );
}
