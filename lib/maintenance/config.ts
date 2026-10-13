/**
 * Maintenance mode configuration, read on the server at request time.
 *
 * Off during ordinary operation. Activation, coverage limits and the cutover
 * procedure are in docs/maintenance-cutover-runbook.md.
 */
export const MAINTENANCE_CODE = 'MAINTENANCE';
export const MAINTENANCE_HEADER = 'X-UtilitySheet-Maintenance';
export const MAINTENANCE_STATUS_PATH = '/api/maintenance';

export const DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS = 1800;
const MIN_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 86_400;

type Env = Record<string, string | undefined>;

const OFF_VALUES = new Set(['', 'off', 'false', '0', 'no']);
// A time without an offset would mean a different moment on the server and in each browser.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Any value other than an explicit "off" turns maintenance on, so a mistyped
 * value during a cutover pauses traffic instead of opening it.
 */
export function isMaintenanceActive(env: Env = process.env): boolean {
    return !OFF_VALUES.has((env.MAINTENANCE_MODE ?? '').trim().toLowerCase());
}

/** The configured estimate, only while it is valid and still ahead. Never inferred. */
export function maintenanceExpectedBackAt(now: number = Date.now(), env: Env = process.env): string | null {
    const raw = (env.MAINTENANCE_EXPECTED_BACK_AT ?? '').trim();
    if (!ISO_WITH_OFFSET.test(raw)) return null;
    const time = Date.parse(raw);
    if (!Number.isFinite(time) || time <= now) return null;
    return new Date(time).toISOString();
}

export function maintenanceRetryAfterSeconds(now: number = Date.now(), env: Env = process.env): number {
    const clamp = (seconds: number) => Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(MIN_RETRY_AFTER_SECONDS, Math.ceil(seconds)));
    const expected = maintenanceExpectedBackAt(now, env);
    if (expected) return clamp((Date.parse(expected) - now) / 1000);
    const raw = (env.MAINTENANCE_RETRY_AFTER_SECONDS ?? '').trim();
    const configured = /^\d{1,6}$/.test(raw) ? Number(raw) : DEFAULT_MAINTENANCE_RETRY_AFTER_SECONDS;
    return clamp(configured);
}

export interface MaintenanceStatus {
    maintenance: boolean;
    expectedBackAt: string | null;
}

export function getMaintenanceStatus(now: number = Date.now(), env: Env = process.env): MaintenanceStatus {
    const maintenance = isMaintenanceActive(env);
    return { maintenance, expectedBackAt: maintenance ? maintenanceExpectedBackAt(now, env) : null };
}
