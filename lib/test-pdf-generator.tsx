'use client';

import type { BrandProfileFormData } from '@/types';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import { downloadScreenshotPdfFromHtml } from '@/lib/pdf/client-screenshot-pdf';

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
    const render = buildPacketPdfHtml({
        request: {
            id: 'test-preview',
            property_address: SAMPLE_ADDRESS,
            created_at: new Date().toISOString(),
        },
        brand: {
            name: branding.name || 'Your Brand',
            logo_url: branding.logo_url || null,
            primary_color: branding.primary_color || '#10b981',
            contact_name: branding.contact_name || null,
            contact_email: branding.contact_email || null,
            contact_phone: branding.contact_phone || null,
            contact_website: branding.contact_website || null,
            disclaimer_text: branding.disclaimer_text || null,
            buyer_next_steps: branding.buyer_next_steps || null,
            next_steps_title: branding.next_steps_title || null,
            show_powered_by: branding.show_powered_by ?? true,
            show_generation_date: branding.show_generation_date ?? true,
            welcome_message: branding.welcome_message || null,
        },
        utilities: SAMPLE_UTILITIES,
        meta: {
            show_powered_by: branding.show_powered_by ?? true,
        },
    });

    await downloadScreenshotPdfFromHtml({
        html: render.html,
        rootSelector: render.rootSelector,
        filename: 'test-utility-sheet.pdf',
    });
}
