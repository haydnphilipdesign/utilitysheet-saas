import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DialogFixtures } from './dialog-fixtures';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Browser-test fixture for shared dialog keyboard behavior
 * (tests/dialog-focus.spec.ts). Renders real dialog components with synthetic
 * data; the specs mock every /api call. Only served by `next dev`.
 */
export default function DialogFixturesPage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }
    return <DialogFixtures />;
}
