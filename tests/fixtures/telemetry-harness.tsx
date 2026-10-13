import React from 'react';
import { createRoot } from 'react-dom/client';
import { TelemetryCollectors } from '@/components/providers/telemetry-collectors';
import { trackEvent } from '@/lib/analytics/events';
import { captureFirstTouchAttribution, persistPendingGrowthAttribution } from '@/lib/growth/attribution';

captureFirstTouchAttribution(new URL(window.location.href));
createRoot(document.getElementById('root')!).render(<>
    <TelemetryCollectors />
    <button onClick={() => {
        trackEvent('seller_step_viewed', { step: 'basics', packet_mode: 'simple' });
        void persistPendingGrowthAttribution();
    }}>Emit synthetic event</button>
</>);
