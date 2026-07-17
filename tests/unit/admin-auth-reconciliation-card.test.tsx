import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: refreshMock }),
}));

import {
    AUTH_RECONCILIATION_TIMEOUT_MS,
    AuthReconciliationCard,
} from '@/app/(admin)/admin/users/auth-reconciliation-card';

const emptyPreview = {
    scanned: 137,
    existingAccountCount: 137,
    missingCount: 0,
    eligibleCount: 0,
    createdCount: 0,
    skipped: [],
    failures: [],
    dryRun: true,
    nextCursor: null,
};

describe('AuthReconciliationCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('shows a durable healthy status when no signups need reconciliation', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => emptyPreview,
        }));

        render(<AuthReconciliationCard />);

        expect(screen.getByText(/checking auth reconciliation status/i)).toBeInTheDocument();
        expect(await screen.findByText(/auth reconciliation is current/i)).toBeInTheDocument();
        expect(screen.getByText(/no verified auth signups are waiting/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument();
    });

    it('turns a stalled preview into a failure state with a retry control', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
        })));

        render(<AuthReconciliationCard />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(AUTH_RECONCILIATION_TIMEOUT_MS);
        });

        expect(screen.getByText(/auth reconciliation check failed/i)).toBeInTheDocument();
        expect(screen.getByText(/timed out/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry check/i })).toBeInTheDocument();
    });
});
