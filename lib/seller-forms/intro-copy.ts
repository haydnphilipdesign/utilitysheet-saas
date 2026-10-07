/**
 * Wording on the first screen of a reusable seller link. A form's custom
 * heading or introduction replaces the matching default; the progress note
 * always shows.
 */
export const SELLER_HEADING_MAX = 80;
export const SELLER_INTRO_MAX = 500;
export const SELLER_PROGRESS_NOTE = 'Your progress saves automatically.';

export function defaultSellerHeading(brandName?: string | null) {
    return brandName
        ? `${brandName} needs a few utility details`
        : 'Share your home’s utility details';
}

export function defaultSellerIntro(brandName?: string | null) {
    return brandName
        ? `${brandName} is helping with the sale of your home and sent you this link to collect utility information for the buyer.`
        : 'The team helping with the sale of your home sent you this link to collect utility information for the buyer.';
}

/** What to store for an edited field: nothing when it is empty or still the default. */
export function customSellerText(value: string | null | undefined, fallback: string) {
    const text = (value || '').trim();
    return text && text !== fallback ? text : null;
}

/** Session marker: this seller already read the introduction on the link's first screen. */
export const INTRO_SEEN_STORAGE_KEY = 'us_intro_seen';
