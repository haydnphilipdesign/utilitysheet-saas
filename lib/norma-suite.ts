export type SuiteProductId = 'norma-intake' | 'utilitysheet' | 'normatc';

function normalizeAbsoluteUrl(rawUrl: string | undefined, fallback: string) {
    const value = rawUrl?.trim();
    if (!value) return fallback;
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value.replace(/\/$/, '');
    }
    return `https://${value.replace(/\/$/, '')}`;
}

const normaSiteUrl = normalizeAbsoluteUrl(
    process.env.NEXT_PUBLIC_NORMA_SITE_URL,
    'https://normatc.com'
);

const utilitySheetUrl = normalizeAbsoluteUrl(
    process.env.NEXT_PUBLIC_UTILITYSHEET_URL,
    'https://utilitysheet.com'
);

const intakeFallback = `${normaSiteUrl}/products#norma-intake`;
const intakeUrl = normalizeAbsoluteUrl(
    process.env.NEXT_PUBLIC_NORMA_INTAKE_URL,
    intakeFallback
);

export const suiteLinks = {
    productsHub: `${normaSiteUrl}/products`,
    intake: intakeUrl,
    utilitysheet: utilitySheetUrl,
    normatc: `${normaSiteUrl}/waitlist`,
} as const;

export function buildSuiteUrl(baseUrl: string, source: string) {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('utm_source', 'norma_suite');
        url.searchParams.set('utm_medium', 'cross_link');
        url.searchParams.set('utm_campaign', source);
        return url.toString();
    } catch {
        return baseUrl;
    }
}
