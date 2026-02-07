import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPacketPdfAttachmentForPublicTokenMock } = vi.hoisted(() => ({
    createPacketPdfAttachmentForPublicTokenMock: vi.fn(),
}));

vi.mock('@/lib/pdf/packet-attachment', () => ({
    createPacketPdfAttachmentForPublicToken: createPacketPdfAttachmentForPublicTokenMock,
}));

import { GET } from '@/app/api/packet/[token]/pdf/route';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/packet/[token]/pdf', () => {
    it('returns a PDF attachment for submitted unlocked packets', async () => {
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
