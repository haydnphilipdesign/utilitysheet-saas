import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    toast: { success: vi.fn(), error: vi.fn() },
    trackEvent: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.trackEvent }));

import { FeedbackDialog } from '@/components/feedback-dialog';

const fetchMock = vi.fn();

async function openDialog() {
    render(<FeedbackDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    return screen.findByPlaceholderText('Type your message here...');
}

describe('FeedbackDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('gives the icon-only trigger a clear accessible name', () => {
        render(<FeedbackDialog />);

        expect(screen.getByRole('button', { name: 'Send feedback' })).toHaveClass('min-h-11', 'min-w-11');
    });

    it('sends the message with the chosen type and page context, and never tracks the text', async () => {
        const textarea = await openDialog();
        fireEvent.change(textarea, { target: { value: '  The PDF button does nothing  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Something is broken' }));
        fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

        await waitFor(() => expect(mocks.toast.success).toHaveBeenCalled());
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/feedback');
        expect(JSON.parse(init.body)).toEqual({
            message: 'The PDF button does nothing',
            category: 'bug',
            pagePath: window.location.pathname,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
        });
        expect(mocks.trackEvent).toHaveBeenCalledWith('feedback_dialog_opened', {});
        expect(mocks.trackEvent).toHaveBeenCalledWith('feedback_submitted', { category: 'bug', success: true });
        expect(JSON.stringify(mocks.trackEvent.mock.calls)).not.toContain('PDF button');
    });

    it('sends a general message when no type is chosen', async () => {
        const textarea = await openDialog();
        fireEvent.change(textarea, { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).category).toBe('general');
    });

    it('keeps the draft and explains the failure inline when sending fails', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 });
        const textarea = await openDialog();
        fireEvent.change(textarea, { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Your message is still here');
        expect(textarea).toHaveValue('Hello');
        expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it('explains a rate limit without losing the draft', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 429 });
        const textarea = await openDialog();
        fireEvent.change(textarea, { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('try again in a few minutes');
        expect(textarea).toHaveValue('Hello');
    });
});
