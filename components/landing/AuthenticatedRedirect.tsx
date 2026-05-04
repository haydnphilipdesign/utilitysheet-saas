'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@stackframe/stack';

export function AuthenticatedRedirect({ to = '/dashboard' }: { to?: string }) {
    const user = useUser();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.replace(to);
        }
    }, [user, router, to]);

    return null;
}
