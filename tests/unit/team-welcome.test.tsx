import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamWelcome } from '@/components/dashboard/team-welcome';

const member = { id: 'org_team', name: 'Riverbend Transaction Services', role: 'member' as const, subscription_status: 'team' };

function serveMembers(members: unknown[] | null) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(members ? { members } : { error: 'nope' }), {
        status: members ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('team welcome', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('tells a new member what is shared, what is theirs and who runs the workspace', async () => {
        serveMembers([
            { full_name: 'Pat Lee', email: 'pat@example.com', member_role: 'admin' },
            { full_name: null, email: 'robin@example.com', member_role: 'admin' },
            { full_name: 'Casey Nguyen', email: 'casey@example.com', member_role: 'member' },
        ]);
        render(<TeamWelcome workspace={member} hasOtherWorkspaces />);

        expect(await screen.findByRole('heading', { name: 'Welcome to Riverbend Transaction Services' })).toBeInTheDocument();
        expect(screen.getByText('Requests and Branding Profiles are shared.')).toBeInTheDocument();
        expect(screen.getByText('Seller forms are your own.')).toBeInTheDocument();
        expect(await screen.findByText('Pat Lee and robin@example.com manage people, seats and billing.')).toBeInTheDocument();
        expect(screen.getByText('Your own workspace is still there.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'See your team’s requests' })).toHaveAttribute('href', '/dashboard/requests');
    });

    it('still reads properly when the member list cannot be loaded, and omits other workspaces when there are none', async () => {
        serveMembers(null);
        render(<TeamWelcome workspace={member} hasOtherWorkspaces={false} />);

        expect(await screen.findByText('Workspace admins manage people, seats and billing.')).toBeInTheDocument();
        expect(screen.queryByText('Your own workspace is still there.')).not.toBeInTheDocument();
    });

    it('goes away for good once dismissed, per workspace', async () => {
        serveMembers([]);
        const { unmount } = render(<TeamWelcome workspace={member} hasOtherWorkspaces />);
        fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
        expect(screen.queryByRole('heading', { name: /Welcome to/ })).not.toBeInTheDocument();
        unmount();

        const fetchMock = serveMembers([]);
        render(<TeamWelcome workspace={member} hasOtherWorkspaces />);
        await Promise.resolve();
        expect(screen.queryByRole('heading', { name: /Welcome to/ })).not.toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();

        render(<TeamWelcome workspace={{ ...member, id: 'org_other', name: 'Second Team' }} hasOtherWorkspaces />);
        expect(await screen.findByRole('heading', { name: 'Welcome to Second Team' })).toBeInTheDocument();
    });

    it.each([
        ['an admin', { ...member, role: 'admin' as const }],
        ['a workspace that is not on Teams', { ...member, subscription_status: 'free' }],
        ['no workspace', null],
    ])('shows nothing for %s', async (_label, workspace) => {
        const fetchMock = serveMembers([]);
        const { container } = render(<TeamWelcome workspace={workspace} hasOtherWorkspaces />);

        await waitFor(() => expect(container).toBeEmptyDOMElement());
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
