import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockUsePathname = vi.fn();

vi.mock('@/lib/stack/client', () => ({
    stackClientApp: {
        getUser: () => mockGetUser(),
    },
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
}));

import { AccountActivationSync } from '@/components/providers/account-activation-sync';

describe('AccountActivationSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        mockUsePathname.mockReturnValue('/dashboard');
        mockGetUser.mockResolvedValue(null);
    });

    it('does nothing when there is no authenticated user', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        render(<AccountActivationSync />);

        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('syncs the authenticated user once and remembers it for the session', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        mockGetUser.mockResolvedValue({ id: 'auth_123' });

        const { rerender } = render(<AccountActivationSync />);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/account', expect.objectContaining({
                method: 'GET',
                cache: 'no-store',
                credentials: 'include',
            }));
        });

        await waitFor(() => {
            expect(sessionStorage.getItem('utilitysheet:account-activation-sync:auth_123')).toBe('done');
        });

        rerender(<AccountActivationSync />);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mockGetUser).toHaveBeenCalledTimes(1);
    });
});
