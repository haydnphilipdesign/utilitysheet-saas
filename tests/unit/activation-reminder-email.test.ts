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

const urls = {
    setupUrl: 'https://utilitysheet.com/onboarding',
    dashboardUrl: 'https://utilitysheet.com/dashboard',
    newRequestUrl: 'https://utilitysheet.com/dashboard/requests/new',
    sellerLinkUrl: 'https://utilitysheet.com/form/jane-link',
};

describe('activation reminder email', () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    });

    it('welcomes a new account with the three steps and the seller link', () => {
        const html = __testing.generateActivationReminderHtml({ fullName: 'Jane Smith', stage: 'after_15m', ...urls });

        expect(html).toContain('Hi Jane,');
        expect(html).toContain('Try it as your seller');
        expect(html).toContain('Send your link to a seller');
        expect(html).toContain('Get the finished sheet');
        expect(html).toContain('https://utilitysheet.com/form/jane-link');
        expect(html).toContain('Open my dashboard');
        expect(html).toContain('href="https://utilitysheet.com/dashboard"');
        expect(html).toContain('href="https://utilitysheet.com/onboarding"');
        expect(html).toContain('Reply to this email');
    });

    it('marks the seller test done in the welcome when it is already finished', () => {
        const html = __testing.generateActivationReminderHtml({ stage: 'after_15m', testDriveCompleted: true, ...urls });

        expect(html).toContain('Done. You have already seen the form');
        expect(html).not.toContain('Start the seller test from your dashboard');
    });

    it('gives the day-1 email a ready-to-paste message and adapts to the seller test', () => {
        const notTested = __testing.generateActivationReminderHtml({ stage: 'after_1d', ...urls });
        expect(notTested).toContain('Copy and paste this to your seller');
        expect(notTested).toContain('No account is needed: https://utilitysheet.com/form/jane-link');
        expect(notTested).toContain('href="https://utilitysheet.com/dashboard/requests/new"');
        expect(notTested).toContain('Start the seller test from your dashboard first');
        expect(notTested).not.toContain('Try it as your seller');

        const tested = __testing.generateActivationReminderHtml({ stage: 'after_1d', testDriveCompleted: true, ...urls });
        expect(tested).toContain('You have seen what your seller sees');
        expect(tested).not.toContain('Start the seller test from your dashboard first');
    });

    it('escapes the seller link and name', () => {
        const html = __testing.generateActivationReminderHtml({
            stage: 'after_1d',
            fullName: '<b>Jane</b>',
            ...urls,
            sellerLinkUrl: 'https://utilitysheet.com/form/a"><script>x</script>',
        });

        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<b>Jane</b>');
    });

    it('uses the slate-blue product accent instead of teal or emerald', () => {
        for (const stage of ['after_15m', 'after_1d'] as const) {
            const html = __testing.generateActivationReminderHtml({ stage, ...urls });

            expect(html).toContain('<td bgcolor="#23588a" style="background-color: #23588a; background-image: linear-gradient(135deg, #23588a 0%, #0b4072 100%);');
            expect(html).toContain('fillcolor="#23588a"');
            expect(html).toContain('border-left: 4px solid #23588a;');
            expect(html).toContain('background-color: #e9eef3; color: #23588a;');
            // Emerald appears only as the "done" mark for a finished seller test.
            expect(html).not.toMatch(/#10b981|#059669|#0f766e|#065f46|#ecfdf5/i);
        }
    });

    it('sends each stage through resend with its subject and a reply-to address', async () => {
        const welcome = await sendActivationReminderEmail({ toEmail: 'jane@example.com', fullName: 'Jane Smith', stage: 'after_15m', ...urls });
        const nextStep = await sendActivationReminderEmail({ toEmail: 'jane@example.com', fullName: 'Jane Smith', stage: 'after_1d', ...urls });

        expect(welcome).toEqual({ success: true });
        expect(nextStep).toEqual({ success: true });
        expect(sendMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
            to: 'jane@example.com',
            subject: 'Welcome to UtilitySheet: three steps to your first utility sheet',
            replyTo: 'haydn@multimedium.dev',
        }));
        expect(sendMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
            subject: 'Send your first seller link',
            replyTo: 'haydn@multimedium.dev',
        }));
    });
});
