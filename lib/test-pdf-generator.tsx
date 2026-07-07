'use client';

import type { BrandProfileFormData, PacketMode } from '@/types';
import { extractFilenameFromContentDisposition } from '@/lib/pdf-generator';

/**
 * Downloads a test PDF rendered from the current (possibly unsaved) branding
 * form values. The heavy lifting happens in POST /api/branding/test-pdf, which
 * uses the same Chromium print pipeline as production downloads, so the test
 * PDF has real pagination, selectable text, running headers, and page numbers.
 */
export async function generateTestPdf(
    branding: Partial<BrandProfileFormData>,
    mode: PacketMode = 'simple'
): Promise<void> {
    const response = await fetch('/api/branding/test-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding, mode }),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to generate test PDF');
    }

    const blob = await response.blob();
    const filename =
        extractFilenameFromContentDisposition(response.headers.get('content-disposition')) ||
        'utility-info-sheet-preview.pdf';

    const objectUrl = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
