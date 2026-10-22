import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import DashboardPage from '@/app/dashboard/page';
import { DashboardLayoutContent } from '@/app/dashboard/layout-content';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Dashboard fixture' };

/**
 * Browser fixture for the dashboard home inside its real shell, without the
 * server session check in app/dashboard/layout.tsx. Callers mock every /api
 * call. No auth, database or server mutation occurs here. Only served by `next dev`.
 */
export default function DashboardFixturePage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    return (
        <Suspense fallback={<p>Loading…</p>}>
            <DashboardLayoutContent>
                <DashboardPage />
            </DashboardLayoutContent>
        </Suspense>
    );
}
