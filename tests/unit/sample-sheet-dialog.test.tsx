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

import { useState } from 'react';
import { SampleSheetDialog } from '@/components/test-drive/SampleSheetDialog';

/** Controlled host with real open/close so each opening can be exercised. */
function Host() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Open sample</button>
            <SampleSheetDialog open={open} onOpenChange={setOpen} source="onboarding" />
        </>
    );
}

async function openSample() {
    fireEvent.click(screen.getByRole('button', { name: 'Open sample' }));
    await screen.findByRole('heading', { name: 'Sample utility sheet' });
}

async function closeSample() {
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sample utility sheet' })).not.toBeInTheDocument());
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => { resolve = res; });
    return { promise, resolve };
}

const accountResponse = () => jsonResponse({ account: { subscription_status: 'free' } });


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
        // Read-only: every call is a GET that bypasses the HTTP cache.
        expect(fetchMock.mock.calls).toEqual([
            ['/api/branding', { cache: 'no-store' }],
            ['/api/account', { cache: 'no-store' }],
        ]);
        await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_viewed', { source: 'dashboard', branding: 'saved' }));
    });

    it('falls back to labelled placeholder branding when branding cannot load', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ error: 'nope' }, 500)));
        render(<SampleSheetDialog open onOpenChange={() => {}} source="onboarding" />);

        expect(await screen.findByText(/saved branding could not be loaded/i)).toBeInTheDocument();
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

    it('shows and downloads the latest saved branding after it changes between openings', async () => {
        let savedName = 'Maple Realty';
        vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/branding'
            ? jsonResponse([{ ...savedProfile, name: savedName }])
            : accountResponse())));
        mocks.generateTestPdf.mockResolvedValue(undefined);
        render(<Host />);

        await openSample();
        await waitFor(() => expect(previewHtml()).toContain('Maple Realty'));
        await closeSample();

        // Branding saved elsewhere on the page while the dialog is closed.
        savedName = 'Birch Homes';
        await openSample();
        await waitFor(() => expect(previewHtml()).toContain('Birch Homes'));
        expect(previewHtml()).not.toContain('Maple Realty');

        fireEvent.click(screen.getByRole('button', { name: 'Download sample PDF' }));
        await waitFor(() => expect(mocks.generateTestPdf).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Birch Homes' }),
            'simple'
        ));
        // One view event per opening.
        expect(mocks.trackEvent.mock.calls.filter(([name]) => name === 'sample_sheet_viewed')).toHaveLength(2);
    });

    it('recovers saved branding on the next opening after a failed load', async () => {
        let brandingFails = true;
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            if (url !== '/api/branding') return accountResponse();
            return brandingFails ? jsonResponse({ error: 'unavailable' }, 503) : jsonResponse([savedProfile]);
        }));
        render(<Host />);

        await openSample();
        expect(await screen.findByText(/saved branding could not be loaded/i)).toBeInTheDocument();
        expect(previewHtml()).toContain('Your Brand');
        await closeSample();

        brandingFails = false;
        await openSample();
        expect(await screen.findByText(/shown with your saved default Branding Profile/i)).toBeInTheDocument();
        expect(previewHtml()).toContain('Maple Realty');
        expect(mocks.trackEvent).toHaveBeenCalledWith('sample_sheet_viewed', { source: 'onboarding', branding: 'generic' });
        expect(mocks.trackEvent).toHaveBeenLastCalledWith('sample_sheet_viewed', { source: 'onboarding', branding: 'saved' });
    });

    it('ignores a slow response from an earlier opening', async () => {
        const firstBranding = deferred<Response>();
        let brandingCall = 0;
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            if (url !== '/api/branding') return accountResponse();
            brandingCall += 1;
            return brandingCall === 1
                ? firstBranding.promise
                : jsonResponse([{ ...savedProfile, name: 'Birch Homes' }]);
        }));
        mocks.generateTestPdf.mockResolvedValue(undefined);
        render(<Host />);

        await openSample();
        expect(screen.getByText('Loading sample sheet…')).toBeInTheDocument();
        await closeSample();

        await openSample();
        await waitFor(() => expect(previewHtml()).toContain('Birch Homes'));

        // The first opening's response finally arrives with older branding.
        firstBranding.resolve(new Response(JSON.stringify([{ ...savedProfile, name: 'Maple Realty' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(previewHtml()).toContain('Birch Homes');
        expect(previewHtml()).not.toContain('Maple Realty');
        fireEvent.click(screen.getByRole('button', { name: 'Download sample PDF' }));
        await waitFor(() => expect(mocks.generateTestPdf).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Birch Homes' }),
            'simple'
        ));
        const views = mocks.trackEvent.mock.calls.filter(([name]) => name === 'sample_sheet_viewed');
        expect(views).toEqual([['sample_sheet_viewed', { source: 'onboarding', branding: 'saved' }]]);
    });

    it('distinguishes an account with no saved branding from a failed load', async () => {
        vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/branding' ? jsonResponse([]) : accountResponse())));
        render(<SampleSheetDialog open onOpenChange={() => {}} source="dashboard" />);
        expect(await screen.findByText(/your own branding appears once it is saved/i)).toBeInTheDocument();
        expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
    });
});
