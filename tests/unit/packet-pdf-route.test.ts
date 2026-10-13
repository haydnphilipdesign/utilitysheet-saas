import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPacketPdfAttachmentForPublicTokenMock } = vi.hoisted(() => ({
    createPacketPdfAttachmentForPublicTokenMock: vi.fn(),
}));

// Operational observations are best-effort and covered in ops-instrumentation.test.ts.
vi.mock('@/lib/ops/events');
vi.mock('@/lib/pdf/packet-attachment', () => ({
    createPacketPdfAttachmentForPublicToken: createPacketPdfAttachmentForPublicTokenMock,
}));

import { GET } from '@/app/api/packet/[token]/pdf/route';
import * as rateLimits from '@/lib/rate-limit';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';

beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe('GET /api/packet/[token]/pdf', () => {
    it.each([['limited', 429], ['unavailable', 503]] as const)('preserves %s enforcement before rendering', async (reason, status) => {
        vi.spyOn(rateLimits, 'checkRateLimit').mockResolvedValue({ success: false, limit: 5, remaining: 0, reset: 12345, reason });
        const response = await GET(new Request('http://localhost/api/packet/synthetic-secret/pdf'), { params: Promise.resolve({ token: 'synthetic-secret' }) });
        expect(response.status).toBe(status);
        expect(createPacketPdfAttachmentForPublicTokenMock).not.toHaveBeenCalled();
    });
    it('preserves generic download failure without logging exception or URL capability', async () => {
        const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
        createPacketPdfAttachmentForPublicTokenMock.mockRejectedValueOnce(new Error(privateText));
        const response = await GET(new Request('http://localhost/api/packet/token-sentinel/pdf?password=password-sentinel'), { params: Promise.resolve({ token: 'token-sentinel' }) });
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'Failed to generate PDF' });
        expect(sink).toHaveBeenCalledWith('[diagnostic] packet_pdf_failed', { errorName: 'Error', errorFamily: 'unclassified' });
        expect(JSON.stringify(sink.mock.calls)).not.toContain(privateText);
        sink.mockRestore();
    });

    it('returns a PDF attachment for submitted unlocked packets', async () => {
        const limiter = vi.spyOn(rateLimits, 'checkRateLimit');
        const content = Buffer.from('fake-pdf-content');
        createPacketPdfAttachmentForPublicTokenMock.mockResolvedValue({
            status: 'attached',
            attachment: {
                filename: 'utility-info-sheet-main.pdf',
                content,
                contentType: 'application/pdf',
            },
        });

        const response = await GET(new Request('http://localhost/api/packet/token/pdf'), {
            params: Promise.resolve({ token: 'token' }),
        });

        expect(response.status).toBe(200);
        expect(limiter).toHaveBeenCalledWith(rateLimits.packetPdfRatelimit, capabilityRateLimitIdentifier('packet-pdf', 'token:anonymous'), expect.anything());
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('content-disposition')).toContain('utility-info-sheet-main.pdf');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
    });

    it('returns 404 when packet is not found', async () => {
        createPacketPdfAttachmentForPublicTokenMock.mockResolvedValue({
            status: 'skipped',
            reason: 'not_found',
        });

        const response = await GET(new Request('http://localhost/api/packet/missing/pdf'), {
            params: Promise.resolve({ token: 'missing' }),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({ error: 'Request not found' });
    });

    it('returns 404 when packet is not submitted', async () => {
        createPacketPdfAttachmentForPublicTokenMock.mockResolvedValue({
            status: 'skipped',
            reason: 'not_submitted',
        });

        const response = await GET(new Request('http://localhost/api/packet/pending/pdf'), {
            params: Promise.resolve({ token: 'pending' }),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({ error: 'Request not found' });
    });

    it('returns 402 when packet is locked', async () => {
        createPacketPdfAttachmentForPublicTokenMock.mockResolvedValue({
            status: 'skipped',
            reason: 'locked',
        });

        const response = await GET(new Request('http://localhost/api/packet/locked/pdf'), {
            params: Promise.resolve({ token: 'locked' }),
        });

        expect(response.status).toBe(402);
        await expect(response.json()).resolves.toMatchObject({ error: 'Upgrade required' });
    });
});
