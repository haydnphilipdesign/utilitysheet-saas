import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    formatDelta,
    toOperationsSummary,
    toRequestVolume,
} from '@/lib/admin/operations-overview';

describe('operations overview summary', () => {
    it('reads account and paid counts from an aggregate row', () => {
        const summary = toOperationsSummary({
            total_accounts: 198,
            signups_last_7d: 6,
            signups_prev_7d: 4,
            pro_accounts: 9,
            team_accounts: 5,
            paid_accounts: 14,
        });

        expect(summary.totalAccounts).toBe(198);
        expect(summary.signupsLast7d).toBe(6);
        expect(summary.signupsPrev7d).toBe(4);
        expect(summary.proAccounts).toBe(9);
        expect(summary.teamAccounts).toBe(5);
        expect(summary.paidAccounts).toBe(14);
    });

    it('expresses paid accounts as a share of all customer accounts', () => {
        expect(toOperationsSummary({ total_accounts: 200, paid_accounts: 14 }).paidRate).toBe(7);
    });

    it('never divides by zero when there are no accounts', () => {
        const summary = toOperationsSummary({});

        expect(summary.totalAccounts).toBe(0);
        expect(summary.paidRate).toBe(0);
    });

    it('coerces string counts returned by the driver', () => {
        const summary = toOperationsSummary({ total_accounts: '50', paid_accounts: '5' });

        expect(summary.totalAccounts).toBe(50);
        expect(summary.paidRate).toBe(10);
    });
});

describe('request volume', () => {
    it('reads lifecycle and window counts from an aggregate row', () => {
        const volume = toRequestVolume({
            total_requests: 806,
            created_last_7d: 31,
            created_prev_7d: 24,
            submitted_last_7d: 28,
            stale_in_progress: 127,
        });

        expect(volume).toEqual({
            totalRequests: 806,
            createdLast7d: 31,
            createdPrev7d: 24,
            submittedLast7d: 28,
            staleInProgress: 127,
        });
    });

    it('defaults every count when the row is empty', () => {
        expect(toRequestVolume({})).toEqual({
            totalRequests: 0,
            createdLast7d: 0,
            createdPrev7d: 0,
            submittedLast7d: 0,
            staleInProgress: 0,
        });
    });
});

describe('formatDelta', () => {
    it('describes growth against the prior window', () => {
        expect(formatDelta(6, 4)).toBe('+50% vs prior 7d');
    });

    it('describes a decline against the prior window', () => {
        expect(formatDelta(3, 6)).toBe('-50% vs prior 7d');
    });

    it('calls an unchanged window flat rather than 0%', () => {
        expect(formatDelta(5, 5)).toBe('flat vs prior 7d');
    });

    it('returns null when there is no prior period to compare against', () => {
        // Without this guard the first week of any metric would read "+100%", which is noise.
        expect(formatDelta(6, 0)).toBeNull();
        expect(formatDelta(0, 0)).toBeNull();
    });
});
