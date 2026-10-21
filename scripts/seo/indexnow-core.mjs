// IndexNow tells Bing (and the other engines that share its feed) which URLs
// changed. Google does not use it. The key is public by design: it must be
// served at the key location below, from public/<key>.txt.
export const INDEXNOW_KEY = '9f6d1812ab874936961e80b77e565cdd';
export const SITE_ORIGIN = 'https://www.utilitysheet.com';
export const SITE_HOST = new URL(SITE_ORIGIN).host;
export const KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// IndexNow accepts at most 10,000 URLs per request.
const MAX_URLS = 10_000;

export function parseSitemap(xml) {
    const entries = [];
    for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
        const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
        if (!loc) continue;
        const lastModified = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ?? null;
        entries.push({ url: loc, lastModified });
    }
    return entries;
}

export function assertDateArg(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new Error(`--since must be a date like 2026-10-21, got "${value}"`);
    }
    return value;
}

// Keeps entries changed on or after `since` (YYYY-MM-DD). Entries without a
// lastmod are kept, since we can't tell they are unchanged.
export function selectChangedUrls(entries, since) {
    if (!since) return entries.map((entry) => entry.url);
    return entries
        .filter((entry) => !entry.lastModified || entry.lastModified.slice(0, 10) >= since)
        .map((entry) => entry.url);
}

// Accepts "/pricing", "pricing", or a full URL on our host.
export function normalizeSiteUrl(input) {
    const url = new URL(input, `${SITE_ORIGIN}/`);
    if (url.host !== SITE_HOST) {
        throw new Error(`${input} is not on ${SITE_HOST}; IndexNow only accepts our own URLs`);
    }
    url.hash = '';
    return url.toString();
}

export function buildIndexNowPayload(urls) {
    const urlList = [...new Set(urls.map(normalizeSiteUrl))];
    if (urlList.length === 0) {
        throw new Error('No URLs to submit');
    }
    if (urlList.length > MAX_URLS) {
        throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per request, got ${urlList.length}`);
    }
    return {
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
    };
}

export function describeIndexNowResponse(status) {
    switch (status) {
        case 200:
            return 'Accepted.';
        case 202:
            return 'Received; IndexNow is still validating the key. Nothing else to do.';
        case 400:
            return 'Rejected: the request was malformed.';
        case 403:
            return `Rejected: the key was not found at ${KEY_LOCATION}. Deploy first, then retry.`;
        case 422:
            return `Rejected: a URL is not on ${SITE_HOST}, or the key does not match.`;
        case 429:
            return 'Rejected: too many requests. Try again later and submit fewer, changed URLs.';
        default:
            return `Unexpected response (HTTP ${status}).`;
    }
}
