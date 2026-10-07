import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import RequestsPage from '@/app/dashboard/requests/page';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Requests fixture' };

/**
 * Browser-test fixture for the dashboard Requests list (tests/requests-list.spec.ts).
 * Renders the real page outside the dashboard shell; the specs mock every /api call.
 * No auth, database or server mutation occurs here. Only served by `next dev`.
 */
export default function RequestsFixturePage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    return (
        <main className="min-h-screen bg-background p-4 sm:p-8">
            <Suspense fallback={<p>Loading…</p>}>
                <RequestsPage />
            </Suspense>
        </main>
    );
}
