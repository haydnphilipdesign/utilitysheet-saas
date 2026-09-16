import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    assign: vi.fn(),
}));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
// The sample dialog is covered separately; keep this suite focused on the card.
vi.mock('@/components/test-drive/SampleSheetDialog', () => ({
    SampleSheetDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Sample utility sheet" /> : null),
}));

import { TestDriveCard } from '@/components/test-drive/TestDriveCard';

function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    }));
}

const originalLocation = window.location;

describe('TestDriveCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, assign: mocks.assign },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('offers the sample sheet and seller test as secondary actions with honest copy', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ status: 'eligible' })));
        render(<TestDriveCard source="onboarding" />);

        expect(screen.getByRole('heading', { name: 'See how UtilitySheet works' })).toBeInTheDocument();
        const start = await screen.findByRole('button', { name: 'Start seller test' });
        expect(screen.getByText(/does not count toward your plan/i)).toBeInTheDocument();
        expect(screen.queryByText(/production pdf/i)).not.toBeInTheDocument();

        const sample = screen.getByRole('button', { name: 'View sample sheet' });
        for (const button of [start, sample]) {
            expect(button.className).toContain('border-border');
            expect(button.className).not.toContain('bg-primary ');
        }

        fireEvent.click(sample);
        expect(screen.getByRole('dialog', { name: 'Sample utility sheet' })).toBeInTheDocument();
    });

    it('starts an eligible test in one click and navigates in the same tab without sensitive analytics', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }))
            .mockImplementationOnce(() => jsonResponse({
                status: 'ready',
                sellerUrl: '/s/private-token',
                invitationDelivery: 'sent',
            }, 201));
        vi.stubGlobal('fetch', fetchMock);
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        render(<TestDriveCard source="onboarding" reusableSellerLink="https://example.com/i/real" />);
        fireEvent.click(await screen.findByRole('button', { name: 'Start seller test' }));

        await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/s/private-token'));
        expect(fetchMock).toHaveBeenLastCalledWith('/api/test-drive', { method: 'POST' });
        expect(openSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /starting your test/i })).toBeDisabled();
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_offer_viewed', { source: 'onboarding', state: 'eligible' });
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_started', { source: 'onboarding' });
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_opened', { source: 'onboarding', action: 'open' });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('private-token');
    });

    it('shows a start failure with a retry that returns to the start action', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }))
            .mockImplementationOnce(() => jsonResponse({ error: 'Too many attempts. Please slow down.' }, 429))
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }));
        vi.stubGlobal('fetch', fetchMock);

        render(<TestDriveCard source="dashboard" />);
        fireEvent.click(await screen.findByRole('button', { name: 'Start seller test' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
        expect(mocks.assign).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByRole('button', { name: 'Start seller test' })).toBeEnabled();
    });

    it('resumes an unfinished test with a same-tab link and precise save copy', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'ready',
            sellerUrl: '/s/private-token',
            invitationDelivery: 'failed',
        })));
        render(<TestDriveCard source="dashboard" />);

        const resume = await screen.findByRole('link', { name: 'Resume seller test' });
        expect(resume).toHaveAttribute('href', '/s/private-token');
        expect(resume).not.toHaveAttribute('target');
        expect(screen.getByText(/could not email you the test link/i)).toBeInTheDocument();
        expect(screen.getByText(/saved in the browser where you enter them/i)).toBeInTheDocument();

        fireEvent.click(resume);
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_opened', { source: 'dashboard', action: 'resume' });
    });

    it('mentions the emailed link only when the invitation was sent', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'ready',
            sellerUrl: '/s/private-token',
            invitationDelivery: 'pending',
        })));
        render(<TestDriveCard source="dashboard" />);
        await screen.findByRole('link', { name: 'Resume seller test' });
        expect(screen.queryByText(/emailed you/i)).not.toBeInTheDocument();
    });

    it('shows saved output after a delivery failure and the next real-use step', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'completed',
            reviewUrl: '/packet/private-public-token',
            pdfUrl: '/api/packet/private-public-token/pdf',
            delivery: 'failed',
        })));

        render(<TestDriveCard source="dashboard" reusableSellerLink="https://example.com/i/real-link" />);
        expect(await screen.findByText(/test sheet is saved/i)).toBeInTheDocument();
        expect(screen.queryByText(/we also emailed/i)).not.toBeInTheDocument();

        const sheet = screen.getByRole('link', { name: /open test sheet/i });
        const pdf = screen.getByRole('link', { name: /download pdf/i });
        expect(sheet).toHaveAttribute('href', '/packet/private-public-token');
        expect(pdf).toHaveAttribute('href', '/api/packet/private-public-token/pdf');
        fireEvent.click(pdf);
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_output_opened', { source: 'dashboard', output: 'pdf' });

        expect(screen.getByText('Next: use it on a real transaction')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Copy seller link' }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/i/real-link'));
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_seller_link_copied', { source: 'dashboard' });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('real-link');
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('private-public-token');
    });

    it('describes email delivery only when it is recorded as sent', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
            status: 'completed',
            reviewUrl: '/packet/t',
            pdfUrl: '/api/packet/t/pdf',
            delivery: 'pending',
        })));
        render(<TestDriveCard source="onboarding" />);
        await screen.findByText('Seller test complete');
        expect(screen.queryByText(/emailed/i)).not.toBeInTheDocument();
    });

    it('hides the whole guide on the dashboard for accounts with real submissions', async () => {
        const fetchMock = vi.fn(() => jsonResponse({ status: 'ineligible', reason: 'live_submission' }));
        vi.stubGlobal('fetch', fetchMock);
        const { container } = render(<TestDriveCard source="dashboard" />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_offer_viewed', {
            source: 'dashboard',
            state: 'ineligible',
        }));
        expect(container).toBeEmptyDOMElement();
    });

    it('points onboarding users with real submissions to their sheets instead of a test', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ status: 'ineligible', reason: 'live_submission' })));
        render(<TestDriveCard source="onboarding" />);
        expect(await screen.findByRole('link', { name: 'View submitted sheets' })).toHaveAttribute(
            'href',
            '/dashboard/requests?status=submitted'
        );
        expect(screen.queryByRole('button', { name: 'Start seller test' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View sample sheet' })).toBeInTheDocument();
    });

    it('keeps the sample sheet available and offers retry when test state fails to load', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => jsonResponse({ error: 'Temporary problem' }, 500))
            .mockImplementationOnce(() => jsonResponse({ status: 'eligible' }));
        vi.stubGlobal('fetch', fetchMock);
        render(<TestDriveCard source="dashboard" />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Temporary problem');
        expect(screen.getByRole('button', { name: 'View sample sheet' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByRole('button', { name: 'Start seller test' })).toBeInTheDocument();
    });
});
