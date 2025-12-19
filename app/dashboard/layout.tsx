'use client';

import { Suspense } from 'react';
import { DashboardLayoutContent } from './layout-content';

function DashboardLoadingFallback() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Loading...</p>
            </div>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<DashboardLoadingFallback />}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
    );
}
