// Only used by the isolated collector harness, never the Next application.
export const usePathname = () => window.location.pathname;
export const useParams = () => ({});
export const useSearchParams = () => new URLSearchParams(window.location.search);
