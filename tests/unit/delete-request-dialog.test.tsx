import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast: toastMocks }));

import { DeleteRequestDialog, type DeletableRequest } from '@/components/requests/DeleteRequestDialog';

const unanswered: DeletableRequest = {
    id: 'req_1',
    property_address: '123 Main St, Austin, TX 78701',
    status: 'sent',
    is_locked: false,
};

describe('DeleteRequestDialog', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('explains an unanswered request never counted, then deletes it', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
        const onDeleted = vi.fn();

        render(<DeleteRequestDialog request={unanswered} onClose={vi.fn()} onDeleted={onDeleted} />);

        expect(screen.getByText(/so this one never counted/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Delete request' }));

        await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(unanswered));
        expect(fetchMock).toHaveBeenCalledWith('/api/requests/req_1', { method: 'DELETE' });
        expect(toastMocks.success).toHaveBeenCalledWith('Request deleted');
    });

    it('warns that a submitted request still counts on the Free plan', () => {
        render(
            <DeleteRequestDialog
                request={{ ...unanswered, status: 'submitted' }}
                onClose={vi.fn()}
                onDeleted={vi.fn()}
            />
        );

        expect(screen.getByText(/still counts toward this month/i)).toBeTruthy();
    });

    it('keeps the dialog open and reports a failed delete', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }));
        const onDeleted = vi.fn();

        render(<DeleteRequestDialog request={unanswered} onClose={vi.fn()} onDeleted={onDeleted} />);
        fireEvent.click(screen.getByRole('button', { name: 'Delete request' }));

        await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('Forbidden'));
        expect(onDeleted).not.toHaveBeenCalled();
    });
});
