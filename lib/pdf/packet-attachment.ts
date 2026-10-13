import { logDiagnostic } from '@/lib/telemetry/diagnostics';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { jsPDF } from 'jspdf';
import { fitRectWithin } from '@/lib/pdf-fit';
import { calculateSimplePdfFitDiagnostics } from '@/lib/pdf/simple-fit-diagnostics';
import { getPacketDataByRequestId, getPacketDataByPublicToken, type PacketDataResult } from '@/lib/packet/packet-data';
import { buildPacketPdfHtml, type PacketPdfData } from '@/lib/pdf/packet-html';
import { errorNameOf } from '@/lib/ops/events';
import type { PdfFailureStage, PdfLaunchStrategy, PdfRenderEvidence } from '@/lib/telemetry/handoff-evidence';

export interface PacketPdfAttachment {
    filename: string;
    content: Buffer;
    contentType: 'application/pdf';
}

/** `evidence` describes the execution only: no filename, HTML, answers or link. */
export type PacketPdfAttachmentResult =
    | { status: 'attached'; attachment: PacketPdfAttachment; evidence: PdfRenderEvidence }
    | { status: 'skipped'; reason: 'not_found' | 'not_submitted' | 'locked'; evidence: PdfRenderEvidence }
    | { status: 'failed'; error: string; evidence: PdfRenderEvidence };

type LaunchStrategy = PdfLaunchStrategy;

/** Filled in as a render proceeds, so a failure can be attributed to the stage it reached. */
type RenderTrace = {
    stage: PdfFailureStage;
    renderStrategy: 'print_pdf' | 'screenshot' | null;
    launchStrategy: LaunchStrategy | null;
    launchMs: number | null;
    renderMs: number | null;
};

const newRenderTrace = (): RenderTrace => ({
    stage: 'build_html', renderStrategy: null, launchStrategy: null, launchMs: null, renderMs: null,
});

async function resolveLaunchOptions(): Promise<{
    executablePath: string;
    args: string[];
    headless: boolean | 'shell';
    strategy: LaunchStrategy;
}> {
    const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH;
    if (configuredPath) {
        return {
            executablePath: configuredPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
            strategy: 'env_executable',
        };
    }

    const chromiumBinPath = process.env.CHROMIUM_BIN_PATH?.trim();
    if (chromiumBinPath) {
        const executablePath = await chromium.executablePath(chromiumBinPath);
        return {
            executablePath,
            args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
            headless: 'shell',
            strategy: 'bin_path',
        };
    }

    const chromiumPackUrl = process.env.CHROMIUM_PACK_URL?.trim();
    if (chromiumPackUrl) {
        const executablePath = await chromium.executablePath(chromiumPackUrl);
        return {
            executablePath,
            args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
            headless: 'shell',
            strategy: 'pack_url',
        };
    }

    const executablePath = await chromium.executablePath();
    return {
        executablePath,
        args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
        headless: 'shell',
        strategy: 'default',
    };
}

async function renderPacketPdfBuffer(
    data: PacketPdfData,
    trace: RenderTrace = newRenderTrace(),
): Promise<{ filename: string; content: Buffer }> {
    trace.stage = 'build_html';
    const render = buildPacketPdfHtml(data);
    trace.renderStrategy = render.renderStrategy === 'print_pdf' ? 'print_pdf' : 'screenshot';

    trace.stage = 'browser_launch';
    const launchStartedAt = Date.now();
    const launchOptions = await resolveLaunchOptions();
    trace.launchStrategy = launchOptions.strategy;
    logDiagnostic('log', 'pdf_launch', {
        strategy: launchOptions.strategy,
        headless: launchOptions.headless,
        renderStrategy: render.renderStrategy ?? 'screenshot',
        mode: data.mode ?? 'simple',
    });

    const browser = await puppeteer.launch({
        executablePath: launchOptions.executablePath,
        args: launchOptions.args,
        headless: launchOptions.headless,
        defaultViewport: {
            width: 1600,
            height: 2400,
            deviceScaleFactor: 2,
        },
    });
    const renderStartedAt = Date.now();
    trace.launchMs = renderStartedAt - launchStartedAt;

    try {
        trace.stage = 'page_load';
        const page = await browser.newPage();
        await page.setContent(render.html, { waitUntil: 'networkidle0' });
        await page.waitForSelector(render.rootSelector, { timeout: 15000 });

        await page.evaluate(async () => {
            const images = Array.from(document.images);
            await Promise.all(images.map((img) => {
                if (img.complete) return Promise.resolve();

                return new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            }));
        });

        trace.stage = 'render';
        if (render.renderStrategy === 'print_pdf') {
            const pdfBuffer = await page.pdf({
                format: 'letter',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: render.headerTemplate || '<div></div>',
                footerTemplate: render.footerTemplate || '<div></div>',
                margin: {
                    top: '0.65in',
                    bottom: '0.7in',
                    left: '0.55in',
                    right: '0.55in',
                },
            });

            return {
                filename: render.filename,
                content: Buffer.from(pdfBuffer),
            };
        }

        const root = await page.$(render.rootSelector);
        if (!root) {
            throw new Error('Failed to find packet render root in headless browser');
        }

        const rootBox = await root.boundingBox();

        const pngBuffer = await root.screenshot({ type: 'png' });
        const imageData = `data:image/png;base64,${Buffer.from(pngBuffer).toString('base64')}`;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 0.5;
        const contentWidth = pageWidth - margin * 2;
        const contentHeight = pageHeight - margin * 2;

        if (rootBox) {
            const diagnostics = calculateSimplePdfFitDiagnostics({
                sourceWidth: rootBox.width,
                sourceHeight: rootBox.height,
                targetWidth: contentWidth,
                targetHeight: contentHeight,
            });

            if (!diagnostics.isReadable) {
                logDiagnostic('warn', 'pdf_readability_warning', {
                    sourceWidth: Math.round(rootBox.width),
                    sourceHeight: Math.round(rootBox.height),
                    limitingDimension: diagnostics.limitingDimension,
                    effectiveBaselineFontPt: Number(diagnostics.effectiveBaselineFontPt.toFixed(2)),
                });
            }
        }

        const imageProperties = pdf.getImageProperties(imageData);
        const { width: imgWidth, height: imgHeight } = fitRectWithin({
            sourceWidth: imageProperties.width,
            sourceHeight: imageProperties.height,
            targetWidth: contentWidth,
            targetHeight: contentHeight,
        });

        const xOffset = margin + (contentWidth - imgWidth) / 2;
        const yOffset = margin + (contentHeight - imgHeight) / 2;

        pdf.addImage(imageData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

        return {
            filename: render.filename,
            content: Buffer.from(pdf.output('arraybuffer')),
        };
    } finally {
        // Page load plus rendering, whether or not it succeeded.
        trace.renderMs = Date.now() - renderStartedAt;
        await browser.close();
    }
}

async function createPacketPdfAttachment(data: PacketPdfData, trace?: RenderTrace): Promise<PacketPdfAttachment> {
    const rendered = await renderPacketPdfBuffer(data, trace);

    return {
        filename: rendered.filename,
        content: rendered.content,
        contentType: 'application/pdf',
    };
}

/**
 * Render a PDF from caller-supplied packet data through the exact production
 * browser pipeline (Chromium page.pdf(), page settings, running header and
 * footer). Used by the Branding Profile test-PDF endpoint so test downloads
 * cannot drift from real Simple/Advanced output.
 */
export async function createPacketPdfAttachmentFromData(data: PacketPdfData): Promise<PacketPdfAttachment> {
    return createPacketPdfAttachment(data);
}

/**
 * Resolves the packet, renders it and reports what the execution did. The
 * request is only known once the caller's id or link resolved to one.
 */
async function createPacketPdfAttachmentFromLookup(
    lookup: () => Promise<PacketDataResult>,
    knownRequestId: string | null,
): Promise<PacketPdfAttachmentResult> {
    const startedAt = Date.now();
    const trace = newRenderTrace();
    const evidence: PdfRenderEvidence = {
        requestId: knownRequestId, isDemo: null, packetMode: null, renderStrategy: null, launchStrategy: null,
        outcome: 'failed', skipReason: null, failureStage: null, errorName: null,
        totalMs: 0, dataMs: null, launchMs: null, renderMs: null, bytes: null,
    };
    let dataResolved = false;

    try {
        const packetResult = await lookup();
        dataResolved = true;
        evidence.dataMs = Date.now() - startedAt;

        if (packetResult.status === 'not_found' || packetResult.status === 'not_submitted' || packetResult.status === 'locked') {
            if (packetResult.status !== 'not_found' && packetResult.request) {
                evidence.requestId = packetResult.request.id;
                evidence.isDemo = packetResult.request.isDemo;
            }
            evidence.outcome = 'skipped';
            evidence.skipReason = packetResult.status;
            evidence.totalMs = Date.now() - startedAt;
            return { status: 'skipped', reason: packetResult.status, evidence };
        }

        evidence.requestId = packetResult.data.request.id;
        evidence.isDemo = packetResult.data.meta.is_demo === true;
        evidence.packetMode = packetResult.data.mode === 'advanced' ? 'advanced' : 'simple';

        const attachment = await createPacketPdfAttachment(packetResult.data, trace);
        Object.assign(evidence, {
            outcome: 'rendered',
            renderStrategy: trace.renderStrategy,
            launchStrategy: trace.launchStrategy,
            launchMs: trace.launchMs,
            renderMs: trace.renderMs,
            bytes: attachment.content.byteLength,
            totalMs: Date.now() - startedAt,
        } satisfies Partial<PdfRenderEvidence>);
        return { status: 'attached', attachment, evidence };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error';
        logDiagnostic('warn', 'pdf_attachment_failed', knownRequestId ? { requestId: knownRequestId } : {}, error);
        Object.assign(evidence, {
            outcome: 'failed',
            failureStage: dataResolved ? trace.stage : 'data',
            errorName: errorNameOf(error),
            renderStrategy: trace.renderStrategy,
            launchStrategy: trace.launchStrategy,
            launchMs: trace.launchMs,
            renderMs: trace.renderMs,
            totalMs: Date.now() - startedAt,
        } satisfies Partial<PdfRenderEvidence>);
        return {
            status: 'failed',
            error: errorMessage,
            evidence,
        };
    }
}

export async function createPacketPdfAttachmentForRequest(requestId: string): Promise<PacketPdfAttachmentResult> {
    return createPacketPdfAttachmentFromLookup(() => getPacketDataByRequestId(requestId), requestId);
}

export async function createPacketPdfAttachmentForPublicToken(token: string): Promise<PacketPdfAttachmentResult> {
    return createPacketPdfAttachmentFromLookup(() => getPacketDataByPublicToken(token), null);
}

export const __testing = {
    resolveLaunchOptions,
};
