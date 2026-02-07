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
});
