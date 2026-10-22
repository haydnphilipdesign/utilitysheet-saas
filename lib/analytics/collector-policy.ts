import type { BeforeSend } from '@vercel/analytics';
import type { BeforeSendMiddleware } from '@vercel/speed-insights';
import { parseGrowthAttribution } from '@/lib/growth/attribution';
import { isPublicTelemetryPath, telemetryPath, telemetryUrl } from './route-policy';

// Re-append only allow-listed UTM values, and only to public page views, so
// campaign links can be compared without retaining arbitrary query text.
function campaignQuery(raw: string, safeUrl: string): string {
    if (!isPublicTelemetryPath(new URL(safeUrl).pathname)) return '';
    const attribution = parseGrowthAttribution(new URL(raw));
    if (!attribution) return '';
    const params = new URLSearchParams();
    if (attribution.source) params.set('utm_source', attribution.source);
    if (attribution.medium) params.set('utm_medium', attribution.medium);
    if (attribution.campaign) params.set('utm_campaign', attribution.campaign);
    if (attribution.content) params.set('utm_content', attribution.content);
    const query = params.toString();
    return query ? `?${query}` : '';
}

// Reconstruct only the installed SDK's documented hook fields. Do not spread
// unknown fields such as referrers, arbitrary route params or future metadata.
export const beforeAnalyticsSend: BeforeSend = (event) => {
    const url = telemetryUrl(event.url);
    if (!url || !['pageview', 'event'].includes(event.type)) return null;
    return { type: event.type, url: event.type === 'pageview' ? url + campaignQuery(event.url, url) : url };
};

export const beforeSpeedInsightsSend: BeforeSendMiddleware = (event) => {
    const url = telemetryUrl(event.url);
    if (!url || event.type !== 'vital') return null;
    return { type: event.type, url, route: telemetryPath(new URL(url).pathname) };
};
