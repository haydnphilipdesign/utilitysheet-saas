'use client';

import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const POLL_INTERVALS: Record<string, number> = {
    '/admin': 30_000,
    '/admin/operations': 30_000,
    '/admin/requests': 30_000,
    '/admin/abandonment': 30_000,
    '/admin/feedback': 60_000,
};
const FOCUS_ROUTES = new Set([
    '/admin/users', '/admin/organizations', '/admin/growth',
    '/admin/telemetry', '/admin/audit-logs',
]);

/** Dialogs may be portalled outside main. Inline editors opt in explicitly. */
function editingInProgress() {
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-admin-refresh-blocked="true"]')) return true;
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"], [role="combobox"]')) return true;

    // GET filters are uncontrolled: preserve unapplied changes even after blur.
    return Array.from(document.querySelectorAll('main form input, main form textarea, main form select')).some((element) => {
        if (element instanceof HTMLInputElement) {
            if (element.type === 'hidden' || element.type === 'submit') return false;
            return ['checkbox', 'radio'].includes(element.type)
                ? element.checked !== element.defaultChecked
                : element.value !== element.defaultValue;
        }
        if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
        if (element instanceof HTMLSelectElement) {
            const defaults = Array.from(element.options).filter((option) => option.defaultSelected);
            const initial = defaults.length ? defaults.map((option) => option.value) : [element.options[0]?.value];
            return Array.from(element.selectedOptions).map((option) => option.value).join('\0') !== initial.join('\0');
        }
        return false;
    });
}

function RefreshControl({ pathname }: { pathname: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const inFlight = useRef(false);
    const lastAttempt = useRef(0);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [paused, setPaused] = useState(false);
    const [failed, setFailed] = useState(false);
    const interval = POLL_INTERVALS[pathname];
    const automatic = Boolean(interval || FOCUS_ROUTES.has(pathname));

    const refresh = useCallback((manual = false) => {
        if (document.visibilityState === 'hidden' || !navigator.onLine || inFlight.current) return;
        const blocked = editingInProgress();
        setPaused(blocked);
        if (blocked || (!manual && Date.now() - lastAttempt.current < 5_000)) return;
        lastAttempt.current = Date.now();
        inFlight.current = true;
        setFailed(false);
        startTransition(() => {
            try {
                router.refresh();
            } catch {
                inFlight.current = false;
                setFailed(true);
            }
        });
    }, [router]);

    useEffect(() => {
        if (!isPending && inFlight.current) {
            inFlight.current = false;
            setLastUpdated(new Date());
        }
    }, [isPending]);

    useEffect(() => {
        if (!automatic) return;
        const onReturn = () => refresh();
        window.addEventListener('focus', onReturn);
        window.addEventListener('online', onReturn);
        document.addEventListener('visibilitychange', onReturn);
        const timer = interval ? window.setInterval(onReturn, interval) : undefined;
        return () => {
            window.removeEventListener('focus', onReturn);
            window.removeEventListener('online', onReturn);
            document.removeEventListener('visibilitychange', onReturn);
            if (timer !== undefined) window.clearInterval(timer);
        };
    }, [automatic, interval, refresh]);

    return (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{interval ? `Auto-refresh every ${interval / 1000}s` : automatic ? 'Refreshes when you return' : 'Manual refresh'}</span>
            <span role="status">
                {isPending ? 'Refreshing…' : failed ? 'Refresh failed. Try again.' : paused ? 'Paused while editing' : lastUpdated
                    ? `Updated at ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`
                    : 'Loaded with page'}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => refresh(true)}>
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
        </div>
    );
}

function RouteRefreshControl() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    return <RefreshControl key={`${pathname}?${searchParams.toString()}`} pathname={pathname} />;
}

export function AdminRefresh() {
    return <Suspense fallback={null}><RouteRefreshControl /></Suspense>;
}
