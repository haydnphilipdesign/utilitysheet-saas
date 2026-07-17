import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    sendNotificationMock: vi.fn(),
    sendReminderMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUserMock },
}));

vi.mock('@/lib/email/email-service', () => ({
    sendSellerNotificationEmail: mocks.sendNotificationMock,
    sendSellerReminderEmail: mocks.sendReminderMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    reminderRatelimit: { prefix: 'reminder' },
    checkRateLimit: mocks.checkRateLimitMock,
    getRateLimitHeaders: () => ({}),
    isRateLimitUnavailable: (r: { unavailable?: boolean }) => Boolean(r?.unavailable),
}));

import { POST } from '@/app/api/branding/test-email/route';

function post(body: unknown) {
    return POST(new Request('http://localhost/api/branding/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }));
}

const validBranding = { name: 'Acme Realty', primary_color: '#123456', secondary_color: '#654321' };

describe('POST /api/branding/test-email', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: 'me@example.com' });
        mocks.checkRateLimitMock.mockResolvedValue({ success: true });
        mocks.sendNotificationMock.mockResolvedValue({ success: true });
        mocks.sendReminderMock.mockResolvedValue({ success: true });
    });

    it('rejects unauthenticated requests', async () => {
        mocks.getUserMock.mockResolvedValue(null);
        const response = await post({ branding: validBranding });
        expect(response.status).toBe(401);
        expect(mocks.sendNotificationMock).not.toHaveBeenCalled();
    });

    it('returns 400 when the user has no verified email', async () => {
        mocks.getUserMock.mockResolvedValue({ id: 'user_1', primaryEmail: null });
        const response = await post({ branding: validBranding });
        expect(response.status).toBe(400);
        expect(mocks.sendNotificationMock).not.toHaveBeenCalled();
    });

    it('honors rate limiting', async () => {
        mocks.checkRateLimitMock.mockResolvedValue({ success: false });
        const response = await post({ branding: validBranding });
        expect(response.status).toBe(429);
        expect(mocks.sendNotificationMock).not.toHaveBeenCalled();
    });

    it('only ever sends to the authenticated user own email', async () => {
        // A client-supplied recipient must be ignored (schema strips it anyway).
        const response = await post({ branding: validBranding, sellerEmail: 'victim@example.com', to: 'victim@example.com' });
        expect(response.status).toBe(200);
        expect(mocks.sendNotificationMock).toHaveBeenCalledTimes(1);
        const arg = mocks.sendNotificationMock.mock.calls[0][0];
        expect(arg.sellerEmail).toBe('me@example.com');
        expect(arg.sellerToken).toBe('preview');
        expect(await response.json()).toEqual({ success: true, sentTo: 'me@example.com' });
    });

    it('sends the reminder variant when requested', async () => {
        const response = await post({ branding: validBranding, kind: 'reminder' });
        expect(response.status).toBe(200);
        expect(mocks.sendReminderMock).toHaveBeenCalledTimes(1);
        expect(mocks.sendNotificationMock).not.toHaveBeenCalled();
    });

    it('passes structured identity fields through to the email', async () => {
        await post({
            branding: {
                ...validBranding,
                company_name: 'Acme Realty Group',
                license_number: '01234567',
                license_state: 'TX',
                compliance_line: 'Brokered by Acme',
            },
        });
        const arg = mocks.sendNotificationMock.mock.calls[0][0];
        expect(arg.brandProfile.company_name).toBe('Acme Realty Group');
        expect(arg.brandProfile.license_number).toBe('01234567');
        expect(arg.brandProfile.license_state).toBe('TX');
        expect(arg.brandProfile.compliance_line).toBe('Brokered by Acme');
    });

    it('returns 502 when the email service reports failure', async () => {
        mocks.sendNotificationMock.mockResolvedValue({ success: false, error: 'nope' });
        const response = await post({ branding: validBranding });
        expect(response.status).toBe(502);
    });
});
