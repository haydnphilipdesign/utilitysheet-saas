'use client';

import { Analytics } from '@vercel/analytics/react';
import { usePathname } from 'next/navigation';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { beforeAnalyticsSend, beforeSpeedInsightsSend } from '@/lib/analytics/collector-policy';
import { telemetryPath } from '@/lib/analytics/route-policy';

export function TelemetryCollectors() {
    const pathname = usePathname();
    // Route metadata travels separately from beforeSend's URL. Supply only
    // finite safe labels, including when the router is not ready yet.
    const route = pathname ? telemetryPath(pathname) : null;
    return <>
        <Analytics key={pathname} route={route} path={route} beforeSend={beforeAnalyticsSend} debug={false} />
        <SpeedInsights beforeSend={beforeSpeedInsightsSend} debug={false} />
    </>;
}
