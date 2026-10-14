import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RetentionCard } from '@/components/admin/RetentionCard';
import type { RetentionStatus } from '@/lib/telemetry/retention';

const plan: RetentionStatus['plan'] = [
    { key: 'sellerDiagnostics', label: 'Seller browser diagnostics', kind: 'delete', action: 'preview', windowDays: 90 },
    { key: 'eventIpUserAgent', label: 'IP address and browser header on request events', kind: 'scrub', action: 'enforce', windowDays: 30 },
    { key: 'historicalIntakeAddresses', label: 'Addresses and link names in old intake creation events', kind: 'scrub', action: 'skip', windowDays: null },
];

describe('RetentionCard', () => {
    it('shows the mode, each rule and what the last run did', () => {
        render(<RetentionCard state={{
            status: 'ok',
            data: {
                mode: 'preview', plan,
                lastRun: { startedAt: '2026-10-14T12:00:00.000Z', status: 'success', summary: { sellerDiagnostics: 1234, sellerDiagnosticsAction: 1, eventIpUserAgent: 7, eventIpUserAgentAction: 2, failed: 0 } },
            },
        }} />);

        expect(screen.getByText(/Preview\. The daily run counts/)).toBeTruthy();
        expect(screen.getByText(/Delete older than 90 days · preview · last run would delete 1,234/)).toBeTruthy();
        expect(screen.getByText(/Clear older than 30 days · on · last run cleared 7/)).toBeTruthy();
        expect(screen.getByText(/Clear any age \(one-time cleanup\) · off · not in the last run/)).toBeTruthy();
    });

    it('says when nothing has run and when status cannot be read', () => {
        const { rerender } = render(<RetentionCard state={{ status: 'ok', data: { mode: 'off', plan, lastRun: null } }} />);
        expect(screen.getByText('No run recorded yet.')).toBeTruthy();
        expect(screen.getByText(/^Off\./)).toBeTruthy();

        rerender(<RetentionCard state={{ status: 'error' }} />);
        expect(screen.getByRole('status').textContent).toContain('could not be loaded');
    });
});
