'use client';

import { fitRectWithin } from '@/lib/pdf-fit';
import { buildPacketPdfHtml, type PacketPdfData } from '@/lib/pdf/packet-html';

/**
 * Fetches info sheet data and generates a PDF download.
 */
export async function generatePacketPdf(token: string): Promise<void> {
    // 1. Fetch packet data
    const response = await fetch(`/api/packet/${token}`);
    if (!response.ok) {
        throw new Error('Failed to fetch info sheet data');
    }

    const data: PacketPdfData = await response.json();
    const render = buildPacketPdfHtml(data);

    // 2. Dynamic imports for rendering
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    // 3. Create hidden iframe for HTML rendering
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '900px';
    iframe.style.height = '1400px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    const iframeBody = iframeDoc?.body;

    if (!iframeDoc || !iframeBody) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    try {
        iframeDoc.open();
        iframeDoc.write(render.html);
        iframeDoc.close();

        // 4. Wait for images to load
        const images = iframeBody.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) {
                            resolve(true);
                            return;
                        }

                        img.onload = () => resolve(true);
                        img.onerror = () => resolve(true);
                    })
            )
        );

        const rootElement = iframeDoc.querySelector(render.rootSelector) as HTMLElement | null;
        if (!rootElement) {
            throw new Error('Failed to locate packet render root');
        }

        // 5. Convert HTML to canvas
        const canvas = await html2canvas(rootElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
        });

        // 6. Fit onto one US Letter PDF page
        const imgData = canvas.toDataURL('image/png');
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

        const { width: imgWidth, height: imgHeight } = fitRectWithin({
            sourceWidth: canvas.width,
            sourceHeight: canvas.height,
            targetWidth: contentWidth,
            targetHeight: contentHeight,
        });

        const xOffset = margin + (contentWidth - imgWidth) / 2;
        const yOffset = margin + (contentHeight - imgHeight) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
        pdf.save(render.filename);
    } finally {
        document.body.removeChild(iframe);
    }
}
