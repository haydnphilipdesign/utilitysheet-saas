import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

const { authState, signOutMock, trackEventMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    authState: {
        user: {
            id: 'user_a',
            displayName: 'Test User',
            primaryEmail: 'test@example.com',
            signOut: vi.fn(),
        },
    },
    signOutMock: vi.fn(),
    trackEventMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@stackframe/stack', () => ({
    useUser: () => authState.user,
}));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: trackEventMock }));

vi.mock('sonner', () => ({
    toast: {
        success: toastSuccessMock,
        error: toastErrorMock,
    },
}));

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function makeFetchMock() {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : String(input);
        const method = (init?.method || 'GET').toUpperCase();

        if (url === '/api/account' && method === 'GET') {
            return jsonResponse({
                account: {
                    id: 'acc_1',
                    full_name: 'Test User',
                    email: 'test@example.com',
                    notification_preferences: {},
                },
                activeOrganization: null,
                organizations: [],
                usage: { used: 0, limit: 3, plan: 'free' },
            });
        }

        if (url === '/api/intake-link' && method === 'GET') {
            return jsonResponse({
                intakeLink: {
                    slug: 'test-link',
                    url: 'https://utilitysheet.com/i/test-link',
                    is_active: true,
                },
                canCustomize: false,
            });
        }

        if (url === '/api/referrals' && method === 'GET') {
            return jsonResponse({
                referralLink: 'https://utilitysheet.com/auth/signup?ref=referrer-slug',
                counts: { earned: 2, applied: 1 },
            });
        }

        return jsonResponse({ error: 'Not found' }, 404);
    });
}

describe('settings referral credit card', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState.user = {
            id: 'user_a',
            displayName: 'Test User',
            primaryEmail: 'test@example.com',
            signOut: signOutMock,
        };
        vi.stubGlobal('fetch', makeFetchMock());
    });

    it('fetches the referral summary only once during Strict Mode effect replay', async () => {
        const fetchMock = makeFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        render(
            <StrictMode>
                <SettingsPage />
            </StrictMode>
        );

        expect(await screen.findByText('Give a month of Pro, get a month of Pro')).toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => url === '/api/referrals')).toHaveLength(1);
        await waitFor(() => expect(trackEventMock).toHaveBeenCalledTimes(1));
        expect(trackEventMock).toHaveBeenCalledWith('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: 2,
            applied_count: 1,
        });
    });

    it('renders the referral summary and tracks its view exactly once', async () => {
        render(<SettingsPage />);

        expect(await screen.findByText('Give a month of Pro, get a month of Pro')).toBeInTheDocument();
        const input = screen.getByDisplayValue('https://utilitysheet.com/auth/signup?ref=referrer-slug');
        expect(input).toHaveAttribute('readonly');
        expect(screen.getByText('2 available')).toBeInTheDocument();
        expect(screen.getByText('1 applied')).toBeInTheDocument();

        await waitFor(() => {
            expect(trackEventMock).toHaveBeenCalledTimes(1);
        });
        expect(trackEventMock).toHaveBeenCalledWith('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: 2,
            applied_count: 1,
        });
    });

    it('copies the exact referral URL, shows success, and tracks the copy', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        render(<SettingsPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Copy referral link' }));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith('https://utilitysheet.com/auth/signup?ref=referrer-slug');
            expect(toastSuccessMock).toHaveBeenCalled();
            expect(trackEventMock).toHaveBeenCalledWith('referral_credit_link_copied', {
                location: 'dashboard_settings',
            });
        });
    });

    it('shows an error and does not track a copied event when clipboard access fails', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        render(<SettingsPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Copy referral link' }));

        await waitFor(() => {
            expect(toastErrorMock).toHaveBeenCalled();
        });
        expect(trackEventMock).not.toHaveBeenCalledWith(
            'referral_credit_link_copied',
            expect.anything()
        );
    });

    it('clears a loaded summary immediately and tracks the next user view separately', async () => {
        let resolveUserB!: (response: Response) => void;
        const userBResponse = new Promise<Response>((resolve) => { resolveUserB = resolve; });
        const fallbackFetch = makeFetchMock();
        let referralCallCount = 0;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            if (url === '/api/referrals') {
                referralCallCount += 1;
                if (referralCallCount === 1) {
                    return jsonResponse({
                        referralLink: 'https://utilitysheet.com/auth/signup?ref=user-a',
                        counts: { earned: 2, applied: 1 },
                    });
                }
                return userBResponse;
            }
            return fallbackFetch(input, init);
        }));

        const { rerender } = render(<SettingsPage />);
        expect(await screen.findByDisplayValue('https://utilitysheet.com/auth/signup?ref=user-a')).toBeInTheDocument();
        await waitFor(() => expect(trackEventMock).toHaveBeenCalledWith('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: 2,
            applied_count: 1,
        }));

        authState.user = {
            id: 'user_b',
            displayName: 'Second User',
            primaryEmail: 'second@example.com',
            signOut: signOutMock,
        };
        rerender(<SettingsPage />);

        expect(screen.queryByDisplayValue('https://utilitysheet.com/auth/signup?ref=user-a')).not.toBeInTheDocument();
        expect(screen.queryByText('Give a month of Pro, get a month of Pro')).not.toBeInTheDocument();

        await act(async () => {
            resolveUserB(jsonResponse({
                referralLink: 'https://utilitysheet.com/auth/signup?ref=user-b',
                counts: { earned: 1, applied: 3 },
            }));
        });
        expect(await screen.findByDisplayValue('https://utilitysheet.com/auth/signup?ref=user-b')).toBeInTheDocument();

        const viewedCalls = trackEventMock.mock.calls.filter(([eventName]) => (
            eventName === 'referral_credit_card_viewed'
        ));
        expect(viewedCalls).toEqual([
            ['referral_credit_card_viewed', {
                location: 'dashboard_settings',
                earned_count: 2,
                applied_count: 1,
            }],
            ['referral_credit_card_viewed', {
                location: 'dashboard_settings',
                earned_count: 1,
                applied_count: 3,
            }],
        ]);
    });

    it('ignores a stale user response and resets summary, copy, and view tracking for the next user', async () => {
        let resolveUserA!: (response: Response) => void;
        let resolveUserB!: (response: Response) => void;
        const userAResponse = new Promise<Response>((resolve) => { resolveUserA = resolve; });
        const userBResponse = new Promise<Response>((resolve) => { resolveUserB = resolve; });
        let referralCallCount = 0;
        const fallbackFetch = makeFetchMock();
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : String(input);
            if (url === '/api/referrals') {
                referralCallCount += 1;
                return referralCallCount === 1 ? userAResponse : userBResponse;
            }
            return fallbackFetch(input, init);
        });
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        vi.stubGlobal('fetch', fetchMock);

        const { rerender } = render(<SettingsPage />);
        await waitFor(() => expect(referralCallCount).toBe(1));

        authState.user = {
            id: 'user_b',
            displayName: 'Second User',
            primaryEmail: 'second@example.com',
            signOut: signOutMock,
        };
        rerender(<SettingsPage />);
        await waitFor(() => expect(referralCallCount).toBe(2));

        await act(async () => {
            resolveUserB(jsonResponse({
                referralLink: 'https://utilitysheet.com/auth/signup?ref=user-b',
                counts: { earned: 1, applied: 3 },
            }));
        });
        expect(await screen.findByDisplayValue('https://utilitysheet.com/auth/signup?ref=user-b')).toBeInTheDocument();
        expect(screen.getByText('1 available')).toBeInTheDocument();
        expect(screen.getByText('3 applied')).toBeInTheDocument();

        await act(async () => {
            resolveUserA(jsonResponse({
                referralLink: 'https://utilitysheet.com/auth/signup?ref=user-a',
                counts: { earned: 8, applied: 4 },
            }));
        });
        expect(screen.queryByDisplayValue('https://utilitysheet.com/auth/signup?ref=user-a')).not.toBeInTheDocument();
        expect(screen.queryByText('8 available')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Copy referral link' }));
        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith('https://utilitysheet.com/auth/signup?ref=user-b');
        });
        expect(trackEventMock).toHaveBeenCalledTimes(2);
        expect(trackEventMock).toHaveBeenCalledWith('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: 1,
            applied_count: 3,
        });
        expect(trackEventMock).not.toHaveBeenCalledWith('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: 8,
            applied_count: 4,
        });
    });
});
