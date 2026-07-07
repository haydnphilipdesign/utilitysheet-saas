import { describe, expect, it } from 'vitest';
import { buildBrandingPreviewPacketData } from '@/lib/branding/preview-data';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import { ADVANCED_MODULE_KEYS, ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import type { BrandProfileFormData } from '@/types';

const proBranding: Partial<BrandProfileFormData> = {
    name: 'Acme Realty',
    primary_color: '#2563eb',
    contact_name: 'Jane Smith',
    welcome_message: 'Welcome home!',
    disclaimer_text: 'Details subject to change.',
    buyer_next_steps: ['Call the electric company', 'Confirm water service'],
    next_steps_title: 'Move-In Checklist',
    show_powered_by: false,
    show_generation_date: false,
};

describe('buildBrandingPreviewPacketData plan-gating parity', () => {
    it('mirrors Free-plan output rules from packet-data', () => {
        const data = buildBrandingPreviewPacketData(proBranding, { mode: 'advanced', isPro: false });

        // Advanced is Pro-only; Free always previews the Simple sheet.
        expect(data.mode).toBe('simple');
        expect(data.advanced_sections).toEqual([]);
        // Forced display options.
        expect(data.brand?.show_powered_by).toBe(true);
        expect(data.brand?.show_generation_date).toBe(true);
        expect(data.meta?.show_powered_by).toBe(true);
        // Custom content is ignored in favor of product defaults.
        expect(data.brand?.buyer_next_steps).toBeNull();
        expect(data.brand?.next_steps_title).toBeNull();
        expect(data.brand?.welcome_message).toBeNull();
        // Identity/contact fields pass through on every plan.
        expect(data.brand?.name).toBe('Acme Realty');
        expect(data.brand?.contact_name).toBe('Jane Smith');
        expect(data.brand?.disclaimer_text).toBe('Details subject to change.');
    });

    it('honors Pro customizations and display preferences', () => {
        const data = buildBrandingPreviewPacketData(proBranding, { mode: 'simple', isPro: true });

        expect(data.mode).toBe('simple');
        expect(data.brand?.show_powered_by).toBe(false);
        expect(data.brand?.show_generation_date).toBe(false);
        expect(data.meta?.show_powered_by).toBe(false);
        expect(data.brand?.buyer_next_steps).toEqual(['Call the electric company', 'Confirm water service']);
        expect(data.brand?.next_steps_title).toBe('Move-In Checklist');
        expect(data.brand?.welcome_message).toBe('Welcome home!');
    });

    it('includes Home Basics sample values in both modes', () => {
        const simple = buildBrandingPreviewPacketData(proBranding, { mode: 'simple', isPro: true });
        const advanced = buildBrandingPreviewPacketData(proBranding, { mode: 'advanced', isPro: true });

        for (const data of [simple, advanced]) {
            expect(data.request.water_source).toBeTruthy();
            expect(data.request.sewer_type).toBeTruthy();
            expect(data.request.heating_type).toBeTruthy();
        }
    });

    it('builds advanced sections for every module from canonical metadata', () => {
        const data = buildBrandingPreviewPacketData(proBranding, { mode: 'advanced', isPro: true });

        expect(data.mode).toBe('advanced');
        const sectionKeys = (data.advanced_sections || []).map((section) => section.key);
        expect(sectionKeys).toEqual(ADVANCED_MODULE_KEYS);
        for (const section of data.advanced_sections || []) {
            expect(section.title).toBe(ADVANCED_MODULE_LABELS[section.key as keyof typeof ADVANCED_MODULE_LABELS]);
            expect(section.fields.length).toBeGreaterThan(0);
        }
    });

    it('uses the provided generatedAt timestamp for the Generated on date', () => {
        const generatedAt = '2026-07-06T12:00:00.000Z';
        const data = buildBrandingPreviewPacketData(proBranding, { mode: 'simple', isPro: true, generatedAt });
        expect(data.request.created_at).toBe(generatedAt);
    });

    it('produces data the production HTML builder renders with shared contracts intact', () => {
        const data = buildBrandingPreviewPacketData(proBranding, { mode: 'advanced', isPro: true });
        const render = buildPacketPdfHtml(data);

        expect(render.renderStrategy).toBe('print_pdf');
        expect(render.html).toContain('Utility Info Sheet');
        expect(render.html).toContain('Home Basics');
        expect(render.html).toContain('Utility Providers');
        expect(render.html).toContain('Move-In Checklist');
        // Canonical metadata-driven labels, not generated key title-casing.
        expect(render.html).toContain('Plumber');
        expect(render.html).not.toContain('Plumber Provider Name');
        expect(render.filename.startsWith('seller-transition-packet-')).toBe(true);
    });
});
