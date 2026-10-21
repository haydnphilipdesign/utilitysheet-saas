import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { analytics, speed } = vi.hoisted(() => ({ analytics: vi.fn<(props: unknown) => null>(() => null), speed: vi.fn<(props: unknown) => null>(() => null) }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: analytics }));
const navigation = vi.hoisted(() => ({ pathname: '/s/synthetic-secret' as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: speed }));
import { TelemetryCollectors } from '@/components/providers/telemetry-collectors';

describe('global collectors', () => {
    it('supplies safe route metadata on initial load and navigation', () => {
        const { rerender } = render(<TelemetryCollectors />);
        expect(analytics.mock.lastCall?.[0]).toMatchObject({ route: '/s/[token]', path: '/s/[token]' });
        navigation.pathname = '/pricing';
        rerender(<TelemetryCollectors />);
        expect(analytics.mock.lastCall?.[0]).toMatchObject({ route: '/pricing', path: '/pricing' });
        navigation.pathname = '/dashboard/requests/private-id';
        rerender(<TelemetryCollectors />);
        expect(analytics.mock.lastCall?.[0]).toMatchObject({ route: '/dashboard', path: '/dashboard' });
        navigation.pathname = null;
        rerender(<TelemetryCollectors />);
        expect(analytics.mock.lastCall?.[0]).toMatchObject({ route: null, path: null });
        navigation.pathname = '/s/synthetic-secret';
    });
    it('registers safe hooks with both SDKs', () => {
        render(<TelemetryCollectors />);
        const analyticsHook = analytics.mock.calls[0][0] as unknown as { beforeSend: (data: unknown) => unknown };
        const speedHook = speed.mock.calls[0][0] as unknown as { beforeSend: (data: unknown) => unknown };
        expect(analyticsHook.beforeSend({ type: 'event', url: 'https://utilitysheet.com/s/synthetic-secret?code=secret' })).toEqual({ type: 'event', url: 'https://utilitysheet.com/s/[token]' });
        expect(speedHook.beforeSend({ type: 'vital', url: 'https://utilitysheet.com/s/synthetic-secret', route: '/s/synthetic-secret' })).toEqual({ type: 'vital', url: 'https://utilitysheet.com/s/[token]', route: '/s/[token]' });
    });
});
