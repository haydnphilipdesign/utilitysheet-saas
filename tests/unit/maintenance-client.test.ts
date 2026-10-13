import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

import { checkMaintenanceStatus, detectMaintenance, formatExpectedBack, isMaintenanceResponse } from '@/lib/maintenance/client';
import { PacketPdfMaintenanceError, generatePacketPdf, notifyPacketPdfFailure } from '@/lib/pdf-generator';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });
const paused = (expectedBackAt: string | null = null) =>
    json({ error: 'paused', code: 'MAINTENANCE', maintenance: true, expectedBackAt }, 503, { 'X-UtilitySheet-Maintenance': '1', 'Retry-After': '1800' });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('recognizing a maintenance pause in the browser', () => {
    it('recognizes the marked 503 without another request, and reads its estimate', async () => {
        const response = paused('2099-01-01T00:00:00.000Z');
        expect(isMaintenanceResponse(response)).toBe(true);
        expect(await detectMaintenance(response)).toEqual({ expectedBackAt: '2099-01-01T00:00:00.000Z' });
        // The caller can still read the body afterwards.
        expect((await response.json()).code).toBe('MAINTENANCE');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still recognizes the marker after the body was consumed', async () => {
        const response = paused();
        await response.json();
        expect(await detectMaintenance(response)).toEqual({ expectedBackAt: null });
    });

    it.each([
        ['an unavailable limiter', 503],
        ['a server error', 500],
        ['a refusal from a gate in front of the app', 403],
    ])('asks the status endpoint about %s and treats it as a pause only when told so', async (_label, status) => {
        fetchMock.mockResolvedValueOnce(json({ maintenance: true, expectedBackAt: null }));
        expect(await detectMaintenance(json({ error: 'x' }, status))).toEqual({ expectedBackAt: null });
        expect(fetchMock).toHaveBeenCalledWith('/api/maintenance', { cache: 'no-store' });

        fetchMock.mockResolvedValueOnce(json({ maintenance: false, expectedBackAt: null }));
        expect(await detectMaintenance(json({ error: 'x' }, status))).toBeNull();

        fetchMock.mockRejectedValueOnce(new TypeError('network'));
        expect(await detectMaintenance(json({ error: 'x' }, status))).toBeNull();
    });

    it.each([200, 400, 404, 409, 429])('never treats %i as a pause or asks about it', async (status) => {
        expect(await detectMaintenance(json({}, status))).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not guess when the status cannot be read', async () => {
        fetchMock.mockResolvedValueOnce(json({ error: 'down' }, 500));
        expect(await checkMaintenanceStatus()).toEqual({ state: 'unknown' });
        fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
        expect(await checkMaintenanceStatus()).toEqual({ state: 'unknown' });
        fetchMock.mockResolvedValueOnce(json({ success: true }));
        expect(await checkMaintenanceStatus()).toEqual({ state: 'unknown' });
        fetchMock.mockResolvedValueOnce(json({ maintenance: false }));
        expect(await checkMaintenanceStatus()).toEqual({ state: 'open' });
        fetchMock.mockResolvedValueOnce(json({ maintenance: true, expectedBackAt: 'not a time' }));
        expect(await checkMaintenanceStatus()).toEqual({ state: 'paused', notice: { expectedBackAt: null } });
    });

    it('formats an estimate only while it is still ahead', () => {
        const now = new Date(2026, 9, 19, 21, 0, 0).getTime();
        expect(formatExpectedBack(new Date(2026, 9, 19, 21, 45, 0).toISOString(), now)).toMatch(/9:45/);
        expect(formatExpectedBack(new Date(2026, 9, 20, 1, 15, 0).toISOString(), now)).toMatch(/1:15/);
        expect(formatExpectedBack(new Date(2026, 9, 19, 20, 0, 0).toISOString(), now)).toBeNull();
        expect(formatExpectedBack(null, now)).toBeNull();
        expect(formatExpectedBack('soon', now)).toBeNull();
    });
});

describe('PDF download during a pause', () => {
    it('raises a maintenance error instead of the generic failure', async () => {
        fetchMock.mockResolvedValueOnce(paused());
        await expect(generatePacketPdf('synthetic-token')).rejects.toBeInstanceOf(PacketPdfMaintenanceError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the generic failure for an ordinary error', async () => {
        fetchMock.mockImplementation(async (url: string) => (url === '/api/maintenance'
            ? json({ maintenance: false, expectedBackAt: null })
            : json({ error: 'Failed to generate PDF' }, 500)));
        const failure = await generatePacketPdf('synthetic-token').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(PacketPdfMaintenanceError);
    });

    it('does not treat a locked or missing sheet as a pause', async () => {
        fetchMock.mockResolvedValueOnce(json({ error: 'Upgrade required' }, 402));
        expect(await generatePacketPdf('synthetic-token').catch((error: unknown) => error)).not.toBeInstanceOf(PacketPdfMaintenanceError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('tells the person it is a pause, with the estimate only when there is one', () => {
        notifyPacketPdfFailure(new PacketPdfMaintenanceError({ expectedBackAt: null }));
        expect(toastMock.info).toHaveBeenCalledWith(
            'PDF downloads are paused for a short planned update.',
            expect.objectContaining({ description: 'Nothing is wrong with this sheet. Please try the download again a little later.' })
        );
        expect(toastMock.error).not.toHaveBeenCalled();

        notifyPacketPdfFailure(new PacketPdfMaintenanceError({ expectedBackAt: '2099-01-01T00:00:00.000Z' }));
        expect(toastMock.info.mock.calls[1][1].description).toMatch(/We expect to be back around /);

        notifyPacketPdfFailure(new Error('Failed to generate PDF'));
        expect(toastMock.error).toHaveBeenCalledWith('We couldn’t create the PDF. Try again.');
    });
});
