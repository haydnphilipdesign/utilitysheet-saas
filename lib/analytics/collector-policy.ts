import type { BeforeSend } from '@vercel/analytics';
import type { BeforeSendMiddleware } from '@vercel/speed-insights';
import { telemetryPath, telemetryUrl } from './route-policy';

// Reconstruct only the installed SDK's documented hook fields. Do not spread
// unknown fields such as referrers, arbitrary route params or future metadata.
export const beforeAnalyticsSend: BeforeSend = (event) => {
    const url = telemetryUrl(event.url);
    if (!url || !['pageview', 'event'].includes(event.type)) return null;
    return { type: event.type, url };
};

export const beforeSpeedInsightsSend: BeforeSendMiddleware = (event) => {
    const url = telemetryUrl(event.url);
    if (!url || event.type !== 'vital') return null;
    return { type: event.type, url, route: telemetryPath(new URL(url).pathname) };
};
