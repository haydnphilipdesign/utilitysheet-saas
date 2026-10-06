import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EventLogTable } from '@/components/admin/EventLogTable';

function log(id: string, eventType: string) {
    return { id, event_type: eventType, event_data: null, ip_address: null, created_at: '2026-10-06T12:00:00.000Z' };
}

describe('Admin request event history', () => {
    it('names reopen events and keeps the raw type visible', () => {
        render(
            <EventLogTable
                logs={[
                    log('1', 'request_reopen_cancelled'),
                    log('2', 'request_reopened'),
                    log('3', 'seller_opened'),
                ]}
            />
        );

        const rows = screen.getAllByRole('row').slice(1);
        expect(within(rows[0]).getByText('Reopen closed without changes')).toBeInTheDocument();
        expect(within(rows[0]).getByText('request_reopen_cancelled')).toBeInTheDocument();
        expect(within(rows[1]).getByText('Reopened for seller')).toBeInTheDocument();
        expect(within(rows[1]).getByText('request_reopened')).toBeInTheDocument();
    });

    it('leaves other events as their raw type', () => {
        render(<EventLogTable logs={[log('1', 'seller_opened')]} />);

        const row = screen.getAllByRole('row')[1];
        expect(within(row).getByText('seller_opened')).toBeInTheDocument();
        expect(within(row).queryByText('Reopened for seller')).not.toBeInTheDocument();
    });
});
