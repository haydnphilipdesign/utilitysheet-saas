'use client';

import { UTILITY_CATEGORIES } from '@/lib/constants';
import { format } from 'date-fns';

interface PacketData {
    request: {
        id: string;
        property_address: string;
        created_at: string;
    };
    brand: {
        name?: string;
        logo_url?: string;
        primary_color?: string;
        contact_email?: string;
        contact_phone?: string;
        contact_website?: string;
    } | null;
    utilities: Array<{
        category: string;
        provider_name: string;
        provider_phone?: string;
        provider_website?: string;
    }>;
    meta?: {
        show_powered_by?: boolean;
    };
}

/**
 * Fetches info sheet data and generates a PDF download
 */
export async function generatePacketPdf(token: string): Promise<void> {
    const escapeHtml = (value: string) =>
        value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    const safeExternalUrl = (value: string | null | undefined): string | null => {
        if (!value) return null;
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }
            return parsed.toString();
        } catch {
            return null;
        }
    };

    const safeHexColor = (value: string | null | undefined, fallback: string): string => {
        if (!value) return fallback;
        const candidate = value.trim();
        if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(candidate)) {
            return candidate;
        }
        return fallback;
    };

    const sanitizeFilenamePart = (value: string): string => {
        const cleaned = value
            .trim()
            .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
            .replaceAll(/-+/g, '-')
            .replaceAll(/^-|-$/g, '');
        return cleaned.slice(0, 60) || 'utility-info-sheet';
    };

    // 1. Fetch info sheet data
    const response = await fetch(`/api/packet/${token}`);
    if (!response.ok) {
        throw new Error('Failed to fetch info sheet data');
    }
    const data: PacketData = await response.json();

    // 2. Dynamic import for PDF generation
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    // 3. Create a temporary iframe for isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px'; // Set sufficient height
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // Get the iframe document
    const iframeDoc = iframe.contentWindow?.document;
    const iframeBody = iframeDoc?.body;

    if (!iframeDoc || !iframeBody) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    const { request, brand, utilities } = data;
    const showPoweredBy = data.meta?.show_powered_by ?? true;
    const safePrimaryColor = safeHexColor(brand?.primary_color, '#10b981');
    const safeBrandLogoUrl = safeExternalUrl(brand?.logo_url);
    const safeBrandName = escapeHtml(brand?.name || 'UtilitySheet');
    const safeBrandContactPhone = escapeHtml(brand?.contact_phone || '');
    const safeBrandContactEmail = escapeHtml(brand?.contact_email || '');
    const safeBrandContactWebsite = escapeHtml(brand?.contact_website || '');
    const safePropertyAddress = escapeHtml(request.property_address);

    const footerText = showPoweredBy
        ? `Powered by utilitysheet.com${brand?.contact_email ? ` &bull; ${safeBrandContactEmail}` : ''}`
        : (brand?.contact_email ? safeBrandContactEmail : '');

    const footerHtml = footerText
        ? `
            <!-- Footer -->
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                <p style="font-size: 13px; color: #71717a; margin: 0;">
                    ${footerText}
                </p>
            </div>
        `
        : '';

    // 4. Render the info sheet content into the iframe
    // We add base styles directly to the iframe body to ensure clean slate
    iframeBody.style.margin = '0';
    iframeBody.style.padding = '0';
    iframeBody.style.backgroundColor = '#ffffff';

    iframeBody.innerHTML = `
        <div style="padding: 48px; background: #ffffff; color: #09090b; font-family: Arial, sans-serif, system-ui; min-height: 100%; box-sizing: border-box;">
            <!-- Branding Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 2px solid #e4e4e7; margin-bottom: 32px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    ${safeBrandLogoUrl
            ? `<img src="${escapeHtml(safeBrandLogoUrl)}" alt="${safeBrandName}" style="height: 48px; width: auto;" crossorigin="anonymous" />`
            : `<div style="height: 48px; width: 48px; border-radius: 8px; background: ${safePrimaryColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">
                            ${escapeHtml(brand?.name ? brand.name.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2) : 'US')}
                        </div>`
        }
                    <div>
                        <h2 style="font-weight: 700; color: #09090b; margin: 0; font-size: 20px;">${safeBrandName}</h2>
                        <p style="font-size: 14px; color: #71717a; margin: 4px 0 0 0;">${safeBrandContactPhone}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 14px; color: #71717a; margin: 0;">${safeBrandContactEmail}</p>
                    <p style="font-size: 14px; color: #71717a; margin: 4px 0 0 0;">${safeBrandContactWebsite}</p>
                </div>
            </div>

            <!-- Title Section -->
            <div style="text-align: center; padding: 24px 0 48px 0;">
                <h1 style="font-size: 32px; font-weight: 800; color: #09090b; margin: 0 0 16px 0; letter-spacing: -0.02em;">
                    Utility Info Sheet
                </h1>
                <div style="background: #f4f4f5; padding: 12px 24px; border-radius: 12px; border: 1px solid #e4e4e7; display: inline-block; margin: 0 auto;">
                    <span style="color: #059669; margin-right: 8px; font-size: 18px; vertical-align: middle;">📍</span>
                    <span style="color: #09090b; font-weight: 600; font-size: 18px; vertical-align: middle;">${safePropertyAddress}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 14px; color: #52525b;">
                    <span>📅</span>
                    <span>Generated on ${format(new Date(request.created_at), 'MMMM d, yyyy')}</span>
                </div>
            </div>

            <!-- Utility Table -->
            <div style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 0; margin-bottom: 32px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <div style="background: #f9fafb; padding: 16px 24px; border-bottom: 1px solid #e4e4e7;">
                    <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0;">Utility Providers</h3>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #e4e4e7; background: #ffffff;">
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Utility</th>
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Provider</th>
                            <th style="text-align: left; padding: 16px 24px; color: #52525b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Contact</th>
                        </tr>
                    </thead>
                    <tbody style="background: #ffffff;">
                        ${utilities.length === 0
            ? `<tr><td colspan="3" style="text-align: center; padding: 48px; color: #71717a;">No utility information provided yet.</td></tr>`
            : utilities.map((utility) => {
                const safeCategory = escapeHtml(String(utility.category || ''));
                const safeProviderName = escapeHtml(String(utility.provider_name || 'Not sure'));
                const safeProviderPhone = utility.provider_phone ? escapeHtml(String(utility.provider_phone)) : '';

                // Safely extract hostname from URL
                let websiteDisplay = '';
                if (utility.provider_website) {
                    const safeWebsiteUrl = safeExternalUrl(utility.provider_website);
                    if (safeWebsiteUrl) {
                        try {
                            websiteDisplay = new URL(safeWebsiteUrl).hostname;
                        } catch {
                            websiteDisplay = safeWebsiteUrl;
                        }
                    }
                }
                const safeWebsiteDisplay = websiteDisplay ? escapeHtml(websiteDisplay) : '';
                return `
                                <tr style="border-bottom: 1px solid #e4e4e7;">
                                    <td style="padding: 16px 24px;">
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            <span style="font-size: 20px; color: #09090b;">${UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}</span>
                                            <span style="font-weight: 600; color: #09090b; text-transform: capitalize;">${safeCategory}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 16px 24px; color: #3f3f46; font-weight: 500;">${safeProviderName}</td>
                                    <td style="padding: 16px 24px;">
                                        ${safeProviderPhone ? `<span style="color: #059669; font-size: 14px; font-weight: 500;">${safeProviderPhone}</span>` : ''}
                                        ${safeProviderPhone && safeWebsiteDisplay ? '<span style="color: #d4d4d8; margin: 0 8px;">|</span>' : ''}
                                        ${safeWebsiteDisplay ? `<span style="color: #2563eb; font-size: 14px;">${safeWebsiteDisplay}</span>` : ''}
                                    </td>
                                </tr>
                            `;
            }).join('')
        }
                    </tbody>
                </table>
            </div>

            <!-- Next Steps -->
            <div style="background: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0 0 20px 0;">Buyer Next Steps</h3>
                <ol style="margin: 0; padding: 0; list-style: none;">
                    ${[
            'Contact each utility provider above to set up new service in your name.',
            'Schedule service to begin on your closing date or the following business day.',
            'Have your closing documents handy — providers may ask for verification of ownership.',
            'If transferring internet service, contact your provider at least 1-2 weeks in advance.'
        ].map((step, i) => `
                        <li style="display: flex; gap: 16px; margin-bottom: 16px; color: #3f3f46; align-items: flex-start; line-height: 1.5;">
                            <span style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 12px; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">${i + 1}</span>
                            <span>${step}</span>
                        </li>
                    `).join('')}
                </ol>
            </div>

            ${footerHtml}
        </div>
    `;

    try {
        console.log('PDF Gen: Waiting for images...');
        // 5. Wait for images to load
        const images = iframeBody.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) resolve(true);
                        else {
                            img.onload = () => resolve(true);
                            img.onerror = () => {
                                console.warn('PDF Gen: Image failed to load', img.src);
                                resolve(true);
                            };
                        }
                    })
            )
        );

        console.log('PDF Gen: Starting html2canvas...');
        // 6. Generate canvas from the iframe body (specifically the wrapper div)
        const canvas = await html2canvas(iframeBody.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false, // Disable logging for html2canvas
            allowTaint: true, // Allow tainted images (might help if CORS fails)
        });

        console.log('PDF Gen: Canvas created, generating PDF...');
        // 7. Create PDF with standard US Letter size (8.5" x 11")
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter', // 8.5" x 11"
        });

        // Letter size in inches: 8.5 x 11
        // Use margins of 0.5" on each side for content area of 7.5" x 10"
        const pageWidth = 8.5;
        const pageHeight = 11;
        const margin = 0.5;
        const contentWidth = pageWidth - (margin * 2);
        const contentHeight = pageHeight - (margin * 2);

        // Calculate scale to fit content within the page, maintaining aspect ratio
        const canvasAspectRatio = canvas.width / canvas.height;
        const contentAspectRatio = contentWidth / contentHeight;

        let imgWidth: number;
        let imgHeight: number;

        if (canvasAspectRatio > contentAspectRatio) {
            // Canvas is wider - fit to width
            imgWidth = contentWidth;
            imgHeight = contentWidth / canvasAspectRatio;
        } else {
            // Canvas is taller - fit to height
            imgHeight = contentHeight;
            imgWidth = contentHeight * canvasAspectRatio;
        }

        // Center the image on the page
        const xOffset = margin + (contentWidth - imgWidth) / 2;
        const yOffset = margin;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

        // 8. Download PDF
        const filename = `utility-info-sheet-${sanitizeFilenamePart(request.property_address.split(',')[0] || '')}.pdf`;
        pdf.save(filename);
        console.log('PDF Gen: PDF saved');
    } catch (err) {
        console.error('PDF Gen Error:', err);
        throw err;
    } finally {
        // 9. Clean up
        document.body.removeChild(iframe);
    }
}
