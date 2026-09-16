import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.trackEvent }));

import { SuccessStep } from '@/components/seller-form/steps/SuccessStep';
import { WelcomeStep } from '@/components/seller-form/steps/WelcomeStep';

function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    }));
}

const completed = {
    status: 'completed',
    reviewUrl: '/packet/public-token',
    pdfUrl: '/api/packet/public-token/pdf',
    delivery: 'sent',
};

describe('seller test-drive completion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows evaluator next steps and authorized output links instead of seller messaging', async () => {
        const fetchMock = vi.fn(() => jsonResponse(completed));
        vi.stubGlobal('fetch', fetchMock);

        render(<SuccessStep isTestDrive sellerToken="seller-token" brandProfile={{ name: 'Maple Realty' }} propertyAddress="[TEST] 123 Maple Street" />);

        expect(screen.getByRole('heading', { name: 'Your test is complete' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('/api/test-drive');
        expect(await screen.findByRole('link', { name: 'Open test sheet' })).toHaveAttribute('href', '/packet/public-token');
        expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', '/api/packet/public-token/pdf');
        expect(screen.getByText(/we also emailed it/i)).toBeInTheDocument();

        expect(screen.queryByText(/has been notified/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/will take it from here/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/safely close this page/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/want a copy/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('link', { name: 'Open test sheet' }));
        const back = screen.getByRole('link', { name: /back to dashboard/i });
        expect(back).toHaveAttribute('href', '/dashboard');
        fireEvent.click(back);
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_output_opened', { source: 'seller_success', output: 'web' });
        expect(mocks.trackEvent).toHaveBeenCalledWith('test_drive_dashboard_returned', { source: 'seller_success' });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('public-token');
    });

    it('does not claim delivery when it failed or is unknown', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ ...completed, delivery: 'failed' })));
        const { unmount } = render(<SuccessStep isTestDrive />);
        expect(await screen.findByText(/could not email your copy/i)).toBeInTheDocument();
        expect(screen.queryByText(/we also emailed/i)).not.toBeInTheDocument();
        unmount();

        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ ...completed, delivery: 'pending' })));
        render(<SuccessStep isTestDrive />);
        await screen.findByRole('link', { name: 'Open test sheet' });
        expect(screen.queryByText(/emailed/i)).not.toBeInTheDocument();
    });

    it('falls back to the dashboard when this browser is signed out', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ error: 'Unauthorized' }, 401)));
        render(<SuccessStep isTestDrive />);
        expect(await screen.findByText(/not signed in/i)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Open test sheet' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
    });

    it('offers retry when the output links fail to load', async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => Promise.reject(new Error('offline')))
            .mockImplementationOnce(() => jsonResponse(completed));
        vi.stubGlobal('fetch', fetchMock);
        render(<SuccessStep isTestDrive />);
        expect(await screen.findByRole('alert')).toHaveTextContent(/answers were saved/i);
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByRole('link', { name: 'Open test sheet' })).toBeInTheDocument();
    });

    it('keeps the real seller completion unchanged', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<SuccessStep sellerToken="seller-token" brandProfile={{ name: 'Maple Realty' }} />);
        expect(screen.getByRole('heading', { name: 'All Done!' })).toBeInTheDocument();
        expect(screen.getByText(/Maple Realty has been notified/)).toBeInTheDocument();
        expect(screen.getByText(/want a copy/i)).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps the public demo completion unchanged', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<SuccessStep isDemo />);
        expect(screen.getByRole('heading', { name: /how easy it is/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /get started free/i })).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('seller welcome step', () => {
    it('explains the evaluator role for test drives', () => {
        render(<WelcomeStep address="[TEST] 123 Maple Street" onNext={() => {}} isTestDrive />);
        expect(screen.getByRole('heading', { name: /see what your seller sees/i })).toBeInTheDocument();
        expect(screen.getByText(/made-up providers and details are fine/i)).toBeInTheDocument();
        expect(screen.getByText(/does not count toward your plan/i)).toBeInTheDocument();
        expect(screen.getByText(/saves automatically in this browser/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /start the test/i })).toBeInTheDocument();
    });

    it('keeps real seller copy and is precise about where progress is saved', () => {
        render(<WelcomeStep address="1 Real St" onNext={() => {}} />);
        expect(screen.getByRole('heading', { name: /tell us about the home/i })).toBeInTheDocument();
        expect(screen.getByText(/saves automatically in this browser/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('does not promise saved progress in the public demo', () => {
        render(<WelcomeStep address="1 Demo St" onNext={() => {}} savesProgress={false} />);
        expect(screen.queryByText(/saves automatically/i)).not.toBeInTheDocument();
    });
});
