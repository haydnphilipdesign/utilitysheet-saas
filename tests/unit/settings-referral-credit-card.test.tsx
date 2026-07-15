import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPage from '@/app/dashboard/settings/page';

const { signOutMock, trackEventMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    signOutMock: vi.fn(),
    trackEventMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@stackframe/stack', () => ({
    useUser: () => ({
        displayName: 'Test User',
        primaryEmail: 'test@example.com',
        signOut: signOutMock,
    }),
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
        vi.stubGlobal('fetch', makeFetchMock());
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
});
