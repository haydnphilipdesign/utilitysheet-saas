import type { BrandProfileFormData, PacketMode } from '@/types';
import type { PacketPdfData } from '@/lib/pdf/packet-html';
import { DEFAULT_BRAND_COLOR } from '@/lib/branding/deliverable';
import {
    ADVANCED_MODULE_FIELD_METADATA,
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_LABELS,
} from '@/lib/packet/modules';

/**
 * Shared sample packet data for the Branding Profile live preview and the
 * "Download test PDF" action.
 *
 * Both surfaces must show exactly what the production renderer would produce
 * for this plan, so this module mirrors the Free-plan output rules enforced by
 * lib/packet/packet-data.ts (forced powered-by/date, default buyer steps, no
 * welcome message, Simple mode only). Keeping the fixture and the gating in
 * one place lets the client preview, the server test PDF, and the parity
 * tests all consume the same data.
 */

export const BRANDING_PREVIEW_ADDRESS = '112 Morris Place, Springfield, IL 62701';

export const BRANDING_PREVIEW_UTILITIES: PacketPdfData['utilities'] = [
    { category: 'electric', provider_name: 'Springfield Electric', provider_phone: '(800) 555-0100', provider_website: 'https://springfieldelectric.com', meter_number: 'E-448210' },
    { category: 'gas', provider_name: 'County Gas Co.', provider_phone: '(800) 555-0101' },
    { category: 'water', provider_name: 'Springfield Water', provider_phone: '(800) 555-0102' },
    {
        category: 'trash',
        provider_name: 'Waste Services',
        provider_phone: '(800) 555-0103',
        trash_details: {
            has_recycling: 'yes',
            trash_pickup_days: ['tue'],
            recycling_pickup_day: 'tue',
        },
    },
    { category: 'internet', provider_name: 'Xfinity', provider_phone: '(800) 555-0104', provider_website: 'https://xfinity.com' },
];

export const BRANDING_PREVIEW_HOME_BASICS = {
    water_source: 'city',
    sewer_type: 'public',
    heating_type: 'natural_gas',
} as const;

/**
 * Advanced detail sections built from the canonical module metadata examples,
 * in canonical module order, so the preview cannot drift from the labels and
 * ordering the production packet renders.
 */
export function buildBrandingPreviewAdvancedSections(): NonNullable<PacketPdfData['advanced_sections']> {
    return ADVANCED_MODULE_KEYS
        .map((moduleKey) => ({
            key: moduleKey,
            title: ADVANCED_MODULE_LABELS[moduleKey],
            fields: ADVANCED_MODULE_FIELD_METADATA[moduleKey]
                .filter((field) => field.example)
                .map((field) => ({
                    key: field.key,
                    label: field.label,
                    value: field.example as string,
                })),
        }))
        .filter((section) => section.fields.length > 0);
}

export interface BrandingPreviewOptions {
    /** Requested packet mode. Advanced is honored only for paid plans. */
    mode?: PacketMode;
    /** Whether the account/organization has Pro or Team access. */
    isPro: boolean;
    /** ISO timestamp used for the "Generated on" date. Defaults to now. */
    generatedAt?: string;
}

/**
 * Build the synthetic PacketPdfData the branding preview surfaces feed into
 * the production HTML builder (lib/pdf/packet-html.ts).
 */
export function buildBrandingPreviewPacketData(
    branding: Partial<BrandProfileFormData>,
    options: BrandingPreviewOptions
): PacketPdfData {
    const { isPro } = options;
    const mode: PacketMode = isPro && options.mode === 'advanced' ? 'advanced' : 'simple';
    const generatedAt = options.generatedAt || new Date().toISOString();

    const customSteps = Array.isArray(branding.buyer_next_steps) && branding.buyer_next_steps.length > 0
        ? branding.buyer_next_steps.map((step) => step.trim()).filter(Boolean)
        : null;

    return {
        mode,
        request: {
            id: 'branding-preview',
            property_address: BRANDING_PREVIEW_ADDRESS,
            created_at: generatedAt,
            ...BRANDING_PREVIEW_HOME_BASICS,
        },
        brand: {
            name: branding.name?.trim() || 'Your Brand',
            logo_url: branding.logo_url || null,
            primary_color: branding.primary_color || DEFAULT_BRAND_COLOR,
            contact_name: branding.contact_name || null,
            contact_email: branding.contact_email || null,
            contact_phone: branding.contact_phone || null,
            contact_website: branding.contact_website || null,
            disclaimer_text: branding.disclaimer_text || null,
            // Structured identity fields pass through on every plan.
            company_name: branding.company_name || null,
            professional_title: branding.professional_title || null,
            license_number: branding.license_number || null,
            license_state: branding.license_state || null,
            compliance_line: branding.compliance_line || null,
            // Free plans always get product defaults and forced display options,
            // matching the server-side gating in lib/packet/packet-data.ts.
            buyer_next_steps: isPro ? customSteps : null,
            next_steps_title: isPro ? (branding.next_steps_title || null) : null,
            show_powered_by: isPro ? (branding.show_powered_by ?? true) : true,
            show_generation_date: isPro ? (branding.show_generation_date ?? true) : true,
            welcome_message: isPro ? (branding.welcome_message || null) : null,
        },
        utilities: BRANDING_PREVIEW_UTILITIES,
        advanced_sections: mode === 'advanced' ? buildBrandingPreviewAdvancedSections() : [],
        meta: {
            show_powered_by: !isPro,
        },
    };
}
