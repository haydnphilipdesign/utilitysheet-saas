import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { TestDriveCard } from '@/components/test-drive/TestDriveCard';

function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    }));
}

describe('TestDriveCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    it('starts an eligible test and opens the returned seller flow without sensitive analytics', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }))
            .mockImplementationOnce(() => jsonResponse({
                status: 'ready',
                sellerUrl: '/s/private-token',
                invitationDelivery: 'sent',
            }, 201));
        vi.stubGlobal('fetch', fetchMock);

        render(<TestDriveCard source="onboarding" reusableSellerLink="https://example.com/i/real" />);
        const startButton = await screen.findByRole('button', { name: /send yourself a test utilitysheet/i });
        await waitFor(() => {
            expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_offer_viewed', {
                source: 'onboarding',
                state: 'eligible',
            });
        });

        fireEvent.click(startButton);
        const openButton = await screen.findByRole('button', { name: /open or resume test/i });
        fireEvent.click(openButton);

        expect(fetchMock).toHaveBeenLastCalledWith('/api/test-drive', { method: 'POST' });
        expect(window.open).toHaveBeenCalledWith('/s/private-token', '_blank', 'noopener,noreferrer');
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_started', { source: 'onboarding' });
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_opened', {
            source: 'onboarding',
            action: 'resume',
        });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('private-token');
    });

    it('keeps a failed invitation directly resumable', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'ready',
            sellerUrl: '/s/private-token',
            invitationDelivery: 'failed',
        })));
        render(<TestDriveCard source="dashboard" />);
        expect(await screen.findByText(/email could not be delivered/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /open or resume test/i })).toBeEnabled();
    });

    it('shows saved review paths after completion delivery failure and copies the real seller link', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'completed',
            reviewUrl: '/packet/private-public-token',
            pdfUrl: '/api/packet/private-public-token/pdf',
            delivery: 'failed',
        })));

        render(<TestDriveCard source="dashboard" reusableSellerLink="https://example.com/i/real-link" />);
        expect(await screen.findByText(/submission was saved/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /review completed test/i })).toHaveAttribute('href', '/packet/private-public-token');
        expect(screen.getByRole('link', { name: /download production pdf/i })).toHaveAttribute('href', '/api/packet/private-public-token/pdf');

        fireEvent.click(screen.getByRole('button', { name: /copy reusable seller link/i }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/i/real-link'));
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_seller_link_copied', { source: 'dashboard' });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('real-link');
    });

    it('renders the live-submission ineligible state without a test CTA', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ status: 'ineligible', reason: 'live_submission' })));
        render(<TestDriveCard source="dashboard" />);
        expect(await screen.findByText(/already completed the real workflow/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /send yourself/i })).not.toBeInTheDocument();
    });

    it('offers an accessible retry after a recoverable API error', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => jsonResponse({ error: 'Temporary problem' }, 500))
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }));
        vi.stubGlobal('fetch', fetchMock);
        render(<TestDriveCard source="onboarding" />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Temporary problem');
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByRole('button', { name: /send yourself a test utilitysheet/i })).toBeInTheDocument();
    });
});
