export const GROWTH_ATTRIBUTION_STORAGE_KEY = 'utilitysheet:growth-attribution:first-touch';

export type GrowthAttribution = {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    referralCode: string | null;
    landingPath: string;
};

function normalize(value: string | null, maxLength = 100) {
    const cleaned = value
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9._ -]/g, '')
        .slice(0, maxLength);
    return cleaned || null;
}

function normalizeReferralCode(value: string | null) {
    const cleaned = value
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 60);
    return cleaned || null;
}

export function parseGrowthAttribution(url: URL): GrowthAttribution | null {
    const source = normalize(url.searchParams.get('utm_source'));
    const medium = normalize(url.searchParams.get('utm_medium'));
    const campaign = normalize(url.searchParams.get('utm_campaign'));
    const content = normalize(url.searchParams.get('utm_content'));
    const referralCode = normalizeReferralCode(url.searchParams.get('ref'));

    if (!source && !medium && !campaign && !content && !referralCode) {
        return null;
    }

    return {
        source,
        medium,
        campaign,
        content,
        referralCode,
        landingPath: url.pathname.slice(0, 200) || '/',
    };
}

export function readPendingGrowthAttribution(): GrowthAttribution | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as GrowthAttribution;
    } catch {
        window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
        return null;
    }
}

export function captureFirstTouchAttribution(url: URL) {
    if (typeof window === 'undefined' || readPendingGrowthAttribution()) return;
    const parsed = parseGrowthAttribution(url);
    if (parsed) {
        window.localStorage.setItem(GROWTH_ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));
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
        window.localStorage.removeItem(GROWTH_ATTRIBUTION_STORAGE_KEY);
    }
}
