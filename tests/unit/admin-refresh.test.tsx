import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRefresh } from '@/components/admin/AdminRefresh';

const navigation = vi.hoisted(() => ({ pathname: '/admin', query: '', refresh: vi.fn() }));
const router = { refresh: navigation.refresh };
vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useSearchParams: () => new URLSearchParams(navigation.query),
    useRouter: () => router,
}));

function tick(milliseconds: number) {
    act(() => vi.advanceTimersByTime(milliseconds));
}

describe('AdminRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        navigation.pathname = '/admin';
        navigation.query = '';
        navigation.refresh.mockReset();
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it.each(['/admin', '/admin/operations', '/admin/requests', '/admin/abandonment'])(
        'refreshes %s every 30s without navigation', (path) => {
            navigation.pathname = path;
            render(<AdminRefresh />);
            tick(29_999);
            expect(navigation.refresh).not.toHaveBeenCalled();
            tick(1);
            expect(navigation.refresh).toHaveBeenCalledTimes(1);
            expect(screen.getByRole('status')).toHaveTextContent('Updated at');
            tick(30_000);
            expect(navigation.refresh).toHaveBeenCalledTimes(2);
        },
    );

    it('uses 60 seconds for feedback', () => {
        navigation.pathname = '/admin/feedback';
        render(<AdminRefresh />);
        tick(30_000);
        expect(navigation.refresh).not.toHaveBeenCalled();
        tick(30_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('skips hidden/offline polling and deduplicates return events', () => {
        render(<AdminRefresh />);
        Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
        tick(60_000);
        expect(navigation.refresh).not.toHaveBeenCalled();
        Object.defineProperty(document, 'visibilityState', { value: 'visible' });
        fireEvent(document, new Event('visibilitychange'));
        fireEvent(window, new Event('focus'));
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
        Object.defineProperty(navigator, 'onLine', { value: false });
        tick(60_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
        Object.defineProperty(navigator, 'onLine', { value: true });
        fireEvent(window, new Event('online'));
        expect(navigation.refresh).toHaveBeenCalledTimes(2);
    });

    it.each(['/admin/users', '/admin/organizations', '/admin/growth', '/admin/telemetry', '/admin/audit-logs'])(
        'refreshes %s on focus only', (path) => {
            navigation.pathname = path;
            render(<AdminRefresh />);
            tick(120_000);
            expect(navigation.refresh).not.toHaveBeenCalled();
            fireEvent(window, new Event('focus'));
            expect(navigation.refresh).toHaveBeenCalledTimes(1);
        },
    );

    it.each(['/admin/maintenance', '/admin/question-requests', '/admin/testimonial-candidates', '/admin/updates', '/admin/users/example', '/admin/requests/example'])(
        'keeps %s manual', (path) => {
            navigation.pathname = path;
            render(<AdminRefresh />);
            tick(120_000);
            fireEvent(window, new Event('focus'));
            expect(navigation.refresh).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
            expect(navigation.refresh).toHaveBeenCalledTimes(1);
        },
    );

    it.each(['dialog', 'alertdialog', 'inline'])('protects an open %s even from manual refresh', (kind) => {
        const blocker = kind === 'inline'
            ? <div data-admin-refresh-blocked="true" />
            : <div role={kind} />;
        const view = render(<><AdminRefresh />{blocker}</>);
        tick(30_000);
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(navigation.refresh).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent('Paused while editing');
        view.rerender(<><AdminRefresh /></>);
        tick(30_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('preserves unapplied GET filters after blur, and resumes when restored', () => {
        render(<main><AdminRefresh /><form><input aria-label="Search" defaultValue="" /></form></main>);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'unsaved query' } });
        tick(30_000);
        expect(navigation.refresh).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: '' } });
        tick(30_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('pauses while a filter has focus', () => {
        render(<main><AdminRefresh /><input aria-label="Search" /></main>);
        screen.getByRole('textbox').focus();
        tick(30_000);
        expect(navigation.refresh).not.toHaveBeenCalled();
        screen.getByRole('textbox').blur();
        tick(30_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('cleans up polling on route changes and unmount, resetting query status', () => {
        const view = render(<AdminRefresh />);
        tick(30_000);
        navigation.query = 'page=2';
        view.rerender(<AdminRefresh />);
        expect(screen.getByRole('status')).toHaveTextContent('Loaded with page');
        navigation.pathname = '/admin/updates';
        view.rerender(<AdminRefresh />);
        tick(60_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
        view.unmount();
        fireEvent(window, new Event('focus'));
        tick(60_000);
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
    });

    it('does not claim success when refresh throws', () => {
        navigation.refresh.mockImplementationOnce(() => { throw new Error('Unavailable'); });
        render(<AdminRefresh />);
        tick(30_000);
        expect(screen.getByRole('status')).toHaveTextContent('Refresh failed');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(screen.getByRole('status')).toHaveTextContent('Updated at');
    });

    it('does not overlap refreshes or mark an unfinished transition updated', async () => {
        let complete!: () => void;
        let ready = false;
        const pending = new Promise<void>((resolve) => { complete = () => { ready = true; resolve(); }; });
        function ServerResult({ loading }: { loading: boolean }) {
            if (loading && !ready) throw pending;
            return <div>Server result</div>;
        }
        function Harness() {
            const [loading, setLoading] = React.useState(false);
            navigation.refresh.mockImplementation(() => setLoading(true));
            return <React.Suspense fallback={<div>Loading</div>}><AdminRefresh /><ServerResult loading={loading} /></React.Suspense>;
        }
        render(<Harness />);
        tick(30_000);
        expect(screen.getByRole('status')).toHaveTextContent('Refreshing');
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
        tick(60_000);
        fireEvent(window, new Event('focus'));
        expect(navigation.refresh).toHaveBeenCalledTimes(1);
        await act(async () => { complete(); await pending; });
        expect(screen.getByRole('status')).toHaveTextContent('Updated at');
    });
});
