import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { stackServerApp } from '@/lib/stack/server';
import { noIndexMetadata } from '@/lib/seo/site';
import { DashboardLayoutContent } from './layout-content';
import { ensureAccountActivation } from '@/lib/activation/ensure-account-activation';
import { getAccountClosureStatusByAuthUserId } from '@/lib/neon/queries';

export const metadata = noIndexMetadata;

function DashboardLoadingFallback() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading…</p>
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

    const activationState = await ensureAccountActivation(user);
    if (!activationState?.account) {
        // Sending a closing account to login would bounce straight back here.
        const closure = await getAccountClosureStatusByAuthUserId(user.id);
        redirect(closure && closure.status !== 'active' ? '/account-closed' : '/auth/login');
    }

    return (
        <Suspense fallback={<DashboardLoadingFallback />}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
    );
}
