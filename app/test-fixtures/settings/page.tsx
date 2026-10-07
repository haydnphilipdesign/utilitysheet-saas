import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { SettingsFixture } from './settings-fixture';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Settings fixture' };

/**
 * Browser-test fixture for dashboard Settings (tests/settings.spec.ts). Renders
 * the real Settings view with a stand-in user; the specs mock every /api call.
 * No auth, database or server mutation occurs here. Only served by `next dev`.
 */
export default function SettingsFixturePage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    return (
        <main className="min-h-screen bg-background p-4 sm:p-8">
            <Suspense fallback={<p>Loading…</p>}>
                <SettingsFixture />
            </Suspense>
        </main>
    );
}
