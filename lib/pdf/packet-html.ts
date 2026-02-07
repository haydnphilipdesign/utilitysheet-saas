import { format } from 'date-fns';
import { UTILITY_CATEGORIES, DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { clampBrandingText } from '@/lib/branding/text';

export interface PacketPdfData {
    request: {
        id: string;
        property_address: string;
        created_at: string;
        water_source?: string | null;
        sewer_type?: string | null;
        heating_type?: string | null;
    };
    brand: {
        name?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
        contact_name?: string | null;
        contact_email?: string | null;
        contact_phone?: string | null;
        contact_website?: string | null;
        disclaimer_text?: string | null;
        buyer_next_steps?: string[] | null;
        next_steps_title?: string | null;
        show_powered_by?: boolean;
        show_generation_date?: boolean;
        welcome_message?: string | null;
    } | null;
    utilities: Array<{
        category: string;
        provider_name: string;
        provider_phone?: string | null;
        provider_website?: string | null;
    }>;
    meta?: {
        show_powered_by?: boolean;
    };
}

export interface PacketPdfHtmlResult {
    html: string;
    filename: string;
    rootSelector: string;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function safeExternalUrl(value: string | null | undefined): string | null {
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
}

function safeHexColor(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;

    const candidate = value.trim();
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(candidate)) {
        return candidate;
    }

    return fallback;
}

function sanitizeFilenamePart(value: string): string {
    const cleaned = value
        .trim()
        .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
        .replaceAll(/-+/g, '-')
        .replaceAll(/^-|-$/g, '');

    return cleaned.slice(0, 60) || 'utility-info-sheet';
}

function normalizeWebsiteHostname(value: string | null | undefined): string {
    if (!value) return '';

    const safeWebsiteUrl = safeExternalUrl(value);
    if (!safeWebsiteUrl) return '';

    try {
        return new URL(safeWebsiteUrl).hostname;
    } catch {
        return safeWebsiteUrl;
    }
}

export function buildPacketPdfHtml(data: PacketPdfData): PacketPdfHtmlResult {
    const { request, brand, utilities } = data;

    const forceShowPoweredBy = data.meta?.show_powered_by ?? true;
    const showPoweredBy = forceShowPoweredBy || (brand?.show_powered_by ?? false);
    const showGenerationDate = brand?.show_generation_date ?? true;

    const safePrimaryColor = safeHexColor(brand?.primary_color, '#10b981');
    const safeBrandLogoUrl = safeExternalUrl(brand?.logo_url);
    const safeBrandName = escapeHtml(clampBrandingText(brand?.name || 'UtilitySheet', BRAND_PROFILE_LIMITS.brandNameMax) || 'UtilitySheet');
    const safeBrandContactName = escapeHtml(clampBrandingText(brand?.contact_name || '', BRAND_PROFILE_LIMITS.contactNameMax));
    const safeBrandContactPhone = escapeHtml(clampBrandingText(brand?.contact_phone || '', BRAND_PROFILE_LIMITS.contactPhoneMax));
    const safeBrandContactEmail = escapeHtml(clampBrandingText(brand?.contact_email || '', BRAND_PROFILE_LIMITS.contactEmailMax));
    const safeBrandContactWebsite = escapeHtml(clampBrandingText(brand?.contact_website || '', BRAND_PROFILE_LIMITS.contactWebsiteMax));
    const safePropertyAddress = escapeHtml(clampBrandingText(request.property_address, 140));

    const rawBuyerNextSteps = brand?.buyer_next_steps && brand.buyer_next_steps.length > 0
        ? brand.buyer_next_steps
        : DEFAULT_BUYER_STEPS;

    const buyerNextSteps = rawBuyerNextSteps
        .map((step) => clampBrandingText(step, BRAND_PROFILE_LIMITS.buyerNextStepMax))
        .filter(Boolean)
        .slice(0, BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems);

    const nextStepsTitle = escapeHtml(clampBrandingText(brand?.next_steps_title || 'Buyer Next Steps', BRAND_PROFILE_LIMITS.nextStepsTitleMax) || 'Buyer Next Steps');
    const welcomeMessage = brand?.welcome_message
        ? escapeHtml(clampBrandingText(brand.welcome_message, BRAND_PROFILE_LIMITS.welcomeMessageMax))
        : '';
    const disclaimerText = brand?.disclaimer_text
        ? escapeHtml(clampBrandingText(brand.disclaimer_text, BRAND_PROFILE_LIMITS.disclaimerTextMax))
        : '';

    const footerText = showPoweredBy
        ? `Powered by utilitysheet.com${safeBrandContactEmail ? ` &bull; ${safeBrandContactEmail}` : ''}`
        : (safeBrandContactEmail ? safeBrandContactEmail : '');

    const footerHtml = footerText || disclaimerText
        ? `
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

    const homeBasicsHtml = request.water_source || request.sewer_type || request.heating_type
        ? `
            <div style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 0; margin-bottom: 32px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <div style="background: #f9fafb; padding: 16px 24px; border-bottom: 1px solid #e4e4e7;">
                    <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0;">Home Basics</h3>
                </div>
                <div style="padding: 20px 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    ${request.water_source ? `
                    <div>
                        <p style="font-size: 13px; color: #71717a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">Water Source</p>
                        <p style="font-size: 16px; font-weight: 500; color: #09090b; margin: 0; text-transform: capitalize;">${escapeHtml(String(request.water_source).replace('_', ' '))}</p>
                    </div>
                    ` : ''}
                    ${request.sewer_type ? `
                    <div>
                        <p style="font-size: 13px; color: #71717a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">Sewer Type</p>
                        <p style="font-size: 16px; font-weight: 500; color: #09090b; margin: 0; text-transform: capitalize;">${escapeHtml(String(request.sewer_type).replace('_', ' '))}</p>
                    </div>
                    ` : ''}
                    ${request.heating_type ? `
                    <div>
                        <p style="font-size: 13px; color: #71717a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em;">Heating Type</p>
                        <p style="font-size: 16px; font-weight: 500; color: #09090b; margin: 0; text-transform: capitalize;">${escapeHtml(String(request.heating_type).replace('_', ' '))}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `
        : '';

    const utilityRowsHtml = utilities.length === 0
        ? `<tr><td colspan="3" style="text-align: center; padding: 48px; color: #71717a;">No utility information provided yet.</td></tr>`
        : utilities.map((utility) => {
            const safeCategory = escapeHtml(String(utility.category || ''));
            const safeProviderName = escapeHtml(String(utility.provider_name || 'Not sure'));
            const safeProviderPhone = utility.provider_phone ? escapeHtml(String(utility.provider_phone)) : '';
            const safeWebsiteDisplay = escapeHtml(normalizeWebsiteHostname(utility.provider_website));

            return `
                <tr style="border-bottom: 1px solid #e4e4e7;">
                    <td style="padding: 16px 24px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 20px; color: #09090b;">${UTILITY_CATEGORIES.find((category) => category.key === utility.category)?.icon || '🏢'}</span>
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
        }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Utility Info Sheet</title>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
    <div id="packet-pdf-root" style="width: 800px; box-sizing: border-box; padding: 48px; background: #ffffff; color: #09090b; font-family: Arial, sans-serif, system-ui; min-height: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 2px solid #e4e4e7; margin-bottom: 32px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                ${safeBrandLogoUrl
            ? `<img src="${escapeHtml(safeBrandLogoUrl)}" alt="${safeBrandName}" style="height: 48px; width: auto;" crossorigin="anonymous" />`
            : `<div style="height: 48px; width: 48px; border-radius: 8px; background: ${safePrimaryColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">
                    ${escapeHtml(brand?.name ? String(brand.name).split(' ').map((word) => word[0] || '').join('').slice(0, 2) : 'US')}
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
                <span>Generated on ${format(new Date(request.created_at), 'MMMM d, yyyy')}</span>
            </div>
            ` : ''}
        </div>

        ${welcomeMessage ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 32px;">
            <p style="font-size: 14px; color: #1e40af; margin: 0; line-height: 1.6; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; word-break: break-word; overflow-wrap: anywhere;">${welcomeMessage}</p>
        </div>
        ` : ''}

        ${homeBasicsHtml}

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
                    ${utilityRowsHtml}
                </tbody>
            </table>
        </div>

        <div style="background: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0 0 20px 0;">${nextStepsTitle}</h3>
            <ol style="margin: 0; padding: 0; list-style: none;">
                ${buyerNextSteps.filter((step) => step.trim()).map((step, index) => `
                    <li style="display: flex; gap: 16px; margin-bottom: 16px; color: #3f3f46; align-items: flex-start; line-height: 1.6;">
                        <span style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 12px; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">${index + 1}</span>
                        <span style="flex: 1; min-width: 0; word-break: break-word; overflow-wrap: anywhere;">${escapeHtml(step)}</span>
                    </li>
                `).join('')}
            </ol>
        </div>

        ${footerHtml}
    </div>
</body>
</html>
    `.trim();

    const filename = `utility-info-sheet-${sanitizeFilenamePart(request.property_address.split(',')[0] || '')}.pdf`;

    return {
        html,
        filename,
        rootSelector: '#packet-pdf-root',
    };
}
