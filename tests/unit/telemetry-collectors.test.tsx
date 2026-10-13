import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { analytics, speed } = vi.hoisted(() => ({ analytics: vi.fn<(props: unknown) => null>(() => null), speed: vi.fn<(props: unknown) => null>(() => null) }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: analytics }));
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: speed }));
import { TelemetryCollectors } from '@/components/providers/telemetry-collectors';

describe('global collectors', () => {
    it('registers safe hooks with both SDKs', () => {
        render(<TelemetryCollectors />);
        const analyticsHook = analytics.mock.calls[0][0] as unknown as { beforeSend: (data: unknown) => unknown };
        const speedHook = speed.mock.calls[0][0] as unknown as { beforeSend: (data: unknown) => unknown };
        expect(analyticsHook.beforeSend({ type: 'event', url: 'https://utilitysheet.com/s/synthetic-secret?code=secret' })).toEqual({ type: 'event', url: 'https://utilitysheet.com/s/[token]' });
        expect(speedHook.beforeSend({ type: 'vital', url: 'https://utilitysheet.com/s/synthetic-secret', route: '/s/synthetic-secret' })).toEqual({ type: 'vital', url: 'https://utilitysheet.com/s/[token]', route: '/s/[token]' });
    });
});
