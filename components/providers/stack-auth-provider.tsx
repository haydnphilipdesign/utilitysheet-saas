'use client';

import { StackProvider, StackTheme } from '@stackframe/stack';
import { stackClientApp } from '@/lib/stack/client';
import { AccountActivationSync } from '@/components/providers/account-activation-sync';

export function StackAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <StackProvider app={stackClientApp}>
            <StackTheme>
                <AccountActivationSync />
                {children}
            </StackTheme>
        </StackProvider>
    );
}
