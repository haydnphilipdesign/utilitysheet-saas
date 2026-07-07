'use client';

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

/**
 * Fetches info sheet data and generates a PDF download.
 */
export async function generatePacketPdf(token: string): Promise<void> {
    const response = await fetch(`/api/packet/${token}/pdf`);
    if (!response.ok) {
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
