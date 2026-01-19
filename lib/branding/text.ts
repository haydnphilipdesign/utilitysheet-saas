export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function truncateWithEllipsis(value: string, maxChars: number): string {
    if (!Number.isFinite(maxChars) || maxChars <= 0) return '';
    if (value.length <= maxChars) return value;
    if (maxChars === 1) return '…';
    return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

export function clampBrandingText(value: string | null | undefined, maxChars: number): string {
    if (!value) return '';
    return truncateWithEllipsis(normalizeWhitespace(String(value)), maxChars);
}

