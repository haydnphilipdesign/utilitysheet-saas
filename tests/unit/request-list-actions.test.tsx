import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({
        children,
        onClick,
        disabled,
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
        <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
    ),
}));

import { RequestListActions } from '@/components/requests/RequestListActions';
import type { Request } from '@/types';

function buildRequest(overrides: Partial<Request> = {}): Request {
    return {
        id: 'req_1',
        property_address: '123 Main St, Austin, TX 78701',
        status: 'sent',
        seller_email: 'seller@example.com',
        seller_token: 'seller-token',
        public_token: 'public-token',
        is_locked: false,
        ...overrides,
    } as Request;
}

function renderActions(layout: 'desktop' | 'mobile', request: Request) {
    const onDelete = vi.fn();
    render(
        <RequestListActions
            request={request}
            layout={layout}
            onCopySellerLink={vi.fn()}
            onSendReminder={vi.fn()}
            onDownloadPdf={vi.fn()}
            onDelete={onDelete}
            sendingReminder={false}
            downloadingPdf={false}
        />
    );
    return onDelete;
}

describe('RequestListActions delete', () => {
    it('offers Delete request in the desktop menu for an unanswered request', () => {
        const request = buildRequest();
        const onDelete = renderActions('desktop', request);

        fireEvent.click(screen.getByRole('button', { name: 'Delete request' }));

        expect(onDelete).toHaveBeenCalledWith(request);
    });

    it('offers Delete on mobile, including locked submissions', () => {
        const request = buildRequest({ status: 'submitted', is_locked: true });
        const onDelete = renderActions('mobile', request);

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalledWith(request);
    });
});
