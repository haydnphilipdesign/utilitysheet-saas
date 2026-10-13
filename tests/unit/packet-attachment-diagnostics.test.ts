import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    byId: vi.fn(), byToken: vi.fn(), build: vi.fn(), launch: vi.fn(), close: vi.fn(), pdf: vi.fn(),
}));
vi.mock('@/lib/packet/packet-data', () => ({ getPacketDataByRequestId: mocks.byId, getPacketDataByPublicToken: mocks.byToken }));
vi.mock('@/lib/pdf/packet-html', () => ({ buildPacketPdfHtml: mocks.build }));
vi.mock('@sparticuz/chromium', () => ({ default: { executablePath: vi.fn(async () => '/synthetic/chromium'), args: [] } }));
vi.mock('puppeteer-core', () => ({ default: { launch: mocks.launch, defaultArgs: vi.fn(() => []) } }));

import { createPacketPdfAttachmentForPublicToken, createPacketPdfAttachmentForRequest } from '@/lib/pdf/packet-attachment';

const privateText = '987 Sentinel Street SellerSentinel seller@example.test token-sentinel password-sentinel postgres://sentinel';
const requestId = '12345678-1234-1234-1234-123456789abc';
const packetData = (overrides: Record<string, unknown> = {}) => ({ request: { id: requestId }, meta: { is_demo: false }, ...overrides });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.byId.mockResolvedValue({ status: 'ok', data: packetData() });
    mocks.byToken.mockResolvedValue({ status: 'ok', data: packetData() });
    mocks.build.mockReturnValue({ renderStrategy: 'print_pdf', filename: 'utility-info-sheet-Sentinel-Street.pdf', html: privateText, rootSelector: '#packet' });
    mocks.pdf.mockResolvedValue(Buffer.from('synthetic-pdf'));
    mocks.launch.mockResolvedValue({ close: mocks.close, newPage: vi.fn(async () => ({
        setContent: vi.fn(), waitForSelector: vi.fn(), evaluate: vi.fn(), pdf: mocks.pdf,
    })) });
});
afterEach(() => vi.restoreAllMocks());

describe('packet attachment diagnostics through the production pipeline with mocked browser/data', () => {
    it('identifies Advanced content independently of the shared print strategy', async () => {
        mocks.byId.mockResolvedValue({ status: 'ok', data: packetData({ mode: 'advanced' }) });
        const sink = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        expect((await createPacketPdfAttachmentForRequest(requestId)).status).toBe('attached');
        expect(sink).toHaveBeenCalledWith('[diagnostic] pdf_launch', expect.objectContaining({ mode: 'advanced', renderStrategy: 'print_pdf' }));
    });
    it('preserves delivered filename and bytes without logging document content', async () => {
        const sink = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const result = await createPacketPdfAttachmentForRequest(requestId);
        expect(result).toEqual({ status: 'attached', attachment: {
            filename: 'utility-info-sheet-Sentinel-Street.pdf', content: Buffer.from('synthetic-pdf'), contentType: 'application/pdf',
        }, evidence: expect.objectContaining({ outcome: 'rendered' }) });
        expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'letter', printBackground: true, displayHeaderFooter: true }));
        expect(mocks.close).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(sink.mock.calls)).not.toContain('Sentinel');
        expect(sink).toHaveBeenCalledWith('[diagnostic] pdf_launch', expect.objectContaining({ mode: 'simple', renderStrategy: 'print_pdf' }));
    });

    it.each(['data', 'launch', 'render'] as const)('keeps %s failure text out of request and public logs with error contract intact', async stage => {
        const sinks = ['log', 'warn', 'error'].map(level => vi.spyOn(console, level as 'log' | 'warn' | 'error').mockImplementation(() => undefined));
        if (stage === 'data') { mocks.byId.mockRejectedValue(new Error(privateText)); mocks.byToken.mockRejectedValue(new Error(privateText)); }
        if (stage === 'launch') mocks.launch.mockRejectedValue(new Error(privateText));
        if (stage === 'render') mocks.pdf.mockRejectedValue(new Error(privateText));
        const failureStage = stage === 'launch' ? 'browser_launch' : stage;
        const byId = await createPacketPdfAttachmentForRequest(requestId);
        const byToken = await createPacketPdfAttachmentForPublicToken('token-sentinel');
        expect(byId).toEqual({ status: 'failed', error: privateText, evidence: expect.objectContaining({ outcome: 'failed', failureStage, errorName: 'Error', requestId, bytes: null }) });
        // A public link names a request only once the lookup has resolved one.
        expect(byToken).toEqual({ status: 'failed', error: privateText, evidence: expect.objectContaining({ outcome: 'failed', failureStage, requestId: stage === 'data' ? null : requestId }) });
        expect(JSON.stringify([byId.evidence, byToken.evidence])).not.toMatch(/Sentinel|token-sentinel|\.pdf/);
        const calls = sinks.flatMap(sink => sink.mock.calls);
        const logged = JSON.stringify(calls);
        for (const sentinel of ['Sentinel', 'seller@example.test', 'token-sentinel', 'password-sentinel', 'postgres://sentinel']) expect(logged).not.toContain(sentinel);
        expect(calls).toContainEqual(['[diagnostic] pdf_attachment_failed', { requestId, errorName: 'Error', errorFamily: 'unclassified' }]);
        expect(calls).toContainEqual(['[diagnostic] pdf_attachment_failed', { errorName: 'Error', errorFamily: 'unclassified' }]);
        expect(mocks.close).toHaveBeenCalledTimes(stage === 'render' ? 2 : 0);
    });

    it('reports the real mode, strategies, timings and size of a successful render, and nothing about its content', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        mocks.byToken.mockResolvedValue({ status: 'ok', data: packetData({ mode: 'advanced', meta: { is_demo: true } }) });
        const result = await createPacketPdfAttachmentForPublicToken('token-sentinel');
        expect(result.evidence).toEqual({
            requestId, isDemo: true, packetMode: 'advanced', renderStrategy: 'print_pdf', launchStrategy: 'default',
            outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
            totalMs: expect.any(Number), dataMs: expect.any(Number), launchMs: expect.any(Number), renderMs: expect.any(Number),
            bytes: Buffer.from('synthetic-pdf').byteLength,
        });
        expect(JSON.stringify(result.evidence)).not.toMatch(/Sentinel|token-sentinel|\.pdf/);
    });

    it('separates HTML build and page-load failures from launch and render', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.build.mockImplementationOnce(() => { throw new TypeError(privateText); });
        expect((await createPacketPdfAttachmentForRequest(requestId)).evidence).toMatchObject({ failureStage: 'build_html', errorName: 'TypeError', launchStrategy: null, launchMs: null });

        mocks.launch.mockResolvedValueOnce({ close: mocks.close, newPage: vi.fn(async () => ({
            setContent: vi.fn(async () => { throw new Error(privateText); }), waitForSelector: vi.fn(), evaluate: vi.fn(), pdf: mocks.pdf,
        })) });
        expect((await createPacketPdfAttachmentForRequest(requestId)).evidence).toMatchObject({
            failureStage: 'page_load', launchStrategy: 'default', launchMs: expect.any(Number), renderMs: expect.any(Number), bytes: null,
        });
    });

    it('reports expected outcomes as skips with the resolved request, and an unknown link with none', async () => {
        mocks.byToken.mockResolvedValueOnce({ status: 'locked', message: 'locked', request: { id: requestId, isDemo: false } });
        expect(await createPacketPdfAttachmentForPublicToken('token-sentinel')).toEqual({
            status: 'skipped', reason: 'locked', evidence: expect.objectContaining({ outcome: 'skipped', skipReason: 'locked', requestId, isDemo: false, failureStage: null }),
        });
        mocks.byToken.mockResolvedValueOnce({ status: 'not_submitted', request: { id: requestId, isDemo: true } });
        expect((await createPacketPdfAttachmentForPublicToken('token-sentinel')).evidence).toMatchObject({ skipReason: 'not_submitted', isDemo: true });
        mocks.byToken.mockResolvedValueOnce({ status: 'not_found' });
        expect((await createPacketPdfAttachmentForPublicToken('token-sentinel')).evidence).toMatchObject({ skipReason: 'not_found', requestId: null, isDemo: null });
        expect(mocks.launch).not.toHaveBeenCalled();
    });
});
