import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    requireAdmin: vi.fn(), assertWrites: vi.fn(), set: vi.fn(), forget: vi.fn(), revalidate: vi.fn(), read: vi.fn(), history: vi.fn(),
    refresh: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, pathname: '/admin',
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => mocks.pathname }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/admin', () => ({
    requireAdmin: mocks.requireAdmin,
    assertAdminWritesEnabled: mocks.assertWrites,
    getRequestContext: async () => ({ ipAddress: '203.0.113.9', userAgent: 'vitest' }),
}));
vi.mock('@/lib/neon/queries/maintenance', () => ({ setMaintenanceStateAtomic: mocks.set, readMaintenanceState: mocks.read, getMaintenanceHistory: mocks.history }));
vi.mock('@/lib/maintenance/state', () => ({ forgetMaintenanceStateCache: mocks.forget }));

import { setMaintenanceAdminAction } from '@/app/(admin)/admin/maintenance/actions';
import AdminMaintenancePage from '@/app/(admin)/admin/maintenance/page';
import { MaintenanceControl } from '@/components/admin/MaintenanceControl';
import { AdminMaintenanceIndicator } from '@/components/maintenance/AdminMaintenanceIndicator';
import { getAuditActionLabel } from '@/lib/admin/audit-log-presentation';

const state = (enabled: boolean, expectedBackAt: string | null = null) => ({ enabled, expectedBackAt, enabledAt: null, updatedAt: null, version: 1 });

beforeEach(() => {
    mocks.pathname = '/admin';
    mocks.requireAdmin.mockResolvedValue({ account: { id: 'admin-1' }, user: {} });
    mocks.assertWrites.mockImplementation(() => undefined);
    mocks.set.mockImplementation(async ({ enabled, expectedBackAt }: { enabled: boolean; expectedBackAt: string | null }) => ({ outcome: 'OK', state: state(enabled, expectedBackAt) }));
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('Admin Maintenance page', () => {
    const page = async () => render(await AdminMaintenancePage());
    beforeEach(() => {
        vi.unstubAllEnvs();
        mocks.read.mockResolvedValue(state(false));
        mocks.history.mockResolvedValue([]);
    });

    it('shows Off with the control to turn it on', async () => {
        await page();
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Off');
        expect(screen.getByText('Everything is running normally.')).toBeInTheDocument();
        expect(screen.getByTestId('maintenance-turn-on')).toBeInTheDocument();
        expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
        expect(mocks.requireAdmin).toHaveBeenCalled();
    });

    it('shows On with its estimate, the way to turn it off, and who changed it', async () => {
        mocks.read.mockResolvedValue({ ...state(true, '2099-01-01T02:45:00.000Z'), enabledAt: '2026-10-13T21:00:00.000Z' });
        mocks.history.mockResolvedValue([{ id: 'h1', action: 'maintenance_enabled', createdAt: '2026-10-13T21:00:00.000Z', adminEmail: 'owner@example.test' }]);
        await page();
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('On');
        expect(screen.getByText(/People are told to expect us back around/)).toBeInTheDocument();
        expect(screen.getByTestId('maintenance-turn-off')).toBeInTheDocument();
        expect(screen.getByText('Turned on')).toBeInTheDocument();
        expect(screen.getByText(/by owner@example\.test/)).toBeInTheDocument();
    });

    it('says when the hosting setting forces it on and the switch cannot end it', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        await page();
        expect(screen.getByTestId('maintenance-status')).toHaveTextContent('On');
        expect(screen.getByTestId('maintenance-forced')).toHaveTextContent('overrides this switch');
        expect(screen.getByText('On because of the hosting setting, not this switch.')).toBeInTheDocument();
    });

    it.each([
        ['not installed', () => mocks.read.mockResolvedValue(null), 'not installed yet'],
        ['unreadable', () => mocks.read.mockRejectedValue(new Error('connection lost')), 'could not be read just now'],
        ['writes disabled', () => vi.stubEnv('ADMIN_WRITES_DISABLED', 'true'), 'Admin writes are disabled'],
    ])('is read-only with an explanation when %s', async (_label, arrange, text) => {
        arrange();
        await page();
        expect(screen.getByTestId('maintenance-control-disabled')).toHaveTextContent(text);
        expect(screen.queryByTestId('maintenance-turn-on')).not.toBeInTheDocument();
    });

    it('refuses to render for someone who is not an admin', async () => {
        mocks.requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Admin access required'), { name: 'AdminAuthorizationError' }));
        await expect(AdminMaintenancePage()).rejects.toThrow('Admin access required');
        expect(mocks.read).not.toHaveBeenCalled();
    });
});

describe('setMaintenanceAdminAction', () => {
    it('turns the pause on with an estimate counted from now, as the signed-in admin', async () => {
        vi.useFakeTimers({ now: Date.parse('2026-10-20T01:00:00Z'), toFake: ['Date'] });
        const result = await setMaintenanceAdminAction({ enabled: true, expectedBackInMinutes: 45, reason: ' Deploying ' });
        expect(result).toEqual({ success: true, unchanged: false, state: state(true, '2026-10-20T01:45:00.000Z') });
        expect(mocks.set).toHaveBeenCalledWith({
            actor: { adminId: 'admin-1', ipAddress: '203.0.113.9', userAgent: 'vitest' },
            reason: 'Deploying', enabled: true, expectedBackAt: '2026-10-20T01:45:00.000Z',
        });
        expect(mocks.forget).toHaveBeenCalledTimes(1);
        expect(mocks.revalidate).toHaveBeenCalledWith('/admin/maintenance');
    });

    it('needs no reason, and sends no estimate when turning off', async () => {
        await setMaintenanceAdminAction({ enabled: false, expectedBackInMinutes: 30 });
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, expectedBackAt: null, reason: null }));
    });

    it('reports a repeat as unchanged', async () => {
        mocks.set.mockResolvedValue({ outcome: 'UNCHANGED', state: state(true) });
        expect(await setMaintenanceAdminAction({ enabled: true })).toMatchObject({ success: true, unchanged: true });
    });

    it.each([
        [{ enabled: true, expectedBackInMinutes: 7 }],
        [{ enabled: true, expectedBackInMinutes: 100000 }],
        [{ enabled: 'yes' }],
        [{ enabled: true, accountId: 'someone-else' }],
    ])('rejects %j without writing', async (input) => {
        const result = await setMaintenanceAdminAction(input as never);
        expect(result).toMatchObject({ success: false, code: 'INVALID_INPUT' });
        expect(mocks.set).not.toHaveBeenCalled();
    });

    it('refuses a signed-in non-admin, disabled writes and a non-admin actor row without changing anything', async () => {
        mocks.requireAdmin.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'AdminAuthorizationError' }));
        expect(await setMaintenanceAdminAction({ enabled: true })).toMatchObject({ success: false, code: 'UNAUTHORIZED' });

        mocks.assertWrites.mockImplementationOnce(() => { throw Object.assign(new Error('off'), { name: 'AdminWriteDisabledError' }); });
        expect(await setMaintenanceAdminAction({ enabled: true })).toMatchObject({ success: false, code: 'WRITES_DISABLED' });
        expect(mocks.set).not.toHaveBeenCalled();

        mocks.set.mockResolvedValueOnce({ outcome: 'ACTOR_NOT_ADMIN' });
        expect(await setMaintenanceAdminAction({ enabled: true })).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
        expect(mocks.forget).not.toHaveBeenCalled();
    });

    it('explains a database without the migration', async () => {
        mocks.set.mockRejectedValueOnce(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
        const result = await setMaintenanceAdminAction({ enabled: true });
        expect(result).toMatchObject({ success: false, code: 'NOT_INSTALLED' });
        expect(result.success === false && result.error).toContain('not installed yet');
    });
});

describe('MaintenanceControl', () => {
    it('asks once before pausing, then turns it on with the chosen estimate', async () => {
        render(<MaintenanceControl enabled={false} disabledReason={null} />);
        fireEvent.change(screen.getByLabelText(/estimated return/i), { target: { value: '30' } });
        fireEvent.click(screen.getByTestId('maintenance-turn-on'));
        expect(mocks.set).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Pause seller forms and PDF downloads?' })).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Turn maintenance on' }).at(-1)!);
        await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Maintenance is on.'));
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, expectedBackAt: expect.any(String) }));
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it('cancelling the confirmation changes nothing', () => {
        render(<MaintenanceControl enabled={false} disabledReason={null} />);
        fireEvent.click(screen.getByTestId('maintenance-turn-on'));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(mocks.set).not.toHaveBeenCalled();
    });

    it('turns off in one click and can update the estimate while on', async () => {
        render(<MaintenanceControl enabled disabledReason={null} />);
        expect(screen.queryByTestId('maintenance-turn-on')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('maintenance-update-estimate'));
        await waitFor(() => expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, expectedBackAt: null })));

        fireEvent.click(screen.getByTestId('maintenance-turn-off'));
        await waitFor(() => expect(mocks.set).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false })));
        await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Maintenance is off. The paused features are available again.'));
    });

    it('shows the server refusal and does not claim success', async () => {
        mocks.set.mockResolvedValueOnce({ outcome: 'ACTOR_NOT_ADMIN' });
        render(<MaintenanceControl enabled disabledReason={null} />);
        fireEvent.click(screen.getByTestId('maintenance-turn-off'));
        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Admin access required'));
        expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it('is read-only with an explanation when it cannot be used', () => {
        render(<MaintenanceControl enabled={false} disabledReason="The maintenance switch is not installed yet." />);
        expect(screen.getByTestId('maintenance-control-disabled')).toHaveTextContent('not installed yet');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

describe('AdminMaintenanceIndicator', () => {
    const answer = (maintenance: boolean) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ maintenance, expectedBackAt: null }))));

    it('shows on Admin pages while the pause is on, with a way to manage it', async () => {
        answer(true);
        render(<AdminMaintenanceIndicator />);
        const indicator = await screen.findByTestId('admin-maintenance-indicator');
        expect(indicator).toHaveAttribute('role', 'status');
        expect(indicator).toHaveTextContent('Maintenance mode is on.');
        expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/admin/maintenance');
    });

    it('stays hidden while off and on the Maintenance page itself', async () => {
        answer(false);
        const { unmount } = render(<AdminMaintenanceIndicator />);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.queryByTestId('admin-maintenance-indicator')).not.toBeInTheDocument();
        unmount();

        answer(true);
        mocks.pathname = '/admin/maintenance';
        render(<AdminMaintenanceIndicator />);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.queryByTestId('admin-maintenance-indicator')).not.toBeInTheDocument();
    });
});

describe('audit log wording', () => {
    it('names the three maintenance actions', () => {
        expect(getAuditActionLabel('maintenance_enabled')).toBe('Maintenance mode turned on');
        expect(getAuditActionLabel('maintenance_updated')).toBe('Maintenance estimate changed');
        expect(getAuditActionLabel('maintenance_disabled')).toBe('Maintenance mode turned off');
    });
});