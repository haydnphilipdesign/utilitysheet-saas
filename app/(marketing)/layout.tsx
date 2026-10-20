'use client';

import './marketing.css';
import type { ReactNode } from 'react';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

export default function MarketingLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="marketing-site flex min-h-screen flex-col bg-background text-foreground">
            <MarketingHeader />

            <main className="flex-1 pt-16">
                {children}
            </main>

            <MarketingFooter />
        </div>
    );
}
