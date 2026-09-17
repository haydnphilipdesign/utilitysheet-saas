import 'server-only';

import { StackClientApp } from '@stackframe/stack';
import { stackServerApp } from '@/lib/stack/server';

// The client session endpoint handles the paginated response and identifies
// the current session. Server-user session listings do neither in this SDK.
// Each lookup supplies its own tokens instead of using a shared token store.
export const stackSessionClientApp = new StackClientApp({
    inheritsFrom: stackServerApp,
    tokenStore: null,
    noAutomaticPrefetch: true,
});
