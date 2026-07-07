import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, ensureAccountActivationMock, createPacketPdfAttachmentFromDataMock } = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    ensureAccountActivationMock: vi.fn(),
    createPacketPdfAttachmentFromDataMock: vi.fn(),
}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: getUserMock },
}));

vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: ensureAccountActivationMock,
}));

vi.mock('@/lib/pdf/packet-attachment', () => ({
    createPacketPdfAttachmentFromData: createPacketPdfAttachmentFromDataMock,
}));

import { POST } from '@/app/api/branding/test-pdf/route';

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/branding/test-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ id: 'user_1' });
    ensureAccountActivationMock.mockResolvedValue({
        account: { id: 'acct_1', subscription_status: 'pro' },
        activeOrganization: null,
    });
    createPacketPdfAttachmentFromDataMock.mockResolvedValue({
        filename: 'ignored.pdf',
        content: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
    });
});

describe('POST /api/branding/test-pdf', () => {
    it('requires authentication', async () => {
        getUserMock.mockResolvedValue(null);

        const response = await POST(makeRequest({ branding: {}, mode: 'simple' }));
        expect(response.status).toBe(401);
        expect(createPacketPdfAttachmentFromDataMock).not.toHaveBeenCalled();
    });

    it('rejects invalid payloads', async () => {
        const response = await POST(makeRequest({ branding: { primary_color: 'not-a-color' } }));
        expect(response.status).toBe(400);
        expect(createPacketPdfAttachmentFromDataMock).not.toHaveBeenCalled();
    });

    it('renders through the production pipeline and returns the PDF', async () => {
        const response = await POST(makeRequest({
            branding: { name: 'Acme Realty', primary_color: '#2563eb' },
            mode: 'simple',
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('content-disposition')).toContain('utility-info-sheet-preview.pdf');

        const packetData = createPacketPdfAttachmentFromDataMock.mock.calls[0][0];
        expect(packetData.mode).toBe('simple');
        expect(packetData.brand.name).toBe('Acme Realty');
        // The synthetic packet exercises the full shared document.
        expect(packetData.request.water_source).toBeTruthy();
        expect(packetData.utilities.length).toBeGreaterThan(0);
    });

    it('honors advanced mode for paid accounts with advanced sections and packet filename', async () => {
        const response = await POST(makeRequest({
            branding: { name: 'Acme Realty' },
            mode: 'advanced',
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toContain('seller-transition-packet-preview.pdf');

        const packetData = createPacketPdfAttachmentFromDataMock.mock.calls[0][0];
        expect(packetData.mode).toBe('advanced');
        expect(packetData.advanced_sections.length).toBeGreaterThan(0);
    });

    it('forces Simple mode and Free gating for free accounts', async () => {
        ensureAccountActivationMock.mockResolvedValue({
            account: { id: 'acct_1', subscription_status: 'free' },
            activeOrganization: null,
        });

        const response = await POST(makeRequest({
            branding: {
                name: 'Acme Realty',
                show_powered_by: false,
                welcome_message: 'Should not appear',
            },
            mode: 'advanced',
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toContain('utility-info-sheet-preview.pdf');

        const packetData = createPacketPdfAttachmentFromDataMock.mock.calls[0][0];
        expect(packetData.mode).toBe('simple');
        expect(packetData.brand.show_powered_by).toBe(true);
        expect(packetData.brand.welcome_message).toBeNull();
        expect(packetData.meta.show_powered_by).toBe(true);
    });

    it('treats team organizations as paid', async () => {
        ensureAccountActivationMock.mockResolvedValue({
            account: { id: 'acct_1', subscription_status: 'free' },
            activeOrganization: { id: 'org_1', subscription_status: 'team' },
        });

        await POST(makeRequest({ branding: { name: 'Team Brand' }, mode: 'advanced' }));

        const packetData = createPacketPdfAttachmentFromDataMock.mock.calls[0][0];
        expect(packetData.mode).toBe('advanced');
    });
});
