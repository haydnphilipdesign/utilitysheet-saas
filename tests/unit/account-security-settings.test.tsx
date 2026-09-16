import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    user: {
        primaryEmail: 'owner@example.com',
        primaryEmailVerified: true,
        hasPassword: true,
        updatePassword: vi.fn(),
        signOut: vi.fn(),
    },
    signInWithCredential: vi.fn(),
}));

vi.mock('@stackframe/stack', () => ({
    useUser: () => mocks.user,
}));
vi.mock('@/lib/stack/client', () => ({
    stackClientApp: { signInWithCredential: mocks.signInWithCredential },
}));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { AccountSecuritySettings } from '@/components/settings/account-security';

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const securitySummary = {
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
};

const recentAuthRequired = () => jsonResponse({ error: 'Recent sign-in required', code: 'RECENT_AUTH_REQUIRED' }, 403);

describe('AccountSecuritySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.hasPassword = true;
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(securitySummary)));
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

    it('asks password users to confirm their password and explains the five-minute window', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(recentAuthRequired());
        render(<AccountSecuritySettings />);

        expect(await screen.findByText('Confirm your password to continue')).toBeInTheDocument();
        expect(screen.getByText(/stay unlocked for five minutes/i)).toBeInTheDocument();
        expect(screen.queryByText(/verify/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Confirm password' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveAccessibleName('Confirm your password');
        expect(dialog).toHaveAccessibleDescription(/won’t be asked again for five minutes/);
        expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    });

    it('shows a clear error when the password is wrong and does not unlock settings', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(recentAuthRequired());
        mocks.signInWithCredential.mockResolvedValue({ status: 'error', error: new Error('bad') });
        render(<AccountSecuritySettings />);

        fireEvent.click(await screen.findByRole('button', { name: 'Confirm password' }));
        fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'wrong-password' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Confirm password' }).at(-1)!);

        expect(await screen.findByRole('alert')).toHaveTextContent('That password is incorrect.');
        expect(mocks.signInWithCredential).toHaveBeenCalledWith(expect.objectContaining({
            email: 'owner@example.com',
            noRedirect: true,
        }));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('confirms the password, reloads protected settings, and reports the unlock window', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(recentAuthRequired());
        mocks.signInWithCredential.mockResolvedValue({ status: 'ok' });
        render(<AccountSecuritySettings />);

        fireEvent.click(await screen.findByRole('button', { name: 'Confirm password' }));
        fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'right-password' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Confirm password' }).at(-1)!);

        expect(await screen.findByRole('heading', { name: 'Sign-in methods' })).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith('Password confirmed. Sensitive settings are unlocked for five minutes.');
    });

    it('offers password-less accounts a sign-in-again path back to Account settings', async () => {
        mocks.user.hasPassword = false;
        vi.mocked(fetch).mockResolvedValueOnce(recentAuthRequired());
        render(<AccountSecuritySettings />);

        expect(await screen.findByText('Sign in again to continue')).toBeInTheDocument();
        expect(screen.getByText(/doesn’t use a password/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm password' })).not.toBeInTheDocument();

        const button = screen.getByRole('button', { name: 'Sign in again' });
        expect(button).toBeEnabled();
        fireEvent.click(button);

        await waitFor(() => expect(mocks.user.signOut).toHaveBeenCalledWith({
            redirectUrl: `/auth/login?next=${encodeURIComponent('/dashboard/settings?tab=account')}`,
        }));
    });

    it('does not ask a password-less account for a password when the window expires mid-session', async () => {
        mocks.user.hasPassword = false;
        render(<AccountSecuritySettings />);

        fireEvent.click(await screen.findByRole('button', { name: 'Revoke all others' }));
        vi.mocked(fetch).mockResolvedValueOnce(recentAuthRequired());
        fireEvent.click(await screen.findByRole('button', { name: 'Revoke sessions' }));

        const dialog = await screen.findByRole('dialog', { name: 'Sign in again' });
        expect(dialog).toBeInTheDocument();
        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Confirm it’s you, then try again.');
    });
});
