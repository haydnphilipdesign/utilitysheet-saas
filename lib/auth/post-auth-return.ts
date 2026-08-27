const POST_AUTH_RETURN_KEY = 'utilitysheet:post-auth-return-to';

export function normalizePostAuthReturnTo(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;

    try {
        const parsed = new URL(trimmed, 'https://utilitysheet.invalid');
        if (parsed.origin !== 'https://utilitysheet.invalid') return null;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return null;
    }
}

export function rememberPostAuthReturnTo(value: unknown, storage?: Storage): string | null {
    const destination = normalizePostAuthReturnTo(value);
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
    if (!targetStorage) return destination;

    if (destination) {
        targetStorage.setItem(POST_AUTH_RETURN_KEY, destination);
    } else {
        targetStorage.removeItem(POST_AUTH_RETURN_KEY);
    }
    return destination;
}

export function consumePostAuthReturnTo(storage?: Storage): string | null {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
    if (!targetStorage) return null;

    const stored = targetStorage.getItem(POST_AUTH_RETURN_KEY);
    targetStorage.removeItem(POST_AUTH_RETURN_KEY);
    return normalizePostAuthReturnTo(stored);
}
