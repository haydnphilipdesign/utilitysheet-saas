import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useParams: () => ({ token: 'tok_1' }),
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/lib/stack/client', () => ({ stackClientApp: { signOut: mocks.signOut } }));

import InvitePage from '@/app/invite/[token]/page';

type Viewer = { signedIn: boolean; email: string | null; emailMatches: boolean; isMember: boolean; organizationId: string | null };

function invitation(overrides: Record<string, unknown> = {}, viewer: Partial<Viewer> = {}) {
    return {
        status: 'open',
        workspaceName: 'Riverbend Transaction Services',
        invitedByName: 'Pat Lee',
        invitedEmail: 'casey@example.com',
        role: 'member',
        expiresAt: '2026-10-14T12:00:00.000Z',
        workspaceOnTeams: true,
        ...overrides,
        viewer: { signedIn: false, email: null, emailMatches: false, isMember: false, organizationId: null, ...viewer },
    };
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Serves the lookup, and records every write the page makes. */
function serve(lookups: Array<{ body: unknown; status?: number }>, accept?: { body: unknown; status: number }) {
    const writes: Array<{ url: string; body: unknown }> = [];
    let lookupCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
            writes.push({ url, body: JSON.parse(String(init.body)) });
            if (url === '/api/organization/invites/accept' && accept) return json(accept.body, accept.status);
            return json({ success: true });
        }
        const next = lookups[Math.min(lookupCount, lookups.length - 1)];
        lookupCount += 1;
        return json(next.body, next.status ?? 200);
    }));
    return writes;
}

const signedInMatch = { signedIn: true, email: 'casey@example.com', emailMatches: true };

describe('invitation page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.signOut.mockResolvedValue(undefined);
    });

    it('shows a signed-out visitor who invited them, which address to use, and both ways in', async () => {
        const writes = serve([{ body: invitation() }]);
        render(<InvitePage />);

        expect(await screen.findByRole('heading', { name: 'Join Riverbend Transaction Services on UtilitySheet' })).toBeInTheDocument();
        expect(screen.getByText(/Pat Lee invited you/)).toBeInTheDocument();
        expect(screen.getByText('casey@example.com')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
        expect(mocks.push).toHaveBeenCalledWith('/auth/signup?next=%2Finvite%2Ftok_1');
        fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }));
        expect(mocks.push).toHaveBeenCalledWith('/auth/login?next=%2Finvite%2Ftok_1');
        // Looking at an invitation never joins anything.
        expect(writes).toEqual([]);
    });

    it('joins only when the invited person chooses to, then opens the dashboard', async () => {
        const writes = serve([{ body: invitation({}, signedInMatch) }], { status: 200, body: { success: true } });
        render(<InvitePage />);

        const join = await screen.findByRole('button', { name: 'Join Riverbend Transaction Services' });
        expect(writes).toEqual([]);
        fireEvent.click(join);

        expect(await screen.findByRole('heading', { name: 'You’ve joined Riverbend Transaction Services' })).toBeInTheDocument();
        expect(writes).toEqual([{ url: '/api/organization/invites/accept', body: { token: 'tok_1' } }]);
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'), { timeout: 3000 });
    });

    it('names both addresses when signed in as someone else and offers to switch account', async () => {
        serve([{ body: invitation({}, { signedIn: true, email: 'personal@example.net', emailMatches: false }) }]);
        render(<InvitePage />);

        expect(await screen.findByText('personal@example.net')).toBeInTheDocument();
        expect(screen.getByText('casey@example.com')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Join / })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Sign out and switch account' }));
        await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/auth/login?next=%2Finvite%2Ftok_1'));
    });

    it('treats a second visit by a member as success and opens that workspace', async () => {
        const writes = serve([{
            body: invitation({ status: 'accepted' }, { ...signedInMatch, isMember: true, organizationId: 'org_1' }),
        }]);
        render(<InvitePage />);

        expect(await screen.findByRole('heading', { name: 'You’re already in Riverbend Transaction Services' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open Riverbend Transaction Services' }));

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
        expect(writes).toEqual([{ url: '/api/account/active-organization', body: { organizationId: 'org_1' } }]);
    });

    it('says who to ask when the invitation has expired, and never points at Billing', async () => {
        serve([{ body: invitation({ status: 'expired' }, signedInMatch) }]);
        render(<InvitePage />);

        expect(await screen.findByRole('heading', { name: 'This invitation has expired' })).toBeInTheDocument();
        expect(screen.getByText(/Ask Pat Lee to\s+send a new one/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Join / })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Go to your dashboard' }));
        expect(mocks.push).toHaveBeenCalledWith('/dashboard');
        expect(mocks.push).not.toHaveBeenCalledWith(expect.stringContaining('billing'));
    });

    it('explains an invalid link', async () => {
        serve([{ body: { status: 'not_found' }, status: 404 }]);
        render(<InvitePage />);

        expect(await screen.findByRole('heading', { name: 'This invitation link isn’t valid' })).toBeInTheDocument();
    });

    it('explains a full workspace and keeps the invitation on screen', async () => {
        serve([{ body: invitation({}, signedInMatch) }], { status: 409, body: { error: 'No seats available' } });
        render(<InvitePage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Join Riverbend Transaction Services' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Riverbend Transaction Services has no free seats right now. Ask Pat Lee to add a seat, then open this link again.',
        );
        expect(screen.getByRole('button', { name: 'Join Riverbend Transaction Services' })).toBeEnabled();
    });

    it('shows the current state when the invitation expired while the page was open', async () => {
        serve(
            [{ body: invitation({}, signedInMatch) }, { body: invitation({ status: 'expired' }, signedInMatch) }],
            { status: 400, body: { error: 'Invite expired' } },
        );
        render(<InvitePage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Join Riverbend Transaction Services' }));

        expect(await screen.findByRole('heading', { name: 'This invitation has expired' })).toBeInTheDocument();
    });

    it('offers a retry when the invitation cannot be loaded', async () => {
        serve([{ body: { error: 'Internal server error' }, status: 500 }, { body: invitation() }]);
        render(<InvitePage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

        expect(await screen.findByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    });
});
