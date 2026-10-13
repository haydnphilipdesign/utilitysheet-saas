'use client';

import { toast } from 'sonner';
import { detectMaintenance, formatExpectedBack, type MaintenanceNotice } from '@/lib/maintenance/client';

export function extractFilenameFromContentDisposition(headerValue: string | null): string | null {
    if (!headerValue) return null;

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]).replaceAll('"', '').trim();
        } catch {
            return utf8Match[1].replaceAll('"', '').trim();
        }
    }

    const plainMatch = /filename="?([^"]+)"?/i.exec(headerValue);
    if (plainMatch?.[1]) {
        return plainMatch[1].trim();
    }

    return null;
}

/** The download was refused because PDF downloads are paused, not because it failed. */
export class PacketPdfMaintenanceError extends Error {
    constructor(readonly notice: MaintenanceNotice) {
        super('PDF downloads are paused for maintenance');
        this.name = 'PacketPdfMaintenanceError';
    }
}

/** One message for every download button, so a pause never reads as a broken PDF. */
export function notifyPacketPdfFailure(error: unknown): void {
    if (error instanceof PacketPdfMaintenanceError) {
        const expected = formatExpectedBack(error.notice.expectedBackAt);
        toast.info('PDF downloads are paused for a short planned update.', {
            description: `Nothing is wrong with this sheet. ${expected ? `We expect to be back around ${expected}.` : 'Please try the download again a little later.'}`,
            duration: 12_000,
        });
        return;
    }
    toast.error('We couldn’t create the PDF. Try again.');
}

/**
 * Fetches info sheet data and generates a PDF download.
 */
export async function generatePacketPdf(token: string): Promise<void> {
    const response = await fetch(`/api/packet/${token}/pdf`);
    if (!response.ok) {
        const notice = await detectMaintenance(response);
        if (notice) throw new PacketPdfMaintenanceError(notice);
        throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const filename =
        extractFilenameFromContentDisposition(response.headers.get('content-disposition')) ||
        'utility-info-sheet.pdf';

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
