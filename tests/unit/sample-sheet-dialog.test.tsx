import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    toastError: vi.fn(),
    generateTestPdf: vi.fn(),
}));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock('@/lib/test-pdf-generator', () => ({ generateTestPdf: mocks.generateTestPdf }));

import { SampleSheetDialog } from '@/components/test-drive/SampleSheetDialog';

function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    }));
}

const savedProfile = {
    id: 'brand_1',
    name: 'Maple Realty',
    primary_color: '#2563eb',
    secondary_color: '#1e40af',
    logo_url: null,
    contact_name: 'Pat Agent',
    contact_email: 'pat@example.com',
    contact_phone: null,
    contact_website: null,
    is_default: true,
    show_powered_by: true,
    show_generation_date: true,
};

function previewHtml() {
    return screen.getByTitle('Branding profile PDF preview').getAttribute('srcdoc') || '';
}

describe('SampleSheetDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not fetch anything until opened', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<SampleSheetDialog open={false} onOpenChange={() => {}} source="dashboard" />);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('renders the production document with saved branding and says so', async () => {
        const fetchMock = vi.fn((url: string) => (url === '/api/branding'
            ? jsonResponse([savedProfile])
            : jsonResponse({ account: { subscription_status: 'free' } })));
        vi.stubGlobal('fetch', fetchMock);

        render(<SampleSheetDialog open onOpenChange={() => {}} source="dashboard" />);

        expect(await screen.findByText(/shown with your saved default Branding Profile/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Sample utility sheet' })).toBeInTheDocument();
        expect(previewHtml()).toContain('Maple Realty');
        expect(previewHtml()).toContain('Utility Info Sheet');
        expect(screen.getByText('Sample sheet')).toBeInTheDocument();
        // Read-only: every call is a plain GET with no request options.
        expect(fetchMock.mock.calls.every((call) => call.length === 1)).toBe(true);
        await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_viewed', { source: 'dashboard', branding: 'saved' }));
    });

    it('falls back to labelled placeholder branding when branding cannot load', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ error: 'nope' }, 500)));
        render(<SampleSheetDialog open onOpenChange={() => {}} source="onboarding" />);

        expect(await screen.findByText(/placeholder branding/i)).toBeInTheDocument();
        expect(previewHtml()).toContain('Your Brand');
        await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_viewed', { source: 'onboarding', branding: 'generic' }));
    });

    it('downloads the sample PDF through the existing test-PDF path with Free gating', async () => {
        vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/branding'
            ? jsonResponse([savedProfile])
            : jsonResponse({ account: { subscription_status: 'free' } }))));
        mocks.generateTestPdf.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Rate limit exceeded. Please slow down.'));

        render(<SampleSheetDialog open onOpenChange={() => {}} source="dashboard" />);
        const download = await screen.findByRole('button', { name: 'Download sample PDF' });
        await waitFor(() => expect(download).toBeEnabled());

        fireEvent.click(download);
        await waitFor(() => expect(mocks.generateTestPdf).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Maple Realty', primary_color: '#2563eb' }),
            'simple'
        ));
        await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_pdf_downloaded', { source: 'dashboard', success: true }));

        fireEvent.click(screen.getByRole('button', { name: 'Download sample PDF' }));
        await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Rate limit exceeded. Please slow down.'));
        expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_pdf_downloaded', { source: 'dashboard', success: false });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('Maple');
    });
});
