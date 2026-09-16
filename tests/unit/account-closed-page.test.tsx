import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountClosedPage from '@/app/account-closed/page';

function response(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('AccountClosedPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the retry state for a partial failure after data removal', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
            status: 'closing', step: 'assets_removed', errorCode: 'auth_delete_failed',
        })));

        render(<AccountClosedPage />);

        expect(await screen.findByRole('heading', { name: 'We’re finishing closing your account' })).toBeInTheDocument();
        expect(screen.getByText(/data has been removed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again now' })).toBeInTheDocument();
    });

    it('shows success when Stack has removed the authenticated session', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Unauthorized' }, 401)));

        render(<AccountClosedPage />);

        expect(await screen.findByRole('heading', { name: 'Your account is closed' })).toBeInTheDocument();
        expect(screen.getByText(/shared in a team workspace now belong/i)).toBeInTheDocument();
    });

    it('does not claim closure succeeded when status cannot be verified', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

        render(<AccountClosedPage />);

        expect(await screen.findByRole('heading', { name: 'We couldn’t check your account' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Your account is closed' })).not.toBeInTheDocument();
    });
});

