// Keep this finite: unknown paths can contain addresses, IDs or capabilities.
const PUBLIC_PATHS = new Set([
    '/', '/pricing', '/features', '/how-it-works', '/faq', '/about',
    '/privacy', '/terms', '/cookie-policy', '/demo', '/onboarding', '/account-closed',
    '/auth/signup', '/auth/login', '/from-a-closing', '/tc-utility-handoff-kit',
    '/real-estate-closing-utility-checklist', '/seller-utility-information-form',
    '/utility-sheet-for-transaction-coordinators', '/utility-sheet-for-real-estate-agents',
]);

export function telemetryPath(raw: string): string {
    try {
        if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/other';
        // Decode before classification; repeated/ambiguous encodings become /other.
        const path = decodeURIComponent(raw.split(/[?#]/, 1)[0]).replace(/\/+$/, '') || '/';
        if (path.includes('%') || path.includes('\\') || path.startsWith('//')) return '/other';
        if (PUBLIC_PATHS.has(path)) return path;
        const family = path.split('/')[1];
        switch (family) {
            case 's': return '/s/[token]';
            case 'packet': return '/packet/[token]';
            case 'i': return '/i/[slug]';
            case 'form': return '/form/[slug]';
            case 'invite': return '/invite/[token]';
            case 'auth': return '/auth';
            case 'handler': return '/handler';
            case 'admin': return '/admin';
            case 'dashboard': return '/dashboard';
            default: return '/other';
        }
    } catch {
        return '/other';
    }
}

export function telemetryUrl(raw: string): string | null {
    try {
        const url = new URL(raw);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
        // Do not retain arbitrary origins (including preview/deployment identifiers).
        if (!['utilitysheet.com', 'www.utilitysheet.com', 'localhost', '127.0.0.1'].includes(url.hostname)) return null;
        return `${url.origin}${telemetryPath(url.pathname)}`;
    } catch {
        return null;
    }
}
