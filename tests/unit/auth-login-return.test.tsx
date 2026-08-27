import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    signInWithOAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@/lib/stack/client', () => ({
    stackClientApp: {
        signInWithCredential: vi.fn(),
        signInWithOAuth: mocks.signInWithOAuth,
    },
}));

vi.mock('@/lib/stack/use-auth-config', () => ({
    useAuthConfig: () => ({
        credentialEnabled: true,
        oauthProviderIds: ['google'],
    }),
}));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/activation', () => ({
    consumePendingSignupVerification: vi.fn(() => false),
    trackActivationResponse: vi.fn(),
}));

import LoginPage from '@/app/auth/login/page';

describe('login invite return behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/auth/login?next=%2Finvite%2Ftok_1');
        mocks.signInWithOAuth.mockResolvedValue(undefined);
    });

    it('does not redirect an unauthenticated visitor back to the invite before sign-in', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));

        render(<LoginPage />);

        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/account'));
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('returns an existing authenticated session to the invite', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));

        render(<LoginPage />);

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/invite/tok_1'));
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it('remembers the invite immediately before starting Google OAuth', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
        render(<LoginPage />);

        fireEvent.click(await screen.findByTestId('login-google'));

        await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledWith('google'));
        expect(window.sessionStorage.getItem('utilitysheet:post-auth-return-to')).toBe('/invite/tok_1');
    });
});
