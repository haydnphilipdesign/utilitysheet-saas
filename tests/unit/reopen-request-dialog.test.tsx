import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReopenRequestDialog } from '@/components/requests/ReopenRequestDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request = { id: 'request-1', property_address: '12 Original Road', seller_email: 'seller@example.test' };

describe('ReopenRequestDialog', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('states what reopening does before the coordinator confirms', () => {
        render(<ReopenRequestDialog request={request} onClose={vi.fn()} onReopened={vi.fn()} />);

        expect(screen.getByText(/sheet link and PDF are unavailable until the seller submits again/i)).toBeInTheDocument();
        expect(screen.getByText(/new answers replace the sheet/i)).toBeInTheDocument();
        expect(screen.getByText(/does not count as another submitted sheet/i)).toBeInTheDocument();
        expect(screen.getByText(/No email is sent/i)).toBeInTheDocument();
    });

    it('reopens with no request body and hands back the updated request', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'request-1', status: 'in_progress', seller_edit_version: 1 }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const onReopened = vi.fn();
        render(<ReopenRequestDialog request={request} onClose={vi.fn()} onReopened={onReopened} />);

        fireEvent.click(screen.getByRole('button', { name: 'Reopen for Seller' }));

        await waitFor(() => expect(onReopened).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress' })));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/requests/request-1/reopen', { method: 'POST' });
    });

    it('keeps the dialog open and reports a refusal', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Only a submitted request can be reopened.' }), { status: 409 })));
        const onReopened = vi.fn();
        render(<ReopenRequestDialog request={request} onClose={vi.fn()} onReopened={onReopened} />);

        fireEvent.click(screen.getByRole('button', { name: 'Reopen for Seller' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Reopen for Seller' })).not.toBeDisabled());
        expect(onReopened).not.toHaveBeenCalled();
    });
});
