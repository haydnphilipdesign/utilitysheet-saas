import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PendingInvitationBanner } from '@/components/pending-invitation-banner';

function respond(body: unknown, status = 200) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('pending invitation banner', () => {
    beforeEach(() => vi.clearAllMocks());

    it('links a signed-in person to an invitation they have not accepted', async () => {
        respond({
            invitations: [{ id: 'inv_1', workspaceName: 'Riverbend', invitedByName: 'Pat Lee', url: '/invite/tok_1' }],
        });
        render(<PendingInvitationBanner />);

        expect(await screen.findByText(/Pat Lee invited you to\s+join Riverbend\./)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View invitation' })).toHaveAttribute('href', '/invite/tok_1');
    });

    it('renders nothing when there are none, when the request fails, or for a link that is not an invitation', async () => {
        for (const [body, status] of [
            [{ invitations: [] }, 200],
            [{ error: 'Not found' }, 404],
            [{ invitations: [{ id: 'x', workspaceName: 'X', invitedByName: null, url: 'https://evil.example' }] }, 200],
        ] as const) {
            const fetchMock = respond(body, status);
            const { container, unmount } = render(<PendingInvitationBanner />);
            await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/organization/invites/mine'));
            await Promise.resolve();
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
    });
});
