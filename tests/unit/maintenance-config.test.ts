// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS,
    getMaintenanceStatus,
    isMaintenanceActive,
    maintenanceExpectedBackAt,
    maintenanceRetryAfterSeconds,
} from '@/lib/maintenance/config';

const NOW = Date.parse('2026-10-20T01:00:00Z');

describe('maintenance configuration', () => {
    it.each([undefined, '', '  ', 'off', 'OFF', 'false', '0', 'no', ' Off '])('is off for %j', (value) => {
        expect(isMaintenanceActive({ MAINTENANCE_MODE: value })).toBe(false);
    });

    // A mistyped value during a cutover must pause traffic, not open it.
    it.each(['on', 'ON', 'true', '1', 'yes', 'onn', 'enabled', 'of f'])('is on for %j', (value) => {
        expect(isMaintenanceActive({ MAINTENANCE_MODE: value })).toBe(true);
    });

    it('reports an estimate only when it is a future time with an offset', () => {
        const at = (value: string | undefined) => maintenanceExpectedBackAt(NOW, { MAINTENANCE_EXPECTED_BACK_AT: value });
        expect(at('2026-10-20T01:45:00Z')).toBe('2026-10-20T01:45:00.000Z');
        expect(at('2026-10-19T21:45:00-04:00')).toBe('2026-10-20T01:45:00.000Z');
        expect(at(undefined)).toBeNull();
        expect(at('2026-10-20T00:59:00Z')).toBeNull();
        expect(at('2026-10-20T01:00:00Z')).toBeNull();
        expect(at('2026-10-20T01:45:00')).toBeNull();
        expect(at('9:45 PM')).toBeNull();
        expect(at('2026-13-40T01:45:00Z')).toBeNull();
    });

    it('derives Retry-After from the estimate, else the configured or default wait, within bounds', () => {
        const retry = (env: Record<string, string | undefined>) => maintenanceRetryAfterSeconds(NOW, env);
        expect(retry({})).toBe(DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS);
        expect(retry({ MAINTENANCE_EXPECTED_BACK_AT: '2026-10-20T01:45:00Z' })).toBe(2700);
        expect(retry({ MAINTENANCE_EXPECTED_BACK_AT: '2026-10-20T01:00:10Z' })).toBe(60);
        expect(retry({ MAINTENANCE_EXPECTED_BACK_AT: '2026-10-25T01:00:00Z' })).toBe(86_400);
        expect(retry({ MAINTENANCE_RETRY_AFTER_SECONDS: '900' })).toBe(900);
        expect(retry({ MAINTENANCE_RETRY_AFTER_SECONDS: '5' })).toBe(60);
        expect(retry({ MAINTENANCE_RETRY_AFTER_SECONDS: '999999' })).toBe(86_400);
        expect(retry({ MAINTENANCE_RETRY_AFTER_SECONDS: '-1' })).toBe(DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS);
        expect(retry({ MAINTENANCE_RETRY_AFTER_SECONDS: 'soon' })).toBe(DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS);
        // A past estimate is ignored instead of producing a zero or negative wait.
        expect(retry({ MAINTENANCE_EXPECTED_BACK_AT: '2026-10-20T00:00:00Z', MAINTENANCE_RETRY_AFTER_SECONDS: '600' })).toBe(600);
    });

    it('never reports an estimate while maintenance is off', () => {
        expect(getMaintenanceStatus(NOW, { MAINTENANCE_EXPECTED_BACK_AT: '2026-10-20T01:45:00Z' }))
            .toEqual({ maintenance: false, expectedBackAt: null });
        expect(getMaintenanceStatus(NOW, { MAINTENANCE_MODE: 'on', MAINTENANCE_EXPECTED_BACK_AT: '2026-10-20T01:45:00Z' }))
            .toEqual({ maintenance: true, expectedBackAt: '2026-10-20T01:45:00.000Z' });
        expect(getMaintenanceStatus(NOW, { MAINTENANCE_MODE: 'on' })).toEqual({ maintenance: true, expectedBackAt: null });
    });
});
