import { telemetryPath } from '@/lib/analytics/route-policy';

export const GROWTH_ATTRIBUTION_STORAGE_KEY = 'utilitysheet:growth-attribution:first-touch';

export type GrowthAttribution = {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    referralCode: string | null;
    landingPath: string;
};

// Values, not just parameter names, are allowlisted. Extend deliberately when
// adding a campaign; arbitrary text (even slug-shaped text) can contain PII.
const CAMPAIGN_VALUES = {
    source: ['facebook', 'partner', 'tc collective', 'handoff-kit', 'utilitysheet_packet', 'utilitysheet_email', 'norma_suite'],
    medium: ['facebook', 'social', 'resource', 'product_referral', 'cross_link'],
    campaign: ['handoff-kit', '90-day-tc-growth', 'transaction_exposure'],
    content: ['case-study', 'kit-cta', 'completion-email', 'from-a-closing'],
} as const;

function campaignValue(field: keyof typeof CAMPAIGN_VALUES, value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return (CAMPAIGN_VALUES[field] as readonly string[]).includes(normalized) ? normalized : null;
}

export function normalizeGrowthAttribution(input: unknown): GrowthAttribution | null {
    if (!input || typeof input !== 'object') return null;
    const data = input as Record<string, unknown>;
    const referral = typeof data.referralCode === 'string' ? data.referralCode.trim().toLowerCase() : '';
    const normalized: GrowthAttribution = {
        source: campaignValue('source', data.source),
        medium: campaignValue('medium', data.medium),
        campaign: campaignValue('campaign', data.campaign),
        content: campaignValue('content', data.content),
        // Public product referral slug is intentional attribution, never a URL.
        referralCode: /^[a-z0-9-]{1,60}$/.test(referral) ? referral : null,
        landingPath: typeof data.landingPath === 'string' ? telemetryPath(data.landingPath) : '/other',
    };
    return normalized.source || normalized.medium || normalized.campaign || normalized.content || normalized.referralCode
        ? normalized : null;
}

export function parseGrowthAttribution(url: URL): GrowthAttribution | null {
    return normalizeGrowthAttribution({
        source: url.searchParams.get('utm_source'),
        medium: url.searchParams.get('utm_medium'),
        campaign: url.searchParams.get('utm_campaign'),
        content: url.searchParams.get('utm_content'),
        referralCode: url.searchParams.get('ref'),
        landingPath: url.pathname,
    });
}

export function readPendingGrowthAttribution(): GrowthAttribution | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
        if (!raw) return null;
        const normalized = normalizeGrowthAttribution(JSON.parse(raw));
        // Also migrate previously stored first-touch data before posting it.
        if (normalized) {
            window.localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, JSON.stringify(normalized));
        } else {
            window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
        }
        return normalized;
    } catch {
        try { window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY); } catch { /* unavailable storage */ }
        return null;
    }
}

export function captureFirstTouchAttribution(url: URL) {
    if (typeof window === 'undefined' || readPendingGrowthAttribution()) return;
    const parsed = parseGrowthAttribution(url);
    if (parsed) {
        try { window.localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed)); } catch { /* optional attribution */ }
    }
}

export async function persistPendingGrowthAttribution() {
    const pending = readPendingGrowthAttribution();
    if (!pending) return;

    const response = await fetch('/api/growth/attribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
    });

    if (response.ok) {
        try { window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY); } catch { /* optional attribution */ }
    }
}
