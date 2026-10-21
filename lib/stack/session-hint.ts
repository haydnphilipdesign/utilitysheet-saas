'use client';

import { useSyncExternalStore } from 'react';

// Marketing pages don't load Stack Auth (it is most of their JavaScript), so
// the header guesses signed-in state from Stack's refresh-token cookie, which
// its nextjs-cookie token store keeps readable from the browser. The names are
// `stack-refresh`, `stack-refresh-<projectId>`, and the structured
// `[__Host-]stack-refresh-<projectId>--default|--custom-…` variants.
//
// This is only a hint for which header link to show. It never authorizes
// anything: a stale cookie just sends the visitor to /dashboard, which checks
// the session on the server and redirects to login.
const REFRESH_COOKIE_NAME = /^(?:__Host-)?stack-refresh(?:-|$)/;

export function hasStackSessionCookie(cookieHeader: string): boolean {
    return cookieHeader.split(';').some((pair) => {
        const separator = pair.indexOf('=');
        if (separator === -1) return false;
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        return value !== '' && REFRESH_COOKIE_NAME.test(name);
    });
}

const subscribe = () => () => {};

/** null until hydrated (static HTML always renders the signed-out header). */
export function useStackSessionHint(): boolean | null {
    return useSyncExternalStore(
        subscribe,
        () => hasStackSessionCookie(document.cookie),
        () => null,
    );
}
