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

import { sendSellerNotificationEmail, sendTCCompletionNotificationEmail } from '@/lib/email/email-service';

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_EMAIL_REDIRECT_TO;
    sendEmailMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
});

describe('sendTCCompletionNotificationEmail attachments', () => {
    it.each(['attached', 'failed', 'rejected', 'thrown'] as const)('keeps sensitive content out of logs for %s while preserving send results', async scenario => {
        const sinks = ['log', 'warn', 'error'].map(level => vi.spyOn(console, level as 'log' | 'warn' | 'error').mockImplementation(() => undefined));
        const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
        process.env.DEMO_EMAIL_REDIRECT_TO = 'seller@example.test';
        const filename = 'utility-info-sheet-987-Sentinel-Street.pdf';
        createPacketPdfAttachmentForRequestMock.mockResolvedValue(scenario === 'attached'
            ? { status: 'attached', attachment: { filename, content: Buffer.from('synthetic-pdf'), contentType: 'application/pdf' } }
            : { status: 'failed', error: privateText });
        if (scenario === 'rejected') sendEmailMock.mockResolvedValue({ data: null, error: { message: privateText, name: privateText, statusCode: 422 } });
        if (scenario === 'thrown') sendEmailMock.mockRejectedValue(new Error(privateText));
        const result = await sendTCCompletionNotificationEmail({ tcEmail: 'demo.tc@utilitysheet.test', propertyAddress: privateText,
            sellerName: 'SellerSentinel', requestId: '12345678-1234-1234-1234-123456789abc', attachPdf: true });
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.to).toBe('seller@example.test');
        expect(payload.subject).toContain(privateText);
        if (scenario === 'attached') expect(payload.attachments[0].filename).toBe(filename);
        else expect(payload.attachments).toBeUndefined();
        expect(result.success).toBe(scenario === 'attached' || scenario === 'failed');
        if (scenario === 'rejected' || scenario === 'thrown') expect(result.error).toBe(privateText);
        const logged = JSON.stringify(sinks.flatMap(sink => sink.mock.calls));
        for (const sentinel of ['Sentinel', 'seller@example.test', 'token-sentinel', 'password-sentinel', 'postgres://sentinel']) expect(logged).not.toContain(sentinel);
        expect(logged).toContain('email_demo_redirect');
        expect(logged).toContain(scenario === 'attached' ? 'email_attachment_generated' : 'email_attachment_failed');
        if (scenario === 'rejected') expect(logged).toContain('upstream_request');
        sinks.forEach(sink => sink.mockRestore());
    });

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

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'attached', pdfEvidence: null });
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

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'disabled', pdfEvidence: null });
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

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'failed', pdfEvidence: null });
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

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'attached', pdfEvidence: null });
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

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'disabled', pdfEvidence: null });
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.to).toBe('tc@example.com');
    });

    it('labels a test drive and removes every referral prompt', async () => {
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'attached',
            attachment: {
                filename: 'test-utility-sheet.pdf',
                content: Buffer.from('fake-pdf-content'),
                contentType: 'application/pdf',
            },
        });

        const result = await sendTCCompletionNotificationEmail({
            tcEmail: 'verified@example.com',
            propertyAddress: '[TEST] 123 Maple Street, Anytown, PA 18301',
            requestId: 'req_test',
            attachPdf: true,
            showReferralFooter: false,
            referralCode: 'must-not-render',
            isTestDrive: true,
        });

        expect(result).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'attached', pdfEvidence: null });
        const payload = sendEmailMock.mock.calls[0][0];
        expect(payload.to).toBe('verified@example.com');
        expect(payload.subject).toMatch(/Your test sheet is ready/i);
        expect(payload.html).toContain('This is your test sheet');
        expect(payload.html).not.toContain('/from-a-closing');
        expect(payload.html).not.toContain('/dashboard/settings?tab=referrals');
    });
});

describe('send results carry handoff evidence', () => {
    const evidence = {
        requestId: '12345678-1234-1234-1234-123456789abc', isDemo: false, packetMode: 'simple', renderStrategy: 'print_pdf',
        launchStrategy: 'default', outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
        totalMs: 4000, dataMs: 40, launchMs: 800, renderMs: 3000, bytes: 16,
    };
    const completion = (attachPdf: boolean) => sendTCCompletionNotificationEmail({
        tcEmail: 'tc@example.com', propertyAddress: '123 Main St', requestId: '12345678-1234-1234-1234-123456789abc', attachPdf,
    });
    const invitation = () => sendSellerNotificationEmail({ sellerEmail: 'sam@example.com', propertyAddress: '123 Main St', sellerToken: 'seller-token' });

    beforeEach(() => {
        for (const level of ['log', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
    });

    it('returns the provider message id and the PDF execution evidence for an accepted completion email', async () => {
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'attached', attachment: { filename: 'a.pdf', content: Buffer.from('fake-pdf-content'), contentType: 'application/pdf' }, evidence,
        });
        expect(await completion(true)).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'attached', pdfEvidence: evidence });
    });

    it('reports an accepted email whose attachment failed as exactly that', async () => {
        const failed = { ...evidence, outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', bytes: null };
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({ status: 'failed', error: 'Chromium crashed', evidence: failed });
        expect(await completion(true)).toEqual({ success: true, messageId: 'email_123', attachmentStatus: 'failed', pdfEvidence: failed });
        expect(sendEmailMock.mock.calls[0][0].attachments).toBeUndefined();
    });

    it('returns a provider refusal as a result with its error name, not as a throw', async () => {
        sendEmailMock.mockResolvedValue({ data: null, error: { message: 'Invalid `to` field', name: 'validation_error', statusCode: 422 } });
        expect(await completion(false)).toEqual({
            success: false, error: 'Invalid `to` field', errorCode: 'validation_error', attachmentStatus: 'disabled', pdfEvidence: null,
        });
        expect(await invitation()).toEqual({ success: false, error: 'Invalid `to` field', errorCode: 'validation_error' });
    });

    it('keeps the real attachment outcome when the send itself throws', async () => {
        createPacketPdfAttachmentForRequestMock.mockResolvedValue({
            status: 'attached', attachment: { filename: 'a.pdf', content: Buffer.from('fake-pdf-content'), contentType: 'application/pdf' }, evidence,
        });
        sendEmailMock.mockRejectedValue(new Error('socket hang up'));
        // The PDF was produced; only the send has no known outcome.
        expect(await completion(true)).toEqual({ success: false, error: 'socket hang up', threw: true, attachmentStatus: 'attached', pdfEvidence: evidence });
        expect(await completion(false)).toMatchObject({ success: false, threw: true, attachmentStatus: 'disabled', pdfEvidence: null });
    });

    it('marks the attachment failed when the attachment step itself throws', async () => {
        createPacketPdfAttachmentForRequestMock.mockRejectedValue(new Error('unexpected'));
        expect(await completion(true)).toMatchObject({ success: false, threw: true, attachmentStatus: 'failed', pdfEvidence: null });
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('returns the provider message id for an accepted invitation and flags a thrown send', async () => {
        expect(await invitation()).toEqual({ success: true, messageId: 'email_123' });
        sendEmailMock.mockRejectedValue(new Error('fetch failed'));
        expect(await invitation()).toEqual({ success: false, error: 'fetch failed', threw: true });
    });
});