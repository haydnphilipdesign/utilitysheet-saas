'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@stackframe/stack';

const SESSION_STORAGE_PREFIX = 'utilitysheet:account-activation-sync:';

export function AccountActivationSync() {
    const user = useUser();
    const pathname = usePathname();
    const inFlightUserId = useRef<string | null>(null);

    useEffect(() => {
        const userId = user?.id?.trim();
        if (!userId || pathname?.startsWith('/api/')) {
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
        let cancelled = false;

        void fetch('/api/account', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
        })
            .then((response) => {
                if (!cancelled && response.ok) {
                    try {
                        window.sessionStorage.setItem(storageKey, 'done');
                    } catch {
                        // Ignore storage access issues after a successful sync.
                    }
                }
            })
            .catch((error) => {
                console.error('Account activation sync failed:', error);
            })
            .finally(() => {
                if (inFlightUserId.current === userId) {
                    inFlightUserId.current = null;
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pathname, user?.id]);

    return null;
}
