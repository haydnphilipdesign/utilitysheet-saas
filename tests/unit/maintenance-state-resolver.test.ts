// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('@/lib/neon/queries/maintenance', () => ({ readMaintenanceState: read }));

import { MAINTENANCE_STATE_TTL_MS, forgetMaintenanceStateCache, resolveMaintenanceStatus } from '@/lib/maintenance/state';

const NOW = Date.parse('2026-10-20T01:00:00Z');
const stored = (enabled: boolean, expectedBackAt: string | null = null) => ({ enabled, expectedBackAt, enabledAt: enabled ? '2026-10-20T00:50:00.000Z' : null, updatedAt: null, version: 1 });

beforeEach(() => {
    vi.unstubAllEnvs();
    forgetMaintenanceStateCache();
    read.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('resolving maintenance from the hosting setting and the Admin switch', () => {
    it('lets the hosting setting win without reading the database', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        read.mockResolvedValue(stored(false));
        expect(await resolveMaintenanceStatus(NOW)).toEqual({ maintenance: true, expectedBackAt: null, source: 'environment' });
        expect(read).not.toHaveBeenCalled();
    });

    it('follows the Admin switch otherwise, showing an estimate only while it is ahead', async () => {
        read.mockResolvedValue(stored(true, '2026-10-20T01:45:00.000Z'));
        expect(await resolveMaintenanceStatus(NOW)).toEqual({ maintenance: true, expectedBackAt: '2026-10-20T01:45:00.000Z', source: 'admin' });

        forgetMaintenanceStateCache();
        read.mockResolvedValue(stored(true, '2026-10-20T00:59:00.000Z'));
        expect(await resolveMaintenanceStatus(NOW)).toEqual({ maintenance: true, expectedBackAt: null, source: 'admin' });

        forgetMaintenanceStateCache();
        read.mockResolvedValue(stored(false));
        expect(await resolveMaintenanceStatus(NOW)).toEqual({ maintenance: false, expectedBackAt: null, source: 'none' });
    });

    it('is off when the switch is not installed', async () => {
        read.mockResolvedValue(null);
        expect(await resolveMaintenanceStatus(NOW)).toEqual({ maintenance: false, expectedBackAt: null, source: 'none' });
    });

    it('reads at most once per cache window and picks up a change after it', async () => {
        read.mockResolvedValue(stored(false));
        await resolveMaintenanceStatus(NOW);
        read.mockResolvedValue(stored(true));
        expect((await resolveMaintenanceStatus(NOW + MAINTENANCE_STATE_TTL_MS - 1)).maintenance).toBe(false);
        expect(read).toHaveBeenCalledTimes(1);
        expect((await resolveMaintenanceStatus(NOW + MAINTENANCE_STATE_TTL_MS)).maintenance).toBe(true);
        expect(read).toHaveBeenCalledTimes(2);
    });

    it('keeps the last known answer when the database cannot be read, and is off when there is none', async () => {
        read.mockRejectedValue(new Error('connection lost'));
        expect((await resolveMaintenanceStatus(NOW)).maintenance).toBe(false);

        forgetMaintenanceStateCache();
        read.mockResolvedValueOnce(stored(true));
        expect((await resolveMaintenanceStatus(NOW)).maintenance).toBe(true);
        read.mockRejectedValue(new Error('connection lost'));
        expect((await resolveMaintenanceStatus(NOW + MAINTENANCE_STATE_TTL_MS)).maintenance).toBe(true);
    });

    it('passes a signal so a slow read is cut off', async () => {
        read.mockResolvedValue(stored(false));
        await resolveMaintenanceStatus(NOW);
        expect(read.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    });
});