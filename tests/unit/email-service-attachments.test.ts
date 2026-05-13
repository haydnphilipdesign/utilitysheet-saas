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

describe('sendTCCompletionNotificationEmail attachments', () => {
    it('includes a PDF attachment when attachPdf is enabled and generation succeeds', async () => {
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'attached',
            attachment: {
                filename: 'utility-info-sheet-main.pdf',
                content: Buffer.from('fake-pdf-content'),
                contentType: 'application/pdf',
            },
        });

        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            tcName: 'Test TC',
            propertyAddress: '123 Main St',
            sellerName: 'Seller Name',
            requestId: 'req_1',
            attachPdf: true,
        });

        expect(result).toEqual({ success: true });
        expect(createPacketPdfAttachmentForRequestMock).toHaveBeenCalledWith('req_1');

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.attachments).toHaveLength(1);
        expect(payload.attachments[0]).toMatchObject({
            filename: 'utility-info-sheet-main.pdf',
            contentType: 'application/pdf',
        });
    });

    it('does not include attachments when attachPdf is disabled', async () => {
        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_2',
            attachPdf: false,
        });

        expect(result).toEqual({ success: true });
        expect(createPacketPdfAttachmentForRequestMock).not.toHaveBeenCalled();

        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.attachments).toBeUndefined();
    });

    it('sends email without attachment when PDF generation fails', async () => {
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'failed',
            error: 'Generation failed',
        });

        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_3',
            attachPdf: true,
        });

        expect(result).toEqual({ success: true });
        expect(createPacketPdfAttachmentForRequestMock).toHaveBeenCalledWith('req_3');

        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.attachments).toBeUndefined();
    });

    it('redirects demo .test recipients to the configured recording inbox', async () => {
        process.env.DEMO_EMAIL_REDIRECT_TO = 'haydn@multimedium.dev';
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'attached',
            attachment: {
                filename: 'utility-info-sheet-main.pdf',
                content: Buffer.from('fake-pdf-content'),
                contentType: 'application/pdf',
            },
        });

        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'demo.tc@utilitysheet.test',
            propertyAddress: '123 Main Street, Anytown, PA 18301',
            requestId: 'demo-request',
            attachPdf: true,
        });

        expect(result).toEqual({ success: true });
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.to).toBe('haydn@multimedium.dev');
        expect(payload.subject).toBe('Utility Info Submitted for 123 Main Street, Anytown, PA 18301');
        expect(payload.attachments).toHaveLength(1);
    });

    it('does not redirect real recipients when demo redirect is configured', async () => {
        process.env.DEMO_EMAIL_REDIRECT_TO = 'haydn@multimedium.dev';

        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'tc@example.com',
            propertyAddress: '123 Main St',
            requestId: 'req_real',
            attachPdf: false,
        });

        expect(result).toEqual({ success: true });
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.to).toBe('tc@example.com');
    });
});
