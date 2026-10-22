'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics/events';
import type { TestDriveSource, TestDriveState } from '@/lib/test-drive/types';

async function fetchState(method: 'GET' | 'POST' = 'GET'): Promise<TestDriveState> {
    const response = await fetch('/api/test-drive', { method });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || 'We could not load your seller test.');
    }
    return body as TestDriveState;
}

/**
 * Seller test state backed by /api/test-drive, shared by the onboarding card
 * and the dashboard first-run guide.
 */
export function useTestDrive(source: TestDriveSource) {
    const [state, setState] = useState<TestDriveState | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const viewedStateRef = useRef<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setState(await fetchState());
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'We could not load your seller test.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!state || viewedStateRef.current === state.status) return;
        viewedStateRef.current = state.status;
        trackEvent('test_drive_offer_viewed', {
            source,
            state: state.status,
        });
    }, [source, state]);

    // A test opened from the emailed link (for example on a phone) can finish
    // elsewhere; refresh when the user comes back to this tab.
    useEffect(() => {
        if (state?.status !== 'ready') return;
        const refresh = () => void load();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [load, state?.status]);

    const start = useCallback(async () => {
        setStarting(true);
        setError(null);
        trackEvent('test_drive_started', { source });
        try {
            const next = await fetchState('POST');
            if (next.status === 'ready') {
                trackEvent('test_drive_opened', { source, action: 'open' });
                // Same-tab navigation: one click, no popup blocking, and the
                // seller flow links back to the dashboard.
                window.location.assign(next.sellerUrl);
                return;
            }
            setState(next);
            setStarting(false);
        } catch (startError) {
            setError(startError instanceof Error ? startError.message : 'We could not start your seller test.');
            setStarting(false);
        }
    }, [source]);

    return { state, loading, starting, error, load, start };
}
