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
 * Product-level default brand color: the app's slate-blue `--primary`
 * (app/globals.css, light theme). Every brand profile is created with this
 * value (see lib/neon/queries/brand-profiles.ts), so it is also the safe
 * fallback when a brand has no usable color. Emerald is reserved for success
 * states. Profiles created before 2026-10-14 store the old `#10b981` default
 * explicitly and keep it.
 */
export const DEFAULT_BRAND_COLOR = '#23588a';

/**
 * Default secondary color (branded email header gradient and button): the
 * primary darkened the same way onboarding derives one.
 */
export const DEFAULT_BRAND_SECONDARY_COLOR = '#0b4072';

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
    void mode;
    return 'Utility Info Sheet';
}

/** Mix a hex color toward another by a 0..1 ratio. */
function mixHex(hex: string, target: string, amount: number): string {
    const from = expandHex(resolveBrandColor(hex));
    const to = expandHex(resolveBrandColor(target));
    const t = Math.max(0, Math.min(1, amount));
    const channel = (start: number) => {
        const a = parseInt(from.slice(start, start + 2), 16);
        const b = parseInt(to.slice(start, start + 2), 16);
        return Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
    };
    return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function relativeLuminance(hex: string): number {
    const normalized = expandHex(resolveBrandColor(hex));
    const linear = (start: number) => {
        const value = parseInt(normalized.slice(start, start + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

// WCAG AA for normal-size text, with a little headroom for rounding.
const TEXT_CONTRAST = 4.6;
const ON_ACCENT_DARK_TEXT = '#111827';
// Approximations of the seller form's surfaces (app/globals.css), tinted the
// way a selected tile is, so accent text is checked where it actually sits.
const LIGHT_SURFACE = '#f4f4f2';
const DARK_SURFACE = '#202024';

/** Step a color toward `target` until it reaches the contrast goal against `surface`. */
function adjustForContrast(color: string, target: string, surface: string): string {
    for (let step = 0; step <= 50; step += 1) {
        const candidate = mixHex(color, target, step / 50);
        if (contrastRatio(candidate, surface) >= TEXT_CONTRAST) return candidate;
    }
    return target;
}

/**
 * Text-safe variants of a brand color. A brand that already meets WCAG AA is
 * used as is; otherwise it is moved only as far as AA needs.
 * - fill/contrast: a solid fill that carries text (buttons, badges) and its text
 *   color. White text on a darkened fill when a modest darkening is enough;
 *   very light brands (yellows, pastels) keep their fill with dark text.
 * - ink/inkDark: the brand color as text on the light and dark page surfaces.
 */
export function brandAccentTextColors(primaryColor?: string | null) {
    const accent = expandHex(resolveBrandColor(primaryColor));
    let fill = accent;
    let contrast = '#ffffff';
    if (contrastRatio(accent, '#ffffff') < TEXT_CONTRAST) {
        const darkened = adjustForContrast(accent, '#000000', '#ffffff');
        // Share of its lightness the fill had to lose; beyond 60% it no longer reads as the brand.
        const shift = 1 - relativeLuminance(darkened) / relativeLuminance(accent);
        if (shift <= 0.6 || contrastRatio(accent, ON_ACCENT_DARK_TEXT) < TEXT_CONTRAST) {
            fill = darkened;
        } else {
            contrast = ON_ACCENT_DARK_TEXT;
        }
    }
    const tint = (surface: string) => mixHex(surface, accent, 0.15);
    return {
        fill,
        contrast,
        ink: adjustForContrast(accent, '#000000', tint(LIGHT_SURFACE)),
        inkDark: adjustForContrast(accent, '#ffffff', tint(DARK_SURFACE)),
    };
}

/**
 * CSS custom properties that theme the seller wizard from the agent's brand
 * color. Set on a wrapper element; the step components reference the variables
 * via Tailwind arbitrary values so a navy-branded brokerage hands its seller a
 * navy form instead of a green one.
 *
 * `--brand-accent` is the brand color itself, for bars, borders and tints.
 * Anything that carries text uses the contrast-checked variables instead:
 * `--brand-accent-fill` with `--brand-accent-contrast` text for solid buttons,
 * and `--brand-accent-text` (the light or dark ink, chosen by the wrapper's
 * `wizardBrandScope` class) for accent-colored text, icons and focus rings.
 */
export function buildBrandAccentStyle(primaryColor?: string | null): Record<string, string> {
    const accent = resolveBrandColor(primaryColor);
    const text = brandAccentTextColors(accent);
    return {
        '--brand-accent': accent,
        '--brand-accent-fill': text.fill,
        '--brand-accent-strong': darkenHex(text.fill, 0.12),
        '--brand-accent-contrast': text.contrast,
        '--brand-accent-ink': text.ink,
        '--brand-accent-ink-dark': text.inkDark,
        '--brand-accent-soft': hexToRgba(accent, 0.1),
        '--brand-accent-softer': hexToRgba(accent, 0.15),
        '--brand-accent-border': hexToRgba(accent, 0.5),
    };
}
