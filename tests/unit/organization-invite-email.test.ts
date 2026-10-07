import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));
vi.mock('@/lib/pdf/packet-attachment', () => ({ createPacketPdfAttachmentForRequest: vi.fn() }));

import { buildOrganizationInviteEmail } from '@/lib/email/email-service';

const inviteUrl = 'https://app.example.com/invite/synthetic-token';

describe('workspace invitation email', () => {
    it('says who invited the reader, which address to use and how long the link works', () => {
        const { subject, html } = buildOrganizationInviteEmail({
            toEmail: 'casey@example.com',
            organizationName: 'Riverbend Transaction Services',
            invitedByName: 'Pat Lee',
            inviteUrl,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        expect(subject).toBe('Pat Lee invited you to join Riverbend Transaction Services on UtilitySheet');
        expect(html).toContain('Pat Lee invited you to join <strong>Riverbend Transaction Services</strong>');
        expect(html).toContain('<strong>casey@example.com</strong>');
        expect(html).toContain('The link works for 7 days.');
        expect(html).toContain('Accept invitation');
        expect(html).toContain(`href="${inviteUrl}"`);
    });

    it('escapes names typed by customers', () => {
        const { subject, html } = buildOrganizationInviteEmail({
            toEmail: 'casey@example.com',
            organizationName: '<a href="https://evil.example">Click</a>',
            invitedByName: '<img src=x onerror=alert(1)>\r\nBcc: x@example.com',
            inviteUrl,
        });

        expect(html).not.toContain('<a href="https://evil.example">');
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;a href=');
        expect(subject).not.toMatch(/[\r\n]/);
    });

    it('leaves out the inviter and the expiry when they are not known', () => {
        const { subject, html } = buildOrganizationInviteEmail({
            toEmail: 'casey@example.com',
            organizationName: 'Riverbend',
            inviteUrl,
        });

        expect(subject).toBe('You’re invited to join Riverbend on UtilitySheet');
        expect(html).toContain('You’ve been invited to join <strong>Riverbend</strong>');
        expect(html).not.toContain('The link works for');
    });
});
