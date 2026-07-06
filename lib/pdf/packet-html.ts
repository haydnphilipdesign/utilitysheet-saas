import { format } from 'date-fns';
import { UTILITY_CATEGORIES, DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import { clampBrandingText } from '@/lib/branding/text';
import { DEFAULT_BRAND_COLOR, getPacketTitle } from '@/lib/branding/deliverable';

export interface PacketPdfData {
    mode?: 'simple' | 'advanced';
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
        meter_number?: string | null;
        trash_details?: {
            has_recycling?: 'yes' | 'no' | 'not_sure' | null;
            trash_pickup_day?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure' | null;
            trash_pickup_days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure'> | null;
            recycling_pickup_day?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'varies' | 'not_sure' | null;
        } | null;
    }>;
    advanced_sections?: Array<{
        key: string;
        title: string;
        fields: Array<{
            key: string;
            label: string;
            value: string;
        }>;
    }>;
    meta?: {
        show_powered_by?: boolean;
    };
}

export interface PacketPdfHtmlResult {
    html: string;
    filename: string;
    rootSelector: string;
    renderStrategy?: 'screenshot' | 'print_pdf';
    headerTemplate?: string;
    footerTemplate?: string;
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

function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function formatPickupDay(day: string | null | undefined): string {
    if (!day) return 'Not sure';
    const normalized = day.trim().toLowerCase();
    const dayLabels: Record<string, string> = {
        mon: 'Monday',
        tue: 'Tuesday',
        wed: 'Wednesday',
        thu: 'Thursday',
        fri: 'Friday',
        sat: 'Saturday',
        sun: 'Sunday',
        varies: 'Varies',
        not_sure: 'Not sure',
    };
    return dayLabels[normalized] || 'Not sure';
}

function formatPickupDays(days: string[] | null | undefined): string {
    if (!days || days.length === 0) return 'Not sure';
    return days.map(formatPickupDay).join(', ');
}

function formatRecyclingValue(value: string | null | undefined): string {
    if (!value) return 'Not sure';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yes') return 'Yes';
    if (normalized === 'no') return 'No';
    return 'Not sure';
}

function getTrashScheduleDetailLines(trashDetails: PacketPdfData['utilities'][number]['trash_details']): string[] {
    if (!trashDetails) return [];
    const lines: string[] = [];

    if (trashDetails.has_recycling !== undefined) {
        lines.push(`Recycling: ${formatRecyclingValue(trashDetails.has_recycling)}`);
    }
    if (Array.isArray(trashDetails.trash_pickup_days) && trashDetails.trash_pickup_days.length > 0) {
        lines.push(`Trash pickup: ${formatPickupDays(trashDetails.trash_pickup_days)}`);
    } else if (trashDetails.trash_pickup_day !== undefined) {
        lines.push(`Trash pickup: ${formatPickupDay(trashDetails.trash_pickup_day)}`);
    }
    if (trashDetails.recycling_pickup_day !== undefined && trashDetails.has_recycling !== 'no') {
        lines.push(`Recycling pickup: ${formatPickupDay(trashDetails.recycling_pickup_day)}`);
    }

    return lines;
}

function getBrandInitials(name: string | null | undefined): string {
    const initials = (name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return initials || 'US';
}

function chunkFields<T>(fields: T[]): Array<[T, T?]> {
    const chunks: Array<[T, T?]> = [];
    for (let index = 0; index < fields.length; index += 2) {
        chunks.push([fields[index], fields[index + 1]]);
    }
    return chunks;
}

interface SharedMarkupContext {
    data: PacketPdfData;
    safePrimaryColor: string;
    safeBrandLogoUrl: string | null;
    safeBrandName: string;
    safeBrandContactName: string;
    safeBrandContactPhone: string;
    safeBrandContactEmail: string;
    safeBrandContactWebsite: string;
    safePropertyAddress: string;
}

function buildBrandHeaderMarkup(context: SharedMarkupContext): string {
    const {
        data,
        safePrimaryColor,
        safeBrandLogoUrl,
        safeBrandName,
        safeBrandContactName,
        safeBrandContactPhone,
        safeBrandContactEmail,
        safeBrandContactWebsite,
    } = context;

    return `
        <div class="brand-header keep-together">
            <div class="brand-identity">
                ${safeBrandLogoUrl
        ? `<img src="${escapeHtml(safeBrandLogoUrl)}" alt="${safeBrandName}" class="brand-logo" crossorigin="anonymous" />`
        : `<div class="brand-mark" style="background: ${safePrimaryColor};">${escapeHtml(getBrandInitials(data.brand?.name))}</div>`}
                <div>
                    <h2 class="brand-name">${safeBrandName}</h2>
                    ${safeBrandContactName ? `<p class="brand-contact-name">${safeBrandContactName}</p>` : ''}
                    ${safeBrandContactPhone ? `<p class="brand-contact-line">${safeBrandContactPhone}</p>` : ''}
                </div>
            </div>
            <div class="brand-contact-right">
                ${safeBrandContactEmail ? `<p class="brand-contact-line">${safeBrandContactEmail}</p>` : ''}
                ${safeBrandContactWebsite ? `<p class="brand-contact-line">${safeBrandContactWebsite}</p>` : ''}
            </div>
        </div>`;
}

function buildTitleBlockMarkup(context: SharedMarkupContext, title: string, showGenerationDate: boolean): string {
    return `
        <div class="title-block keep-together">
            <h1>${title}</h1>
            <div class="address-chip">
                <span class="address-pin">📍</span>
                <span>${context.safePropertyAddress}</span>
            </div>
            ${showGenerationDate
        ? `<div class="generation-date">Generated on ${format(new Date(context.data.request.created_at), 'MMMM d, yyyy')}</div>`
        : ''}
        </div>`;
}

function buildHomeBasicsMarkup(request: PacketPdfData['request']): string {
    const basics = [
        ['Water Source', request.water_source],
        ['Sewer Type', request.sewer_type],
        ['Heating Type', request.heating_type],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (basics.length === 0) return '';

    return `
        <section class="home-basics keep-together">
            <div class="section-heading accent-heading"><h3>Home Basics</h3></div>
            <div class="home-basics-grid">
                ${basics.map(([label, value]) => `
                    <div class="home-basic">
                        <p class="home-basic-label">${label}</p>
                        <p class="home-basic-value">${escapeHtml(value.replaceAll('_', ' '))}</p>
                    </div>`).join('')}
            </div>
        </section>`;
}

function buildUtilitiesMarkup(utilities: PacketPdfData['utilities']): string {
    const rows = utilities.length === 0
        ? `<tr class="provider-row"><td colspan="3" class="provider-empty">No utility information provided yet.</td></tr>`
        : utilities.map((utility) => {
            const safeCategory = escapeHtml(String(utility.category || '').replaceAll('_', ' '));
            const safeProviderName = escapeHtml(String(utility.provider_name || 'Not sure'));
            const safeProviderPhone = utility.provider_phone ? escapeHtml(String(utility.provider_phone)) : '';
            const safeWebsiteDisplay = escapeHtml(normalizeWebsiteHostname(utility.provider_website));
            const safeMeterNumber = utility.category === 'electric' && utility.meter_number
                ? escapeHtml(String(utility.meter_number).trim())
                : '';
            const trashScheduleLines = utility.category === 'trash'
                ? getTrashScheduleDetailLines(utility.trash_details)
                : [];

            return `
                <tr class="provider-row">
                    <td><div class="utility-label">
                        <span class="utility-icon">${UTILITY_CATEGORIES.find((category) => category.key === utility.category)?.icon || '🏢'}</span>
                        <span class="utility-category">${safeCategory}</span>
                    </div></td>
                    <td class="provider-name">${safeProviderName}</td>
                    <td class="provider-contact"><div>
                        <div>
                            ${safeProviderPhone ? `<span class="provider-phone">${safeProviderPhone}</span>` : ''}
                            ${safeProviderPhone && safeWebsiteDisplay ? '<span class="contact-divider">|</span>' : ''}
                            ${safeWebsiteDisplay ? `<span class="provider-website">${safeWebsiteDisplay}</span>` : ''}
                        </div>
                        ${safeMeterNumber ? `<div class="provider-detail"><strong>Meter #:</strong> ${safeMeterNumber}</div>` : ''}
                        ${trashScheduleLines.map((line) => `<div class="provider-detail">${escapeHtml(line)}</div>`).join('')}
                    </div></td>
                </tr>`;
        }).join('');

    return `
        <table class="provider-table">
            <thead>
                <tr class="provider-section-title">
                    <th colspan="3"><div class="section-heading accent-heading"><h3>Utility Providers</h3></div></th>
                </tr>
                <tr class="provider-columns"><th>Utility</th><th>Provider</th><th>Contact</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildAdvancedSectionsMarkup(sections: NonNullable<PacketPdfData['advanced_sections']>): string {
    return sections.map((section) => `
        <section class="advanced-section keep-together">
            <div class="section-heading accent-heading"><h3>${escapeHtml(section.title)}</h3></div>
            ${section.fields.length === 0
        ? '<p class="provider-empty">No details provided.</p>'
        : `<div class="detail-grid">${chunkFields(section.fields).map(([left, right]) => `
                <div class="detail-pair">
                    ${[left, right].filter((field): field is typeof left => Boolean(field)).map((field) => `
                        <div class="detail-row">
                            <div class="detail-label">${escapeHtml(field.label)}</div>
                            <div class="detail-value">${escapeHtml(field.value)}</div>
                        </div>`).join('')}
                </div>`).join('')}</div>`}
        </section>`).join('');
}

function buildBuyerNextStepsMarkup(title: string, steps: string[]): string {
    return `
        <section class="buyer-steps-section">
            <div class="section-heading accent-heading"><h3>${title}</h3></div>
            <ol class="buyer-steps">
                ${steps.filter((step) => step.trim()).map((step, index) => `
                    <li class="buyer-step">
                        <span class="step-number">${index + 1}</span>
                        <span class="step-text">${escapeHtml(step)}</span>
                    </li>`).join('')}
            </ol>
        </section>`;
}

function buildPacketPdfDocumentHtml(data: PacketPdfData): PacketPdfHtmlResult {
    const { request, brand, utilities } = data;

    const forceShowPoweredBy = data.meta?.show_powered_by ?? true;
    const showPoweredBy = forceShowPoweredBy || (brand?.show_powered_by ?? false);
    const showGenerationDate = brand?.show_generation_date ?? true;

    const safePrimaryColor = safeHexColor(brand?.primary_color, DEFAULT_BRAND_COLOR);
    const title = escapeHtml(getPacketTitle('simple'));
    const safeBrandLogoUrl = safeExternalUrl(brand?.logo_url);
    const safeBrandName = escapeHtml(clampBrandingText(brand?.name || 'UtilitySheet', BRAND_PROFILE_LIMITS.brandNameMax) || 'UtilitySheet');
    const safeBrandContactName = escapeHtml(clampBrandingText(brand?.contact_name || '', BRAND_PROFILE_LIMITS.contactNameMax));
    const safeBrandContactPhone = escapeHtml(clampBrandingText(brand?.contact_phone || '', BRAND_PROFILE_LIMITS.contactPhoneMax));
    const safeBrandContactEmail = escapeHtml(clampBrandingText(brand?.contact_email || '', BRAND_PROFILE_LIMITS.contactEmailMax));
    const safeBrandContactWebsite = escapeHtml(normalizeWebsiteHostname(brand?.contact_website));
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
    const context: SharedMarkupContext = {
        data,
        safePrimaryColor,
        safeBrandLogoUrl,
        safeBrandName,
        safeBrandContactName,
        safeBrandContactPhone,
        safeBrandContactEmail,
        safeBrandContactWebsite,
        safePropertyAddress,
    };
    const advancedSectionsHtml = data.mode === 'advanced'
        ? buildAdvancedSectionsMarkup(data.advanced_sections || [])
        : '';

    const footerHtml = disclaimerText
        ? `
            <div class="simple-disclaimer keep-together">
                <p>
                    ${disclaimerText}
                </p>
            </div>
        `
        : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #ffffff; }
        .packet-pdf {
            width: 100%;
            color: #18181b;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            line-height: 1.35;
            -webkit-font-smoothing: antialiased;
        }
        .keep-together { page-break-inside: avoid; break-inside: avoid; }
        h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
        .brand-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px;
            border-bottom: 2px solid #e4e4e7;
            margin-bottom: 10px;
        }
        .brand-identity { display: flex; align-items: center; gap: 10px; }
        .brand-logo { height: 36px; width: auto; }
        .brand-mark {
            height: 36px; width: 36px; border-radius: 7px;
            display: flex; align-items: center; justify-content: center;
            color: #ffffff; font-weight: 700; font-size: 13px;
        }
        .brand-name { margin: 0; font-size: 15px; line-height: 1.15; font-weight: 700; }
        .brand-contact-name { margin: 2px 0 0; color: #3f3f46; font-size: 10px; font-weight: 500; }
        .brand-contact-line { margin: 2px 0 0; color: #71717a; font-size: 9px; }
        .brand-contact-right { text-align: right; }
        .title-block { text-align: center; padding: 2px 0 12px; }
        .title-block h1 { margin: 0 0 7px; font-size: 23px; line-height: 1.1; letter-spacing: -0.02em; }
        .address-chip {
            display: inline-block; margin: 0 auto; padding: 6px 13px;
            border: 1px solid #e4e4e7; border-radius: 8px; background: #f4f4f5;
            color: #09090b; font-size: 12px; font-weight: 600;
        }
        .address-pin { color: ${safePrimaryColor}; margin-right: 5px; font-size: 12px; vertical-align: middle; }
        .generation-date { margin-top: 6px; color: #52525b; font-size: 9px; }
        .welcome-message {
            margin-bottom: 10px; padding: 9px 12px;
            border: 1px solid ${hexToRgba(safePrimaryColor, 0.25)};
            border-left: 3px solid ${safePrimaryColor}; border-radius: 7px;
            background: ${hexToRgba(safePrimaryColor, 0.08)};
        }
        .welcome-message p { margin: 0; color: #3f3f46; font-size: 9.5pt; line-height: 1.35; overflow-wrap: anywhere; }
        .home-basics {
            margin-bottom: 10px; overflow: hidden;
            border: 1px solid #e4e4e7; border-radius: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }
        .section-heading { padding: 7px 12px; border-bottom: 1px solid #e4e4e7; background: #f9fafb; }
        .accent-heading { border-left: 3px solid ${safePrimaryColor}; }
        .section-heading h3 { margin: 0; font-size: 12px; line-height: 1.2; font-weight: 700; }
        .home-basics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 8px 12px 9px; }
        .home-basic-label { margin: 0 0 2px; color: #71717a; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .home-basic-value { margin: 0; color: #09090b; font-size: 10.5px; font-weight: 500; text-transform: capitalize; }
        .provider-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 10px; page-break-inside: auto; }
        thead { display: table-header-group; }
        .provider-section-title th {
            padding: 7px 12px; text-align: left; background: #f9fafb;
            border: 1px solid #e4e4e7; border-bottom: 0;
            border-radius: 8px 8px 0 0;
        }
        .provider-section-title h3 { margin: 0; font-size: 12px; line-height: 1.2; font-weight: 700; }
        .provider-columns th {
            padding: 6px 12px; text-align: left; color: #52525b; background: #ffffff;
            border-top: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7;
            font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .provider-columns th:first-child, .provider-row td:first-child { border-left: 1px solid #e4e4e7; }
        .provider-columns th:last-child, .provider-row td:last-child { border-right: 1px solid #e4e4e7; }
        .provider-row { break-inside: avoid; page-break-inside: avoid; }
        .provider-row td { padding: 7px 12px; border-bottom: 1px solid #e4e4e7; vertical-align: middle; }
        .provider-row:last-child td:first-child { border-radius: 0 0 0 8px; }
        .provider-row:last-child td:last-child { border-radius: 0 0 8px 0; }
        .utility-label { display: flex; align-items: center; gap: 7px; }
        .utility-icon { color: #09090b; font-size: 13px; }
        .utility-category { color: #09090b; font-size: 9.5pt; font-weight: 600; text-transform: capitalize; }
        .provider-name { color: #3f3f46; font-size: 9.5pt; font-weight: 500; }
        .provider-contact { color: #52525b; font-size: 8.5pt; }
        .provider-phone { color: ${safePrimaryColor}; font-weight: 600; }
        .contact-divider { margin: 0 6px; color: #d4d4d8; }
        .provider-detail { margin-top: 3px; color: #3f3f46; font-size: 8pt; line-height: 1.25; overflow-wrap: anywhere; }
        .provider-detail strong { color: #52525b; }
        .provider-empty { padding: 14px !important; color: #71717a; text-align: center; }
        .buyer-steps-section {
            margin-bottom: 10px;
            border: 1px solid #e4e4e7; border-radius: 8px; background: #f9fafb;
            overflow: hidden;
        }
        .buyer-steps-section h3 { margin: 0; font-size: 12px; line-height: 1.2; font-weight: 700; }
        .buyer-steps { margin: 0; padding: 10px 12px; list-style: none; }
        .buyer-step { break-inside: avoid; page-break-inside: avoid; display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; color: #3f3f46; line-height: 1.3; }
        .buyer-step:last-child { margin-bottom: 0; }
        .step-number {
            flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: ${hexToRgba(safePrimaryColor, 0.12)}; color: ${safePrimaryColor};
            font-size: 8px; font-weight: 700;
        }
        .step-text { flex: 1; min-width: 0; font-size: 9pt; overflow-wrap: anywhere; }
        .advanced-section {
            margin-bottom: 10px; overflow: hidden;
            border: 1px solid #e4e4e7; border-radius: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .detail-grid { display: block; }
        .detail-pair { display: grid; grid-template-columns: 1fr 1fr; }
        .detail-row { padding: 8px 12px; border-bottom: 1px solid #e4e4e7; }
        .detail-row + .detail-row { border-left: 1px solid #e4e4e7; }
        .detail-pair:last-child .detail-row { border-bottom: 0; }
        .detail-label { margin-bottom: 2px; color: #71717a; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .detail-value { color: #18181b; font-size: 9.5pt; overflow-wrap: anywhere; }
        .simple-disclaimer { padding-top: 8px; border-top: 1px solid #e4e4e7; text-align: center; }
        .simple-disclaimer p { margin: 0; color: #71717a; font-size: 7.5pt; line-height: 1.3; overflow-wrap: anywhere; }
    </style>
</head>
<body>
    <div id="packet-pdf-root" class="packet-pdf">
        ${buildBrandHeaderMarkup(context)}
        ${buildTitleBlockMarkup(context, title, showGenerationDate)}

        ${welcomeMessage ? `
        <div class="welcome-message keep-together">
            <p>${welcomeMessage}</p>
        </div>
        ` : ''}

        ${buildHomeBasicsMarkup(request)}
        ${buildUtilitiesMarkup(utilities)}
        ${advancedSectionsHtml}
        ${buildBuyerNextStepsMarkup(nextStepsTitle, buyerNextSteps)}

        ${footerHtml}
    </div>
</body>
</html>
    `.trim();

    const filenamePrefix = data.mode === 'advanced' ? 'seller-transition-packet' : 'utility-info-sheet';
    const filename = `${filenamePrefix}-${sanitizeFilenamePart(request.property_address.split(',')[0] || '')}.pdf`;
    const headerTemplate = `
        <div style="width:100%; font-size:8.5px; color:#94a3b8; padding:0 0.55in; box-sizing:border-box; display:flex; justify-content:space-between; font-family:Arial, Helvetica, sans-serif;">
            <span>${safeBrandName}</span>
            <span>${safePropertyAddress}</span>
        </div>
    `;
    const footerTemplate = `
        <div style="width:100%; font-size:8.5px; color:#94a3b8; padding:0 0.55in; box-sizing:border-box; display:flex; justify-content:space-between; font-family:Arial, Helvetica, sans-serif;">
            <span>${showPoweredBy ? 'Powered by utilitysheet.com' : ''}</span>
            <span style="letter-spacing:0.02em;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
    `;

    return {
        html,
        filename,
        rootSelector: '#packet-pdf-root',
        renderStrategy: 'print_pdf',
        headerTemplate,
        footerTemplate,
    };
}

export function buildPacketPdfHtml(data: PacketPdfData): PacketPdfHtmlResult {
    return buildPacketPdfDocumentHtml(data);
}
