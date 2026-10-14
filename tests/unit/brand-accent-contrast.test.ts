import { describe, expect, it } from 'vitest';
import { brandAccentTextColors, buildBrandAccentStyle, contrastRatio, DEFAULT_BRAND_COLOR } from '@/lib/branding/deliverable';

// Seller form surfaces (app/globals.css): light page and dark page.
const LIGHT_PAGE = '#f9f9f7';
const DARK_PAGE = '#09090b';
const BRANDS = ['#10b981', '#facc15', '#1e3a8a', '#3b82f6', '#ef4444', '#f97316', '#06b6d4', '#ffffff', '#000000', '#f9a8d4', '#777'];

describe('seller form brand accent contrast', () => {
    it.each(BRANDS)('meets WCAG AA for text on fills and pages: %s', (brand) => {
        const colors = brandAccentTextColors(brand);
        expect(contrastRatio(colors.fill, colors.contrast)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.ink, LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.inkDark, DARK_PAGE)).toBeGreaterThanOrEqual(4.5);
    });

    it('leaves a brand that already passes unchanged', () => {
        const navy = brandAccentTextColors('#1e3a8a');
        expect(navy.fill).toBe('#1e3a8a');
        expect(navy.contrast).toBe('#ffffff');
        expect(navy.ink).toBe('#1e3a8a');
        // Dark mode lightens it so labels stay readable.
        expect(navy.inkDark).not.toBe('#1e3a8a');
    });

    it('deepens the default emerald for white button text and keeps very light brands with dark text', () => {
        const emerald = brandAccentTextColors(DEFAULT_BRAND_COLOR);
        expect(emerald.contrast).toBe('#ffffff');
        expect(emerald.fill).not.toBe(DEFAULT_BRAND_COLOR);
        const yellow = brandAccentTextColors('#facc15');
        expect(yellow.fill).toBe('#facc15');
        expect(yellow.contrast).toBe('#111827');
    });

    it('keeps the raw brand color for decoration and an invalid color falls back to the default', () => {
        const style = buildBrandAccentStyle('#facc15');
        expect(style['--brand-accent']).toBe('#facc15');
        expect(style['--brand-accent-soft']).toBe('rgba(250, 204, 21, 0.1)');
        expect(buildBrandAccentStyle('oklch(0.7 0.1 150)')['--brand-accent']).toBe(DEFAULT_BRAND_COLOR);
        expect(Object.keys(style)).toEqual(expect.arrayContaining([
            '--brand-accent-fill', '--brand-accent-strong', '--brand-accent-contrast', '--brand-accent-ink', '--brand-accent-ink-dark',
        ]));
    });
});
