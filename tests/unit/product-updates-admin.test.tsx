import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductUpdate } from '@/types';

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    publish: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/(admin)/admin/updates/actions', () => ({
    createProductUpdateAdminAction: mocks.create,
    publishProductUpdateAdminAction: mocks.publish,
    deleteProductUpdateAdminAction: mocks.remove,
}));

import { ProductUpdatesAdmin } from '@/components/admin/ProductUpdatesAdmin';

const draft: ProductUpdate = {
    id: 'draft-1',
    title: 'Faster packet handoff',
    body: 'Packet sharing now opens more quickly.',
    category: 'feature',
    is_published: false,
    published_at: '2026-07-17T12:00:00.000Z',
    created_by: 'admin-1',
    created_at: '2026-07-17T12:00:00.000Z',
    updated_at: '2026-07-17T12:00:00.000Z',
};

describe('ProductUpdatesAdmin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.create.mockResolvedValue({ success: true, update: draft });
        mocks.publish.mockResolvedValue({ success: true, update: { ...draft, is_published: true } });
        mocks.remove.mockResolvedValue({ success: true, update: draft });
    });

    it('creates a draft with a required reason and no default publish control', async () => {
        render(<ProductUpdatesAdmin updates={[]} />);

        expect(screen.queryByRole('checkbox', { name: /visible to users/i })).not.toBeInTheDocument();
        const saveButton = screen.getByRole('button', { name: /save draft/i });
        expect(saveButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: draft.title } });
        fireEvent.change(screen.getByLabelText(/^body$/i), { target: { value: draft.body } });
        fireEvent.change(screen.getByLabelText(/admin reason/i), { target: { value: 'Prepare release notes for review' } });

        expect(saveButton).toBeEnabled();
        fireEvent.click(saveButton);

        await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
            title: draft.title,
            body: draft.body,
            category: 'announcement',
            reason: 'Prepare release notes for review',
        }));
    });

    it('previews and explicitly confirms publication', async () => {
        render(<ProductUpdatesAdmin updates={[draft]} />);

        fireEvent.click(screen.getByRole('button', { name: /preview and publish faster packet handoff/i }));

        const dialog = screen.getByRole('dialog', { name: /preview and publish product update/i });
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText(draft.body)).toBeInTheDocument();
        const publishButton = screen.getByRole('button', { name: /^publish update$/i });
        expect(publishButton).toBeDisabled();

        fireEvent.change(within(dialog).getByLabelText(/admin reason/i), {
            target: { value: 'Release verified and ready for customers' },
        });
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /confirm it should be visible to customers/i }));
        fireEvent.click(publishButton);

        await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(draft.id, {
            reason: 'Release verified and ready for customers',
            confirmed: true,
        }));
    });

    it('uses a distinct destructive confirmation for deletion', () => {
        render(<ProductUpdatesAdmin updates={[draft]} />);

        fireEvent.click(screen.getByRole('button', { name: /review deletion of faster packet handoff/i }));

        expect(screen.getByRole('dialog', { name: /confirm product update deletion/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^delete update$/i })).toHaveClass('text-destructive');
        expect(screen.getByRole('button', { name: /^delete update$/i })).toBeDisabled();
    });
});
