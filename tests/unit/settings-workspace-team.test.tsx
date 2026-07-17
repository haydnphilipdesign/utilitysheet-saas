import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        id: 'user_admin',
        displayName: 'Admin User',
        primaryEmail: 'admin@example.com',
        signOut: vi.fn(),
    }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('Workspace & Team Settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('separates Billing from workspace administration and supports rename and resend', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            const method = (init?.method || 'GET').toUpperCase();

            if (url === '/api/account' && method === 'GET') {
                return jsonResponse({
                    account: {
                        id: 'acct_admin',
                        full_name: 'Admin User',
                        email: 'admin@example.com',
                        notification_preferences: {},
                    },
                    activeOrganization: {
                        id: 'org_1',
                        name: 'Acme Workspace',
                        slug: 'acme-workspace',
                        role: 'admin',
                        subscription_status: 'team',
                        seat_quantity: 4,
                    },
                    usage: { used: 0, limit: 999, plan: 'team' },
                });
            }

            if (url === '/api/intake-link' && method === 'GET') {
                return jsonResponse({
                    intakeLink: {
                        slug: 'acme-link',
                        url: 'https://example.com/i/acme-link',
                        is_active: true,
                    },
                    canCustomize: true,
                });
            }

            if (url === '/api/organization/members' && method === 'GET') {
                return jsonResponse({
                    organization: {
                        id: 'org_1',
                        name: 'Acme Workspace',
                        slug: 'acme-workspace',
                        subscription_status: 'team',
                        seat_quantity: 4,
                    },
                    role: 'admin',
                    members: [
                        {
                            account_id: 'acct_admin',
                            email: 'admin@example.com',
                            full_name: 'Admin User',
                            member_role: 'admin',
                        },
                    ],
                    seatUsage: { used: 1, pendingInvites: 1 },
                });
            }

            if (url === '/api/organization/invites' && method === 'GET') {
                return jsonResponse({
                    invites: [
                        {
                            id: 'inv_1',
                            email: 'invitee@example.com',
                            role: 'member',
                            expires_at: '2026-07-24T12:00:00.000Z',
                            created_at: '2026-07-17T12:00:00.000Z',
                        },
                    ],
                });
            }

            if (url === '/api/organization' && method === 'PATCH') {
                const body = JSON.parse(String(init?.body || '{}'));
                return jsonResponse({
                    organization: {
                        id: 'org_1',
                        name: body.name,
                        slug: 'renamed-workspace',
                    },
                });
            }

            if (url === '/api/organization/invites/inv_1' && method === 'PATCH') {
                return jsonResponse({
                    invite: {
                        id: 'inv_1',
                        email: 'invitee@example.com',
                        role: 'member',
                        expires_at: '2026-07-31T12:00:00.000Z',
                    },
                    inviteUrl: 'http://localhost:3000/invite/tok_rotated',
                    emailSent: true,
                });
            }

            return jsonResponse({ error: 'Not found' }, 404);
        });

        vi.stubGlobal('fetch', fetchMock);
        render(<SettingsPage />);

        fireEvent.click(await screen.findByRole('tab', { name: 'Workspace & Team' }));

        expect(await screen.findByText('Workspace details')).toBeInTheDocument();
        expect(screen.getAllByText(/pending invitations each reserve one Team seat/i).length).toBeGreaterThan(0);
        expect(screen.getByText('invitee@example.com')).toBeInTheDocument();

        const nameInput = screen.getByLabelText('Workspace name');
        fireEvent.change(nameInput, { target: { value: 'Renamed Workspace' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save workspace name' }));

        await waitFor(() => {
            const renameCall = fetchMock.mock.calls.find(([url, init]) => (
                url === '/api/organization' && (init as RequestInit | undefined)?.method === 'PATCH'
            ));
            expect(renameCall).toBeTruthy();
            expect(JSON.parse(String((renameCall?.[1] as RequestInit).body))).toEqual({ name: 'Renamed Workspace' });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Resend invitation to invitee@example.com' }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/organization/invites/inv_1', expect.objectContaining({ method: 'PATCH' }));
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Billing' }));
        expect(await screen.findByText('Subscription')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Manage Teams Billing' })).toBeInTheDocument();
        expect(screen.queryByText('Workspace details')).not.toBeInTheDocument();
        expect(screen.queryByText('invitee@example.com')).not.toBeInTheDocument();
    });
});
