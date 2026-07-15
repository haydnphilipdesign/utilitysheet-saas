import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmailMock, createPacketPdfAttachmentForRequestMock } = vi.hoisted(() => ({
    sendEmailMock: vi.fn(),
    createPacketPdfAttachmentForRequestMock: vi.fn(),
}));

vi.mock('@/lib/resend', () => ({
    getResend: () => ({
        emails: {
            send: sendEmailMock,
        },
    }),
}));

vi.mock('@/lib/pdf/packet-attachment', () => ({
    createPacketPdfAttachmentForRequest: createPacketPdfAttachmentForRequestMock,
}));

import { sendTCCompletionNotificationEmail } from '@/lib/email/email-service';

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_EMAIL_REDIRECT_TO;
    sendEmailMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
});

describe('sendTCCompletionNotificationEmail referral footer', () => {
    it('adds the from-a-closing footer with the advocate code for free-plan workspaces', async () => {
        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_free',
            attachPdf: false,
            showReferralFooter: true,
            referralCode: 'tc-team',
        });

        expect(result).toEqual({ success: true });
        const html = sendEmailMock.mock.calls[0][0].html as string;
        expect(html).toContain('/from-a-closing?');
        expect(html).toContain('utm_source=utilitysheet_email');
        expect(html).toContain('utm_medium=product_referral');
        expect(html).toContain('utm_content=completion-email');
        expect(html).toContain('ref=tc-team');
        expect(html).toContain('collected automatically with UtilitySheet');
    });

    it('renders the footer without a ref parameter when no advocate code exists', async () => {
        await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_free_2',
            attachPdf: false,
            showReferralFooter: true,
            referralCode: null,
        });

        const html = sendEmailMock.mock.calls[0][0].html as string;
        expect(html).toContain('/from-a-closing?');
        expect(html).not.toContain('&ref=');
    });

    it('keeps paid white-label completion emails free of the referral footer', async () => {
        await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_paid',
            attachPdf: false,
            showReferralFooter: false,
            referralCode: 'tc-team',
        });

        const html = sendEmailMock.mock.calls[0][0].html as string;
        expect(html).not.toContain('/from-a-closing');
        expect(html).not.toContain('collected automatically with UtilitySheet');
    });

    it('omits the footer by default when the flag is not provided', async () => {
        await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_default',
            attachPdf: false,
        });

        const html = sendEmailMock.mock.calls[0][0].html as string;
        expect(html).not.toContain('/from-a-closing');
    });
});
