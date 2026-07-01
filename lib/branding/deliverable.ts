import type { PacketMode } from '@/types';

/**
 * Canonical branding + content helpers for the seller deliverable.
 *
 * Every surface that renders the utility info sheet (the live seller wizard,
 * the web packet at /packet/[token], the downloadable PDF, and the in-app
 * live preview) reads its brand color and document title from here so the
 * outputs cannot disagree.
 *
 * The normalized packet *content* (which sections, which fields, plan gating)
 * is produced by lib/packet/packet-data.ts. This module owns the presentation
 * decisions that were previously duplicated per-renderer.
 */

/**
 * Product-level default brand color. Every brand profile is created with this
 * value (see lib/neon/queries/brand-profiles.ts), so it is also the safe
 * fallback when a brand has no usable color.
 */
export const DEFAULT_BRAND_COLOR = '#10b981';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/**
 * Normalize a brand color to a safe 6-or-3 digit hex string. Rejects unusable
 * inputs (empty, oklch()/lab() function values, named colors, malformed hex)
 * and falls back to the product default so the deliverable never renders with
 * an invalid or missing accent.
 */
export function resolveBrandColor(input?: string | null): string {
    if (!input) return DEFAULT_BRAND_COLOR;
    const candidate = input.trim();
    if (HEX_COLOR_PATTERN.test(candidate)) {
        return candidate;
    }
    return DEFAULT_BRAND_COLOR;
}

function expandHex(hex: string): string {
    return hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
}

/** Convert a hex color to an rgba() string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
    const normalized = expandHex(resolveBrandColor(hex));
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex color by a 0..1 ratio (used for CTA hover states). */
export function darkenHex(hex: string, amount: number): string {
    const normalized = expandHex(resolveBrandColor(hex));
    const factor = Math.max(0, Math.min(1, 1 - amount));
    const channel = (start: number) => {
        const value = Math.round(parseInt(normalized.slice(start, start + 2), 16) * factor);
        return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
    };
    return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * Canonical document title for the deliverable. Kept identical across the web
 * packet and both PDF renderers so the same request never shows two names.
 */
export function getPacketTitle(mode?: PacketMode | null): string {
    return mode === 'advanced' ? 'Utility Information Sheet' : 'Utility Info Sheet';
}

/**
 * CSS custom properties that theme the seller wizard from the agent's brand
 * color. Set on a wrapper element; the step components reference the variables
 * via Tailwind arbitrary values (e.g. `bg-[color:var(--brand-accent)]`) so a
 * navy-branded brokerage hands its seller a navy form instead of a green one.
 *
 * Defaults reproduce the previous emerald look for the product-default color,
 * so agents on the default brand see no visual change.
 */
export function buildBrandAccentStyle(primaryColor?: string | null): Record<string, string> {
    const accent = resolveBrandColor(primaryColor);
    return {
        '--brand-accent': accent,
        '--brand-accent-strong': darkenHex(accent, 0.12),
        '--brand-accent-contrast': '#ffffff',
        '--brand-accent-soft': hexToRgba(accent, 0.1),
        '--brand-accent-softer': hexToRgba(accent, 0.15),
        '--brand-accent-border': hexToRgba(accent, 0.5),
    };
}
