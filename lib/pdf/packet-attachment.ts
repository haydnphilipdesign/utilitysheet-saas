import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { jsPDF } from 'jspdf';
import { fitRectWithin } from '@/lib/pdf-fit';
import { getPacketDataByRequestId, getPacketDataByPublicToken } from '@/lib/packet/packet-data';
import { buildPacketPdfHtml, type PacketPdfData } from '@/lib/pdf/packet-html';

export interface PacketPdfAttachment {
    filename: string;
    content: Buffer;
    contentType: 'application/pdf';
}

export type PacketPdfAttachmentResult =
    | { status: 'attached'; attachment: PacketPdfAttachment }
    | { status: 'skipped'; reason: 'not_found' | 'not_submitted' | 'locked' }
    | { status: 'failed'; error: string };

type LaunchStrategy = 'env_executable' | 'bin_path' | 'pack_url' | 'default';

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

async function renderPacketPdfBuffer(data: PacketPdfData): Promise<{ filename: string; content: Buffer }> {
    const render = buildPacketPdfHtml(data);
    const renderer = render.renderStrategy === 'print_pdf' ? 'advanced_renderer' : 'simple_renderer';
    const launchOptions = await resolveLaunchOptions();
    console.log('[pdf][packet_attachment] launch_options', {
        strategy: launchOptions.strategy,
        headless: launchOptions.headless,
        renderer,
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

    try {
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
        await browser.close();
    }
}

async function createPacketPdfAttachment(data: PacketPdfData): Promise<PacketPdfAttachment> {
    const rendered = await renderPacketPdfBuffer(data);

    return {
        filename: rendered.filename,
        content: rendered.content,
        contentType: 'application/pdf',
    };
}

export async function createPacketPdfAttachmentForRequest(requestId: string): Promise<PacketPdfAttachmentResult> {
    try {
        const packetResult = await getPacketDataByRequestId(requestId);

        if (packetResult.status === 'not_found') {
            return { status: 'skipped', reason: 'not_found' };
        }

        if (packetResult.status === 'not_submitted') {
            return { status: 'skipped', reason: 'not_submitted' };
        }

        if (packetResult.status === 'locked') {
            return { status: 'skipped', reason: 'locked' };
        }

        const attachment = await createPacketPdfAttachment(packetResult.data);
        return { status: 'attached', attachment };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error';
        console.warn('[pdf][packet_attachment] failed', { requestId, error: errorMessage });
        return {
            status: 'failed',
            error: errorMessage,
        };
    }
}

export async function createPacketPdfAttachmentForPublicToken(token: string): Promise<PacketPdfAttachmentResult> {
    try {
        const packetResult = await getPacketDataByPublicToken(token);

        if (packetResult.status === 'not_found') {
            return { status: 'skipped', reason: 'not_found' };
        }

        if (packetResult.status === 'not_submitted') {
            return { status: 'skipped', reason: 'not_submitted' };
        }

        if (packetResult.status === 'locked') {
            return { status: 'skipped', reason: 'locked' };
        }

        const attachment = await createPacketPdfAttachment(packetResult.data);
        return { status: 'attached', attachment };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error';
        console.warn('[pdf][packet_attachment] failed', { error: errorMessage });
        return {
            status: 'failed',
            error: errorMessage,
        };
    }
}

export const __testing = {
    resolveLaunchOptions,
};
