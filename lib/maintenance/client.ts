import { MAINTENANCE_HEADER, MAINTENANCE_STATUS_PATH } from '@/lib/maintenance/config';

/** What a page knows about a pause. The estimate is present only when the operator set one. */
export interface MaintenanceNotice {
    expectedBackAt: string | null;
}

export type MaintenanceCheck =
    | { state: 'paused'; notice: MaintenanceNotice }
    | { state: 'open' }
    /** The status could not be read; nothing is assumed either way. */
    | { state: 'unknown' };

function readExpectedBackAt(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return Number.isFinite(Date.parse(value)) ? value : null;
}

export function isMaintenanceResponse(response: Response): boolean {
    return response.status === 503 && response.headers.get(MAINTENANCE_HEADER) === '1';
}

/** Reads the status endpoint only. Safe to repeat: it never sends answers or triggers a write. */
export async function checkMaintenanceStatus(): Promise<MaintenanceCheck> {
    try {
        const response = await fetch(MAINTENANCE_STATUS_PATH, { cache: 'no-store' });
        if (!response.ok) return { state: 'unknown' };
        const body = (await response.json()) as { maintenance?: unknown; expectedBackAt?: unknown } | null;
        if (body?.maintenance === true) return { state: 'paused', notice: { expectedBackAt: readExpectedBackAt(body.expectedBackAt) } };
        if (body?.maintenance === false) return { state: 'open' };
        return { state: 'unknown' };
    } catch {
        return { state: 'unknown' };
    }
}

/**
 * The pause behind a refused request, or null when the refusal is something else.
 *
 * A gate in front of the application cannot add the marker, so an unexplained
 * 403 or 5xx is checked against the status endpoint before it is shown as an
 * ordinary failure.
 */
export async function detectMaintenance(response: Response): Promise<MaintenanceNotice | null> {
    if (isMaintenanceResponse(response)) {
        if (response.bodyUsed) return { expectedBackAt: null };
        const body = (await response.clone().json().catch(() => null)) as { expectedBackAt?: unknown } | null;
        return { expectedBackAt: readExpectedBackAt(body?.expectedBackAt) };
    }
    if (response.ok || (response.status !== 403 && response.status < 500)) return null;
    const check = await checkMaintenanceStatus();
    return check.state === 'paused' ? check.notice : null;
}

/** "9:45 PM", or "Tue 9:45 PM" for another day, in the viewer's own time zone. Null once it has passed. */
export function formatExpectedBack(expectedBackAt: string | null | undefined, now: number = Date.now()): string | null {
    if (!expectedBackAt) return null;
    const time = Date.parse(expectedBackAt);
    if (!Number.isFinite(time) || time <= now) return null;
    const date = new Date(time);
    const sameDay = date.toDateString() === new Date(now).toDateString();
    return date.toLocaleString(undefined, sameDay
        ? { hour: 'numeric', minute: '2-digit' }
        : { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
