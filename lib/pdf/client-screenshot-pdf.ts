'use client';

import { fitRectWithin } from '@/lib/pdf-fit';

export async function downloadScreenshotPdfFromHtml(params: {
    html: string;
    rootSelector: string;
    filename: string;
    iframeWidth?: number;
    iframeHeight?: number;
}): Promise<void> {
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = `${params.iframeWidth ?? 800}px`;
    iframe.style.height = `${params.iframeHeight ?? 1200}px`;
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    try {
        iframeDoc.open();
        iframeDoc.write(params.html);
        iframeDoc.close();

        const root = iframeDoc.querySelector(params.rootSelector) as HTMLElement | null;
        if (!root) {
            throw new Error('Failed to find PDF render root');
        }

        const images = root.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) resolve(true);
                        else {
                            img.onload = () => resolve(true);
                            img.onerror = () => resolve(true);
                        }
                    })
            )
        );

        const canvas = await html2canvas(root, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
        });

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
        pdf.save(params.filename);
    } finally {
        document.body.removeChild(iframe);
    }
}
