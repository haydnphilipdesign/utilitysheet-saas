import { DEFAULT_BUYER_STEPS, UTILITY_CATEGORIES } from '@/lib/constants';
import { getPacketDataByRequestId, type PacketDataPayload } from '@/lib/packet/packet-data';
import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

export interface PacketPdfAttachment {
    filename: string;
    content: Buffer;
    contentType: 'application/pdf';
}

export type PacketPdfAttachmentResult =
    | { status: 'attached'; attachment: PacketPdfAttachment }
    | { status: 'skipped'; reason: 'not_found' | 'not_submitted' | 'locked' }
    | { status: 'failed'; error: string };

function safeHexColor(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return trimmed;
    return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
    const safeHex = safeHexColor(hex, '#10b981').replace('#', '');
    const normalized = safeHex.length === 3
        ? safeHex.split('').map((c) => `${c}${c}`).join('')
        : safeHex;

    const parsed = Number.parseInt(normalized, 16);
    return [
        (parsed >> 16) & 255,
        (parsed >> 8) & 255,
        parsed & 255,
    ];
}

function sanitizeFilenamePart(value: string): string {
    const cleaned = value
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return cleaned.slice(0, 60) || 'utility-info-sheet';
}

function truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function firstInitials(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || 'US';
}

async function fetchLogoData(logoUrl: string | null | undefined): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
    if (!logoUrl) return null;

    try {
        const response = await fetch(logoUrl);
        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || '';
        const lowerType = contentType.toLowerCase();
        const format: 'PNG' | 'JPEG' | null =
            lowerType.includes('png') ? 'PNG' : (lowerType.includes('jpeg') || lowerType.includes('jpg') ? 'JPEG' : null);

        if (!format) return null;

        const arrayBuffer = await response.arrayBuffer();
        const dataUrl = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
        return { dataUrl, format };
    } catch {
        return null;
    }
}

function getUtilityLabel(category: string): string {
    return UTILITY_CATEGORIES.find((entry) => entry.key === category)?.label || category;
}

function splitLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
    return (pdf.splitTextToSize(text, maxWidth) as string[]).filter(Boolean);
}

export async function buildPacketPdfAttachment(data: PacketDataPayload): Promise<PacketPdfAttachment> {
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });

    const brand = data.brand;
    const brandName = (brand?.name || 'UtilitySheet').trim() || 'UtilitySheet';
    const primaryColor = safeHexColor(brand?.primary_color, '#10b981');
    const [pr, pg, pb] = hexToRgb(primaryColor);
    const logoImage = await fetchLogoData(brand?.logo_url);

    const forceShowPoweredBy = data.meta?.show_powered_by ?? true;
    const showPoweredBy = forceShowPoweredBy || Boolean(brand?.show_powered_by);
    const showGenerationDate = brand?.show_generation_date ?? true;

    let y = MARGIN;

    // Header block
    pdf.setFillColor(pr, pg, pb);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 78, 10, 10, 'F');

    const logoX = MARGIN + 12;
    const logoY = y + 12;
    const logoSize = 52;

    if (logoImage) {
        try {
            pdf.addImage(logoImage.dataUrl, logoImage.format, logoX, logoY, logoSize, logoSize);
        } catch {
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(logoX, logoY, logoSize, logoSize, 8, 8, 'F');
            pdf.setTextColor(pr, pg, pb);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(16);
            pdf.text(firstInitials(brandName), logoX + (logoSize / 2), logoY + 32, { align: 'center' });
        }
    } else {
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(logoX, logoY, logoSize, logoSize, 8, 8, 'F');
        pdf.setTextColor(pr, pg, pb);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text(firstInitials(brandName), logoX + (logoSize / 2), logoY + 32, { align: 'center' });
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text(truncateText(brandName, 38), logoX + logoSize + 12, y + 34);

    const contactParts = [brand?.contact_email, brand?.contact_phone, brand?.contact_website]
        .map((part) => (part || '').trim())
        .filter(Boolean);
    if (contactParts.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(truncateText(contactParts.join(' • '), 90), logoX + logoSize + 12, y + 54);
    }

    y += 94;

    // Title and property
    pdf.setTextColor(17, 24, 39);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('Utility Info Sheet', MARGIN, y);

    const addressLines = splitLines(pdf, data.request.property_address, CONTENT_WIDTH - 24).slice(0, 3);
    y += 12;
    const addressHeight = 18 + (addressLines.length * 13);
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, addressHeight, 8, 8, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(17, 24, 39);
    let addressY = y + 18;
    for (const line of addressLines) {
        pdf.text(line, MARGIN + 12, addressY);
        addressY += 13;
    }

    y += addressHeight + 14;

    if (showGenerationDate) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(75, 85, 99);
        const generatedOn = new Date(data.request.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        pdf.text(`Generated on ${generatedOn}`, MARGIN, y);
        y += 16;
    }

    // Optional welcome message (trimmed first if space gets tight)
    if (brand?.welcome_message) {
        const welcomeLines = splitLines(pdf, truncateText(brand.welcome_message, 400), CONTENT_WIDTH).slice(0, 3);
        const welcomeHeight = 14 + (welcomeLines.length * 11);
        if (y + welcomeHeight < PAGE_HEIGHT - (MARGIN + 230)) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(55, 65, 81);
            for (const line of welcomeLines) {
                pdf.text(line, MARGIN, y);
                y += 11;
            }
            y += 8;
        }
    }

    // Utilities section (mandatory)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(17, 24, 39);
    pdf.text('Utility Providers', MARGIN, y);
    y += 10;

    pdf.setDrawColor(229, 231, 235);
    pdf.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    y += 14;

    const utilities = data.utilities;
    if (utilities.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(107, 114, 128);
        pdf.text('No utility information was provided.', MARGIN, y);
        y += 18;
    } else {
        for (const utility of utilities) {
            const label = getUtilityLabel(utility.category);
            const provider = utility.provider_name || 'Not sure';
            const contact = [utility.provider_phone, utility.provider_website]
                .map((part) => (part || '').trim())
                .filter(Boolean)
                .join(' • ');

            const rowText = contact
                ? `${label}: ${provider} (${contact})`
                : `${label}: ${provider}`;

            const rowLines = splitLines(pdf, truncateText(rowText, 220), CONTENT_WIDTH).slice(0, 2);
            const rowHeight = Math.max(14, rowLines.length * 11);

            if (y + rowHeight > PAGE_HEIGHT - (MARGIN + 120)) {
                break;
            }

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(31, 41, 55);

            for (const rowLine of rowLines) {
                pdf.text(rowLine, MARGIN, y);
                y += 11;
            }

            y += 3;
        }
    }

    // Optional next steps (trimmed second when space gets tight)
    const nextSteps = (brand?.buyer_next_steps && brand.buyer_next_steps.length > 0)
        ? brand.buyer_next_steps
        : DEFAULT_BUYER_STEPS;

    const canRenderNextSteps = y + 72 < PAGE_HEIGHT - (MARGIN + 46);
    if (canRenderNextSteps) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(17, 24, 39);
        pdf.text(brand?.next_steps_title || 'Buyer Next Steps', MARGIN, y);
        y += 14;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(55, 65, 81);

        for (let index = 0; index < nextSteps.length; index += 1) {
            const bulletLines = splitLines(pdf, truncateText(nextSteps[index], 180), CONTENT_WIDTH - 16).slice(0, 2);
            const bulletHeight = Math.max(13, bulletLines.length * 11);

            if (y + bulletHeight > PAGE_HEIGHT - (MARGIN + 42)) {
                break;
            }

            pdf.text(`${index + 1}.`, MARGIN, y);
            let bulletY = y;
            for (const bulletLine of bulletLines) {
                pdf.text(bulletLine, MARGIN + 16, bulletY);
                bulletY += 11;
            }

            y += bulletHeight + 2;
        }
    }

    // Optional disclaimer (trimmed last)
    if (brand?.disclaimer_text && y + 34 < PAGE_HEIGHT - (MARGIN + 20)) {
        const disclaimerLines = splitLines(pdf, truncateText(brand.disclaimer_text, 220), CONTENT_WIDTH).slice(0, 2);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        for (const line of disclaimerLines) {
            pdf.text(line, MARGIN, y);
            y += 10;
        }
    }

    // Footer
    const footerText = showPoweredBy
        ? `Powered by utilitysheet.com${brand?.contact_email ? ` • ${brand.contact_email}` : ''}`
        : (brand?.contact_email || '');

    if (footerText) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.text(truncateText(footerText, 120), MARGIN, PAGE_HEIGHT - MARGIN + 8);
    }

    const filePart = sanitizeFilenamePart((data.request.property_address.split(',')[0] || '').trim());
    const filename = `utility-info-sheet-${filePart}.pdf`;
    const content = Buffer.from(pdf.output('arraybuffer'));

    return {
        filename,
        content,
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

        const attachment = await buildPacketPdfAttachment(packetResult.data);
        return { status: 'attached', attachment };
    } catch (error) {
        return {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown PDF generation error',
        };
    }
}
