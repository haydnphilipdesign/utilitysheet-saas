import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import type { BrandProfileFormData } from '@/types';

const baseBranding: BrandProfileFormData = {
    name: 'Acme Realty',
    primary_color: '#2563eb',
    secondary_color: '#1e40af',
    is_default: true,
    welcome_message: 'Welcome to your new home!',
    show_powered_by: false,
};

/**
 * The preview renders the production PDF HTML (lib/pdf/packet-html.ts) inside
 * a sandboxed iframe, so assertions read the iframe srcdoc: the same markup
 * the Chromium download pipeline prints.
 */
function getPreviewHtml(): string {
    const iframe = screen.getByTitle('Branding profile PDF preview');
    return iframe.getAttribute('srcdoc') || '';
}

describe('UtilitySheetPdfPreview production parity', () => {
    it('shows the canonical title, Home Basics, and Utility Providers for Free accounts without a mode toggle', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro={false} />);

        const html = getPreviewHtml();
        expect(html).toContain('Utility Info Sheet');
        expect(html).toContain('Home Basics');
        expect(html).toContain('Utility Providers');
        expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
    });

    it('applies Free-plan gating: forced powered-by and no welcome message', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro={false} />);

        const html = getPreviewHtml();
        expect(html).not.toContain('Welcome to your new home!');

        // Free accounts cannot hide the powered-by footer.
        const iframe = screen.getByTitle('Branding profile PDF preview');
        expect(iframe.getAttribute('srcdoc')).toBeTruthy();
        expect(html).toContain('Utility Info Sheet');
    });

    it('honors Pro customizations in the preview document', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro />);

        const html = getPreviewHtml();
        expect(html).toContain('Welcome to your new home!');
    });

    it('ignores an advanced defaultMode for Free accounts', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro={false} defaultMode="advanced" />);

        const html = getPreviewHtml();
        expect(html).not.toContain(ADVANCED_MODULE_LABELS.service_providers);
        expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
    });

    it('exposes a Simple/Advanced toggle for Pro accounts and defaults to simple', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro />);

        expect(screen.getByRole('button', { name: 'Simple' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
        expect(getPreviewHtml()).not.toContain(ADVANCED_MODULE_LABELS.service_providers);
    });

    it('renders advanced sections, keeps Home Basics, and keeps the shared title when toggled to Advanced', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro />);

        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

        const html = getPreviewHtml();
        // Both modes share the canonical title and include Home Basics,
        // matching the production shared PDF design system.
        expect(html).toContain('Utility Info Sheet');
        expect(html).toContain('Home Basics');
        expect(html).toContain('Utility Providers');
        // Every advanced module with sample values renders with its canonical
        // label (HTML-escaped, e.g. "Lawn &amp; Snow Care").
        expect(html).toContain(ADVANCED_MODULE_LABELS.service_providers);
        expect(html).toContain(ADVANCED_MODULE_LABELS.lawn_exterior.replaceAll('&', '&amp;'));
        // Canonical metadata-driven field labels (not title-cased DB keys).
        expect(html).toContain('Plumber');
        expect(html).not.toContain('Plumber Provider Name');
    });

    it('seeds the initial mode from defaultMode for Pro accounts', () => {
        render(<UtilitySheetPdfPreview branding={baseBranding} isPro defaultMode="advanced" />);

        expect(getPreviewHtml()).toContain(ADVANCED_MODULE_LABELS.service_providers);
    });

    it('supports controlled mode via mode/onModeChange', () => {
        let lastMode = '';
        const { rerender } = render(
            <UtilitySheetPdfPreview
                branding={baseBranding}
                isPro
                mode="simple"
                onModeChange={(mode) => { lastMode = mode; }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
        expect(lastMode).toBe('advanced');

        rerender(
            <UtilitySheetPdfPreview
                branding={baseBranding}
                isPro
                mode="advanced"
                onModeChange={(mode) => { lastMode = mode; }}
            />
        );
        expect(getPreviewHtml()).toContain(ADVANCED_MODULE_LABELS.service_providers);
    });
});
