import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        primaryEmail: 'owner@example.com',
        primaryEmailVerified: true,
        hasPassword: true,
        updatePassword: vi.fn(),
    }),
}));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import { AccountSecuritySettings } from '@/components/settings/account-security';

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AccountSecuritySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
            primaryEmail: 'owner@example.com',
            primaryEmailVerified: true,
            hasPassword: true,
            methods: { credential: true, magicLink: false, passkey: false, oauthProviders: [] },
            contactChannels: [{
                id: 'email_1',
                value: 'owner@example.com',
                isPrimary: true,
                isVerified: true,
                usedForAuth: true,
            }],
            sessions: [{
                id: 'current',
                createdAt: '2026-07-21T12:00:00.000Z',
                lastUsedAt: '2026-07-21T12:05:00.000Z',
                isCurrentSession: true,
                isImpersonation: false,
                location: null,
            }, {
                id: 'other',
                createdAt: '2026-07-20T12:00:00.000Z',
                lastUsedAt: '2026-07-20T12:05:00.000Z',
                isCurrentSession: false,
                isImpersonation: false,
                location: 'New York, NY, US',
            }],
        })));
    });

    it('labels security controls and confirms before revoking another session', async () => {
        render(<AccountSecuritySettings />);

        expect(await screen.findByRole('heading', { name: 'Sign-in methods' })).toBeInTheDocument();
        expect(screen.getByLabelText('Add another email')).toHaveAttribute('type', 'email');

        fireEvent.click(screen.getByRole('button', { name: /Revoke session last used/i }));
        expect(await screen.findByRole('dialog')).toHaveAccessibleName('Revoke session');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
