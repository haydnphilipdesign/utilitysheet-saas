'use client';

import { UTILITY_CATEGORIES, DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { format } from 'date-fns';
import { fitRectWithin } from '@/lib/pdf-fit';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { clampBrandingText } from '@/lib/branding/text';
import type { BrandProfileFormData } from '@/types';

// Sample data matching the preview component
const SAMPLE_ADDRESS = '123 Main St, Springfield, IL 62701';
const SAMPLE_UTILITIES = [
    { category: 'electric', provider_name: 'Springfield Electric', provider_phone: '(800) 555-0100' },
    { category: 'gas', provider_name: 'County Gas Co.', provider_phone: '(800) 555-0101' },
    { category: 'water', provider_name: 'Springfield Water', provider_phone: '(800) 555-0102' },
    { category: 'trash', provider_name: 'Waste Services', provider_phone: '(800) 555-0103' },
    { category: 'internet', provider_name: 'Xfinity', provider_phone: '(800) 555-0104' },
];

/**
 * Generates a test PDF using the current branding form data with sample utility data.
 * This allows users to preview how their branding will look in a real PDF without
 * needing to save the profile or create a real request.
 */
export async function generateTestPdf(branding: BrandProfileFormData): Promise<void> {
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

    // Dynamic import for PDF generation
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    // Create a temporary iframe for isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    const iframeBody = iframeDoc?.body;

    if (!iframeDoc || !iframeBody) {
        document.body.removeChild(iframe);
        throw new Error('Failed to create iframe for PDF generation');
    }

    // Prepare branding data
    const showPoweredBy = branding.show_powered_by ?? true;
    const showGenerationDate = branding.show_generation_date ?? true;
    const safePrimaryColor = safeHexColor(branding.primary_color, '#10b981');
    const safeBrandLogoUrl = safeExternalUrl(branding.logo_url);
    const safeBrandName = escapeHtml(clampBrandingText(branding.name || 'Your Brand', BRAND_PROFILE_LIMITS.brandNameMax) || 'Your Brand');
    const safeBrandContactName = escapeHtml(clampBrandingText(branding.contact_name || '', BRAND_PROFILE_LIMITS.contactNameMax));
    const safeBrandContactPhone = escapeHtml(clampBrandingText(branding.contact_phone || '', BRAND_PROFILE_LIMITS.contactPhoneMax));
    const safeBrandContactEmail = escapeHtml(clampBrandingText(branding.contact_email || '', BRAND_PROFILE_LIMITS.contactEmailMax));
    const safeBrandContactWebsite = escapeHtml(clampBrandingText(branding.contact_website || '', BRAND_PROFILE_LIMITS.contactWebsiteMax));
    const safePropertyAddress = escapeHtml(SAMPLE_ADDRESS);

    // Buyer next steps
    const rawBuyerNextSteps = branding.buyer_next_steps && branding.buyer_next_steps.length > 0
        ? branding.buyer_next_steps
        : DEFAULT_BUYER_STEPS;

    const buyerNextSteps = rawBuyerNextSteps
        .map((step: string) => clampBrandingText(step, BRAND_PROFILE_LIMITS.buyerNextStepMax))
        .filter(Boolean)
        .slice(0, BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems);

    const nextStepsTitle = escapeHtml(clampBrandingText(branding.next_steps_title || 'Buyer Next Steps', BRAND_PROFILE_LIMITS.nextStepsTitleMax) || 'Buyer Next Steps');
    const welcomeMessage = branding.welcome_message
        ? escapeHtml(clampBrandingText(branding.welcome_message, BRAND_PROFILE_LIMITS.welcomeMessageMax))
        : '';
    const disclaimerText = branding.disclaimer_text
        ? escapeHtml(clampBrandingText(branding.disclaimer_text, BRAND_PROFILE_LIMITS.disclaimerTextMax))
        : '';

    const footerText = showPoweredBy
        ? `Powered by utilitysheet.com${safeBrandContactEmail ? ` &bull; ${safeBrandContactEmail}` : ''}`
        : (safeBrandContactEmail ? safeBrandContactEmail : '');

    const footerHtml = footerText || disclaimerText
        ? `
            <!-- Footer -->
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                ${disclaimerText ? `
                <p style="font-size: 11px; color: #71717a; margin: 0 0 8px 0; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; overflow-wrap: anywhere;">
                    ${disclaimerText}
                </p>
                ` : ''}
                ${footerText ? `
                <p style="font-size: 13px; color: #71717a; margin: 0;">
                    ${footerText}
                </p>
                ` : ''}
            </div>
        `
        : '';

    // Render the info sheet content
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
                            ${escapeHtml(branding.name ? branding.name.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2) : 'US')}
                        </div>`
        }
                    <div>
                        <h2 style="font-weight: 700; color: #09090b; margin: 0; font-size: 20px;">${safeBrandName}</h2>
                        ${safeBrandContactName ? `<p style="font-size: 14px; color: #3f3f46; margin: 4px 0 0 0; font-weight: 500;">${safeBrandContactName}</p>` : ''}
                        ${safeBrandContactPhone ? `<p style="font-size: 14px; color: #71717a; margin: 4px 0 0 0;">${safeBrandContactPhone}</p>` : ''}
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
                ${showGenerationDate ? `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 14px; color: #52525b;">
                    <span>📅</span>
                    <span>Generated on ${format(new Date(), 'MMMM d, yyyy')}</span>
                </div>
                ` : ''}
            </div>

            ${welcomeMessage ? `
            <!-- Welcome Message -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 32px;">
                <p style="font-size: 14px; color: #1e40af; margin: 0; line-height: 1.6; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; word-break: break-word; overflow-wrap: anywhere;">${welcomeMessage}</p>
            </div>
            ` : ''}

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
                        ${SAMPLE_UTILITIES.map((utility) => {
            const safeCategory = escapeHtml(String(utility.category));
            const safeProviderName = escapeHtml(String(utility.provider_name));
            const safeProviderPhone = utility.provider_phone ? escapeHtml(String(utility.provider_phone)) : '';
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
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Next Steps -->
            <div style="background: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0 0 20px 0;">${nextStepsTitle}</h3>
                <ol style="margin: 0; padding: 0; list-style: none;">
                    ${buyerNextSteps.filter((step: string) => step.trim()).map((step: string, i: number) => `
                        <li style="display: flex; gap: 16px; margin-bottom: 16px; color: #3f3f46; align-items: flex-start; line-height: 1.6;">
                            <span style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 12px; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">${i + 1}</span>
                            <span style="flex: 1; min-width: 0; word-break: break-word; overflow-wrap: anywhere;">${escapeHtml(step)}</span>
                        </li>
                    `).join('')}
                </ol>
            </div>

            ${footerHtml}
        </div>
    `;

    try {
        // Wait for images to load
        const images = iframeBody.getElementsByTagName('img');
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

        // Generate canvas
        const canvas = await html2canvas(iframeBody.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
        });

        // Create PDF with US Letter size
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

        // Download PDF
        pdf.save('test-utility-sheet.pdf');
    } finally {
        document.body.removeChild(iframe);
    }
}
