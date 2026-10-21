// Only used by the isolated collector harness, never the Next application.
import { useSyncExternalStore } from 'react';
const subscribe = (callback: () => void) => {
    window.addEventListener('popstate', callback);
    return () => window.removeEventListener('popstate', callback);
};
export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);
export const useParams = () => ({});
export const useSearchParams = () => new URLSearchParams(window.location.search);
