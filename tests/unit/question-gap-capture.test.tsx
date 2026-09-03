import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionGapCapture } from '@/components/question-requests/QuestionGapCapture';

const fetchMock = vi.fn();

describe('QuestionGapCapture', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    it('renders and submits while packet mode is simple for Free users', async () => {
        fetchMock.mockResolvedValue({ ok: true });
        render(<QuestionGapCapture context="settings" packetMode="simple" />);

        fireEvent.click(screen.getByText("Don't see a question you need?"));
        const input = screen.getByRole('textbox', {
            name: 'What question should the seller form ask?',
        });
        fireEvent.change(input, { target: { value: 'Who services the water softener?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

        expect(fetchMock).toHaveBeenCalledWith('/api/question-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestedText: 'Who services the water softener?',
                context: 'settings',
                packetMode: 'simple',
            }),
        });
        expect(await screen.findByRole('status')).toHaveTextContent('your question request was recorded');
    });

    it('shows an inline error and preserves typed text when submission fails', async () => {
        fetchMock.mockResolvedValue({ ok: false });
        render(<QuestionGapCapture context="request_creation" packetMode="simple" />);

        fireEvent.click(screen.getByText("Don't see a question you need?"));
        const input = screen.getByRole('textbox', {
            name: 'What question should the seller form ask?',
        });
        const requestedText = 'Does the home have a water softener?';
        fireEvent.change(input, { target: { value: requestedText } });
        fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('could not save that request');
        expect(input).toHaveValue(requestedText);
    });
});
