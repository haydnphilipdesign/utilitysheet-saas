import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/resend', () => ({
    getResend: () => ({
        emails: {
            send: sendMock,
        },
    }),
}));

import { sendActivationReminderEmail, __testing } from '@/lib/email/email-service';

describe('activation reminder email', () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    });

    it('renders the reusable seller link in the HTML helper', () => {
        const html = __testing.generateActivationReminderHtml({
            fullName: 'Jane Smith',
            stage: 'after_15m',
            setupUrl: 'https://utilitysheet.com/onboarding',
            dashboardUrl: 'https://utilitysheet.com/dashboard',
            sellerLinkUrl: 'https://utilitysheet.com/i/jane-link',
        });

        expect(html).toContain('https://utilitysheet.com/i/jane-link');
        expect(html).toContain('Open My Seller Link');
        expect(html).toContain('Your reusable seller link is ready');
    });

    it('sends the day-1 reminder through resend', async () => {
        const result = await sendActivationReminderEmail({
            toEmail: 'jane@example.com',
            fullName: 'Jane Smith',
            stage: 'after_1d',
            setupUrl: 'https://utilitysheet.com/onboarding',
            dashboardUrl: 'https://utilitysheet.com/dashboard',
            sellerLinkUrl: 'https://utilitysheet.com/i/jane-link',
        });

        expect(result).toEqual({ success: true });
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            to: 'jane@example.com',
            subject: 'Your UtilitySheet seller link is ready to share',
        }));
    });
});
