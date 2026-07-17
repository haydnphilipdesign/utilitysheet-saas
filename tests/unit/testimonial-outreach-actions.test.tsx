import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actionMocks = vi.hoisted(() => ({
    send: vi.fn(),
    sendTest: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actionMocks.refresh }) }));
vi.mock('@/app/(admin)/admin/testimonial-candidates/actions', () => ({
    sendTestimonialRequestAdminAction: actionMocks.send,
    sendTestimonialRequestTestToSelfAdminAction: actionMocks.sendTest,
}));

import { TestimonialOutreachButton } from '@/components/admin/TestimonialOutreachActions';

describe('TestimonialOutreachButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        actionMocks.send.mockResolvedValue({ success: true });
    });

    it('requires review of recipient, message, selection rationale, reason, and explicit confirmation', async () => {
        render(
            <TestimonialOutreachButton
                userId="customer-1"
                recipientName="Marisa Cirrincione"
                recipientEmail="marisa@example.com"
                businessName="North Star TC"
                selectionReasons={['12 requests created', 'Active in the last 30 days']}
                alreadySent={false}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /review outreach/i }));

        expect(screen.getByRole('dialog', { name: /review testimonial outreach/i })).toBeInTheDocument();
        expect(screen.getByText('marisa@example.com')).toBeInTheDocument();
        expect(screen.getByText('Quick UtilitySheet question')).toBeInTheDocument();
        expect(screen.getByText(/would you be open to sharing/i)).toBeInTheDocument();
        expect(screen.getByText('12 requests created')).toBeInTheDocument();
        expect(screen.getByText('Active in the last 30 days')).toBeInTheDocument();

        const confirmButton = screen.getByRole('button', { name: /send testimonial request/i });
        expect(confirmButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/admin reason/i), {
            target: { value: 'Strong activity and a representative TC workflow' },
        });
        fireEvent.click(screen.getByRole('checkbox', { name: /i have reviewed the recipient and message/i }));
        expect(confirmButton).toBeEnabled();

        fireEvent.click(confirmButton);

        await waitFor(() => expect(actionMocks.send).toHaveBeenCalledWith('customer-1', expect.objectContaining({
            reason: 'Strong activity and a representative TC workflow',
            confirmed: true,
            allowResend: false,
            idempotencyKey: expect.any(String),
            expectedRecipientEmail: 'marisa@example.com',
            expectedSubject: 'Quick UtilitySheet question',
            expectedBody: expect.stringContaining('Would you be open to sharing a quick sentence or two'),
        })));
    });
});
