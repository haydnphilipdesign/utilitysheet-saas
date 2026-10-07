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
        signUpWithCredential: vi.fn(),
        signInWithCredential: vi.fn(),
        signInWithOAuth: mocks.signInWithOAuth,
        getUser: vi.fn(),
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
    rememberPendingSignupVerification: vi.fn(),
    trackActivationResponse: vi.fn(),
}));
vi.mock('@/lib/growth/attribution', () => ({ persistPendingGrowthAttribution: vi.fn(async () => undefined) }));

import SignupPage from '@/app/auth/signup/page';

const TEAMS_BILLING = '/dashboard/settings?tab=billing&plan=teams';

function signedOut() {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
}

function signedIn() {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })));
}

describe('sign-up from a paid plan on the pricing page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        mocks.signInWithOAuth.mockResolvedValue(undefined);
    });

    it('says the account is the first step to Teams', async () => {
        window.history.replaceState({}, '', '/auth/signup?plan=teams');
        signedOut();
        render(<SignupPage />);

        expect(await screen.findByRole('heading', { name: 'Create an account to start Teams' })).toBeInTheDocument();
        expect(screen.getByText(/Next you’ll choose how many seats you need and start Teams\./)).toBeInTheDocument();
        expect(screen.getByTestId('signup-submit')).toHaveTextContent('Create account');
        expect(screen.getByRole('link', { name: 'Sign in' }))
            .toHaveAttribute('href', `/auth/login?next=${encodeURIComponent(TEAMS_BILLING)}`);
    });

    it('sends someone who is already signed in to the Teams section of Billing', async () => {
        window.history.replaceState({}, '', '/auth/signup?plan=teams');
        signedIn();
        render(<SignupPage />);

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(TEAMS_BILLING));
    });

    it('remembers the Teams destination before starting Google sign-up', async () => {
        window.history.replaceState({}, '', '/auth/signup?plan=teams');
        signedOut();
        render(<SignupPage />);

        fireEvent.click(await screen.findByTestId('signup-google'));

        await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledWith('google'));
        expect(window.sessionStorage.getItem('utilitysheet:post-auth-return-to')).toBe(TEAMS_BILLING);
    });

    it('keeps an invitation ahead of the plan', async () => {
        window.history.replaceState({}, '', '/auth/signup?plan=teams&next=%2Finvite%2Ftok_1');
        signedIn();
        render(<SignupPage />);

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/invite/tok_1'));
        expect(screen.getByRole('heading', { name: 'Create an account to join your team' })).toBeInTheDocument();
    });

    it('sends a Pro sign-up to Billing to start checkout and says so', async () => {
        window.history.replaceState({}, '', '/auth/signup?plan=pro');
        signedIn();
        render(<SignupPage />);

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard/settings?tab=billing&plan=pro'));
        expect(screen.getByRole('heading', { name: 'Create an account to start Pro' })).toBeInTheDocument();
        expect(screen.getByText(/Next you’ll go to secure checkout to start Pro\./)).toBeInTheDocument();
        expect(screen.getByTestId('signup-submit')).toHaveTextContent('Create account');
    });

    it('leaves a plain sign-up going to the dashboard', async () => {
        window.history.replaceState({}, '', '/auth/signup');
        signedIn();
        render(<SignupPage />);

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
        expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
        expect(screen.getByTestId('signup-submit')).toHaveTextContent('Start Free');
    });
});
