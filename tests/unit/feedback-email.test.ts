import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

vi.mock('@/lib/resend', () => ({
    getResend: () => ({ emails: { send: sendEmailMock } }),
}));
vi.mock('@/lib/pdf/packet-attachment', () => ({
    createPacketPdfAttachmentForRequest: vi.fn(),
}));

import { sendFeedbackEmail } from '@/lib/email/email-service';

const originalFeedbackEmail = process.env.FEEDBACK_EMAIL;

beforeEach(() => {
    vi.clearAllMocks();
    process.env.FEEDBACK_EMAIL = 'owner@example.com';
    sendEmailMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
});

afterEach(() => {
    if (originalFeedbackEmail === undefined) delete process.env.FEEDBACK_EMAIL;
    else process.env.FEEDBACK_EMAIL = originalFeedbackEmail;
});

describe('sendFeedbackEmail', () => {
    it('escapes every customer-controlled value in the HTML body', async () => {
        await sendFeedbackEmail({
            userEmail: 'tc@example.com',
            userName: '<b>Sam</b>',
            userId: 'user_1',
            message: '<img src=x onerror=alert(1)> & <a href="https://evil.example">click</a>',
            category: 'bug',
            pagePath: '/dashboard/<script>',
            stored: true,
        });

        const sent = sendEmailMock.mock.calls[0][0];
        expect(sent.html).not.toContain('<img');
        expect(sent.html).not.toContain('<b>Sam</b>');
        expect(sent.html).not.toContain('<script>');
        expect(sent.html).not.toContain('href="https://evil.example"');
        expect(sent.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp;');
        expect(sent.html).toContain('&lt;b&gt;Sam&lt;/b&gt; (tc@example.com)');
        expect(sent.html).toContain('<strong>Type:</strong> Bug');
        expect(sent.html).toContain('/admin/feedback');
        expect(sent.replyTo).toBe('tc@example.com');
        expect(sent.subject).toBe('New Feedback (Bug) from <b>Sam</b>');
    });

    it('keeps the subject on one line and omits reply-to and the inbox link when they do not apply', async () => {
        await sendFeedbackEmail({ userEmail: null, userName: 'Sam\r\nBcc: other@example.com', message: 'Hello' });

        const sent = sendEmailMock.mock.calls[0][0];
        expect(sent.subject).toBe('New Feedback (General) from Sam Bcc: other@example.com');
        expect(sent).not.toHaveProperty('replyTo');
        expect(sent.html).not.toContain('/admin/feedback');
    });

    it('reports failure without sending when no destination is configured', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        delete process.env.FEEDBACK_EMAIL;

        const result = await sendFeedbackEmail({ userEmail: 'tc@example.com', message: 'Hello' });

        expect(result.success).toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();
        consoleWarn.mockRestore();
    });
});
