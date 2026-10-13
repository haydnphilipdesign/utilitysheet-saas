'use client';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { beforeAnalyticsSend, beforeSpeedInsightsSend } from '@/lib/analytics/collector-policy';

export function TelemetryCollectors() {
    return <>
        <Analytics beforeSend={beforeAnalyticsSend} debug={false} />
        <SpeedInsights beforeSend={beforeSpeedInsightsSend} debug={false} />
    </>;
}
