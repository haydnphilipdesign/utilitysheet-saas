/**
 * Shared base links: one base per creator/workspace that opens the default
 * form, and a permanent ending for every form.
 * Pure helpers, safe for client and server. See docs/saved-seller-forms.md.
 */

/** Link identity of one creator/workspace, read in a single bounded query. */
export interface SellerFormLinkScope {
    /** The form that owns the base name. Pinned once; renaming the base edits it. */
    rootFormId: string;
    baseSlug: string;
    baseRevision: number;
    /** The form the bare base link opens: the workspace default. */
    defaultFormId: string;
    defaultFormName: string;
    defaultIsActive: boolean;
    /** Current ending per form ID. */
    suffixes: Record<string, string>;
    /** Every ending ever published here, with the form it stays bound to. */
    reserved: Array<{ suffix: string; formId: string }>;
}

export const LINK_SUFFIX_MIN = 3;
export const LINK_SUFFIX_MAX = 60;
const LINK_SUFFIX_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidLinkSuffix(suffix: string) {
    return (
        suffix.length >= LINK_SUFFIX_MIN &&
        suffix.length <= LINK_SUFFIX_MAX &&
        LINK_SUFFIX_PATTERN.test(suffix)
    );
}

export function linkSuffixError(suffix: string) {
    if (isValidLinkSuffix(suffix)) return null;
    if (suffix.length < LINK_SUFFIX_MIN || suffix.length > LINK_SUFFIX_MAX)
        return `Link ending must be between ${LINK_SUFFIX_MIN} and ${LINK_SUFFIX_MAX} characters.`;
    return 'Link ending must be lowercase and contain only letters, numbers, and dashes.';
}

/**
 * A reviewable ending suggested from the internal form name. Always valid,
 * including for short, identical or non-ASCII names, and never one that is
 * already bound to a form in this namespace.
 */
export function suggestLinkSuffix(name: string, taken: Iterable<string>) {
    const used = new Set(taken);
    let stem = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, LINK_SUFFIX_MAX - 4)
        .replace(/-$/, '');
    if (stem.length < LINK_SUFFIX_MIN) stem = 'form';
    if (!used.has(stem)) return stem;
    for (let n = 2; n <= used.size + 2; n += 1) {
        const ending = `-${n}`;
        const candidate = `${stem.slice(0, LINK_SUFFIX_MAX - ending.length).replace(/-$/, '')}${ending}`;
        if (!used.has(candidate)) return candidate;
    }
    throw new Error('Unable to suggest a link ending');
}

/** A form's own permanent path, whether or not it is the default. */
export function sellerFormEndingPath(
    form: { id: string },
    scope: SellerFormLinkScope | null,
) {
    const suffix = scope?.suffixes[form.id];
    return scope && suffix ? `/i/${scope.baseSlug}/${suffix}` : null;
}

/** Canonical public path. The default form is bare; other forms add their ending. */
export function sellerFormLinkPath(
    form: { id: string; slug: string },
    scope: SellerFormLinkScope | null,
) {
    if (!scope) return `/i/${form.slug}`;
    if (form.id === scope.defaultFormId) return `/i/${scope.baseSlug}`;
    // A form without an ending still has its own published flat link.
    return sellerFormEndingPath(form, scope) ?? `/i/${form.slug}`;
}

export function appBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000')
    );
}
