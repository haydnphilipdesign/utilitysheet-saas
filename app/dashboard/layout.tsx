import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { stackServerApp } from '@/lib/stack/server';
import { DashboardLayoutContent } from './layout-content';

function DashboardLoadingFallback() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        </div>
    );
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await stackServerApp.getUser();
    if (!user) {
        redirect('/auth/login');
    }

    return (
        <Suspense fallback={<DashboardLoadingFallback />}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
    );
}
