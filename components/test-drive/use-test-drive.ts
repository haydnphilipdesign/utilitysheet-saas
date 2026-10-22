'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics/events';
import { testDriveAddressForArea } from '@/lib/test-drive/area';
import type { TestDriveSource, TestDriveState } from '@/lib/test-drive/types';

// Errors about the area the user typed are shown next to the field.
const AREA_ERROR_CODES = new Set(['invalid_area', 'test_limit']);

class TestDriveRequestError extends Error {
    constructor(message: string, readonly code: string | null) {
        super(message);
    }
}

async function fetchState(method: 'GET' | 'POST' = 'GET', area?: string): Promise<TestDriveState> {
    const response = await fetch('/api/test-drive', area
        ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area }) }
        : { method });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new TestDriveRequestError(
            body.error || 'We could not load your seller test.',
            typeof body.code === 'string' ? body.code : null
        );
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
    const [areaError, setAreaError] = useState<string | null>(null);
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

    /** Starts the test at the sample address, or in `area` ("Austin, TX 78704") when given. */
    const start = useCallback(async (area?: string) => {
        const trimmedArea = area?.trim() || undefined;
        if (trimmedArea) {
            const checked = testDriveAddressForArea(trimmedArea);
            if (!checked.ok) {
                setAreaError(checked.error);
                return;
            }
        }
        setStarting(true);
        setError(null);
        setAreaError(null);
        trackEvent('test_drive_started', { source, area: trimmedArea ? 'custom' : 'sample' });
        try {
            const next = await fetchState('POST', trimmedArea);
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
            if (startError instanceof TestDriveRequestError && startError.code && AREA_ERROR_CODES.has(startError.code)) {
                setAreaError(startError.message);
            } else {
                setError(startError instanceof Error ? startError.message : 'We could not start your seller test.');
            }
            setStarting(false);
        }
    }, [source]);

    const clearAreaError = useCallback(() => setAreaError(null), []);

    return { state, loading, starting, error, areaError, clearAreaError, load, start };
}
