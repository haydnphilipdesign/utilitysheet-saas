'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { checkMaintenanceStatus } from '@/lib/maintenance/client';

/**
 * Keeps an active pause in view on every Admin page, so it is not left on by
 * accident. Renders nothing while maintenance is off.
 */
export function AdminMaintenanceIndicator() {
    const pathname = usePathname();
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void checkMaintenanceStatus().then((check) => {
            if (!cancelled && check.state !== 'unknown') setPaused(check.state === 'paused');
        });
        return () => {
            cancelled = true;
        };
    }, [pathname]);

    // The Maintenance page shows the state itself, read directly from the database.
    if (!paused || pathname.startsWith('/admin/maintenance')) return null;

    return (
        <div
            role="status"
            data-testid="admin-maintenance-indicator"
            className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
        >
            <Wrench className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <span className="font-medium">Maintenance mode is on.</span>
            <span className="text-muted-foreground">Sellers cannot send forms and PDF downloads are paused.</span>
            <Link href="/admin/maintenance" className="font-medium underline underline-offset-2">Manage</Link>
        </div>
    );
}