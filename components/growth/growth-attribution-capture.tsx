'use client';

import { useEffect } from 'react';
import { captureFirstTouchAttribution } from '@/lib/growth/attribution';

export function GrowthAttributionCapture() {
    useEffect(() => {
        captureFirstTouchAttribution(new URL(window.location.href));
    }, []);

    return null;
}
