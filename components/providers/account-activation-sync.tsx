'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { stackClientApp } from '@/lib/stack/client';

const SESSION_STORAGE_PREFIX = 'utilitysheet:account-activation-sync:';

export function AccountActivationSync() {
    const pathname = usePathname();
    const inFlightUserId = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function syncAccountIfNeeded() {
            if (pathname?.startsWith('/api/')) {
                return;
            }

            let currentUser: { id?: string | null } | null = null;
            try {
                currentUser = await stackClientApp.getUser();
            } catch (error) {
                console.error('Failed to load authenticated user for account activation sync:', error);
                return;
            }

            if (cancelled) {
                return;
            }

            const userId = currentUser?.id?.trim();
            if (!userId) {
                return;
            }

            const storageKey = `${SESSION_STORAGE_PREFIX}${userId}`;

            try {
                if (window.sessionStorage.getItem(storageKey) === 'done') {
                    return;
                }
            } catch {
                // Ignore storage access issues and continue with the sync request.
            }

            if (inFlightUserId.current === userId) {
                return;
            }

            inFlightUserId.current = userId;

            try {
                const response = await fetch('/api/account', {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (!cancelled && response.ok) {
                    try {
                        window.sessionStorage.setItem(storageKey, 'done');
                    } catch {
                        // Ignore storage access issues after a successful sync.
                    }
                }
            } catch (error) {
                console.error('Account activation sync failed:', error);
            } finally {
                if (inFlightUserId.current === userId) {
                    inFlightUserId.current = null;
                }
            }
        }

        void syncAccountIfNeeded();

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    return null;
}
