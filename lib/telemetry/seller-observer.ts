import {
    SELLER_OBSERVATION_MAX_BATCH,
    SELLER_OBSERVATION_MAX_BODY_BYTES,
    SELLER_OBSERVATION_MAX_PER_SESSION,
    SELLER_OBSERVATION_SCHEMA_VERSION,
} from '@/lib/telemetry/seller-observations';
import type { SellerObservationEvent } from '@/lib/validation/schemas';

type WithoutEnvelope<T> = T extends unknown ? Omit<T, 'id' | 'seq' | 'visit'> : never;
/** What a caller supplies; the helper adds the event id, sequence and first/revisit marker. */
export type SellerObservationInput = WithoutEnvelope<SellerObservationEvent>;

export interface SellerObserver {
    /** Queues one observation. Never throws and never returns a promise to wait on. */
    observe(event: SellerObservationInput): void;
    /** Starts listening for reconnects and page hides; returns the matching cleanup. */
    attach(): () => void;
}

type QueuedEvent = { event: SellerObservationEvent; tries: number };
type SessionState = { id: string; seq: number; count: number; viewed: string[] };

const FLUSH_DELAY_MS = 1500;
const MAX_QUEUE = 30;
const MAX_TRIES = 3;
const RATE_LIMIT_PAUSE_MS = 60_000;
const SERVER_ERROR_PAUSE_MS = 15_000;

/** Used when sessionStorage is unavailable, so a blocked store still gets one stable session per page load. */
const memorySessions = new Map<string, SessionState>();

const NOOP_OBSERVER: SellerObserver = { observe: () => undefined, attach: () => () => undefined };

function randomId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const part = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0');
    return `${Date.now().toString(36)}-${part()}-${part()}`;
}

function stepKey(event: SellerObservationInput): string | null {
    if (event.type !== 'seller_step_viewed') return null;
    return [event.step, event.category ?? event.section ?? ''].join(':');
}

/**
 * Best-effort sender for seller diagnostic observations. It batches, reuses an
 * event id when a batch is resent, gives up after a few tries and stops at a
 * per-session ceiling. Nothing here can delay or fail a wizard action.
 */
export function createSellerObserver(options: { token: string; editVersion: number; enabled: boolean }): SellerObserver {
    if (!options.enabled || typeof window === 'undefined') return NOOP_OBSERVER;

    const storageKey = `us_seller_obs:${options.editVersion}:${options.token}`;
    const endpoint = `/api/seller/${encodeURIComponent(options.token)}/observations`;
    let queue: QueuedEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sending = false;
    let stopped = false;
    let pausedUntil = 0;
    let consecutiveFailures = 0;

    const loadSession = (): SessionState => {
        try {
            const raw = sessionStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) as Partial<SessionState> : null;
            if (parsed && typeof parsed.id === 'string' && Number.isInteger(parsed.seq) && Number.isInteger(parsed.count)) {
                return {
                    id: parsed.id,
                    seq: parsed.seq as number,
                    count: parsed.count as number,
                    viewed: Array.isArray(parsed.viewed) ? parsed.viewed.filter((key): key is string => typeof key === 'string').slice(0, 40) : [],
                };
            }
        } catch {
            // Fall through to the in-memory session.
        }
        const existing = memorySessions.get(storageKey);
        if (existing) return existing;
        const created: SessionState = { id: randomId(), seq: 0, count: 0, viewed: [] };
        memorySessions.set(storageKey, created);
        return created;
    };

    const saveSession = (session: SessionState) => {
        memorySessions.set(storageKey, session);
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(session));
        } catch {
            // Storage can be blocked or full; the in-memory copy carries on.
        }
    };

    const schedule = (delay: number = FLUSH_DELAY_MS) => {
        if (timer || stopped || queue.length === 0) return;
        timer = setTimeout(() => {
            timer = null;
            void flush();
        }, delay);
    };

    const requeue = (batch: QueuedEvent[]) => {
        const retryable = batch
            .map((item) => ({ ...item, tries: item.tries + 1 }))
            .filter((item) => item.tries < MAX_TRIES);
        queue = [...retryable, ...queue].slice(0, MAX_QUEUE);
    };

    const flush = async (): Promise<void> => {
        try {
            if (stopped || sending || queue.length === 0) return;
            if (Date.now() < pausedUntil) {
                schedule(pausedUntil - Date.now());
                return;
            }
            // Wait for the reconnect instead of spending a try while offline.
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

            const encode = (items: QueuedEvent[]) => JSON.stringify({
                v: SELLER_OBSERVATION_SCHEMA_VERSION, session: loadSession().id,
                edit_version: options.editVersion, events: items.map(item => item.event),
            });
            const batch = queue.slice(0, SELLER_OBSERVATION_MAX_BATCH);
            while (batch.length > 1 && new TextEncoder().encode(encode(batch)).byteLength > SELLER_OBSERVATION_MAX_BODY_BYTES) batch.pop();
            if (new TextEncoder().encode(encode(batch)).byteLength > SELLER_OBSERVATION_MAX_BODY_BYTES) {
                queue = queue.slice(1); schedule(); return;
            }
            queue = queue.slice(batch.length);
            sending = true;
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: encode(batch),
                    keepalive: true,
                    credentials: 'omit',
                });
                consecutiveFailures = 0;
                if (response.status === 429) {
                    pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
                } else if (response.status >= 500) {
                    pausedUntil = Date.now() + SERVER_ERROR_PAUSE_MS;
                    requeue(batch);
                } else if (!response.ok) {
                    // The link or this build's payload is not accepted; further sends would fail the same way.
                    stopped = true;
                    queue = [];
                }
            } catch {
                requeue(batch);
                consecutiveFailures += 1;
                // A blocked or failing collector is left alone for a while; the next observation or reconnect resumes.
                if (consecutiveFailures >= MAX_TRIES) pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
                return;
            } finally {
                sending = false;
            }
            schedule();
        } catch {
            // Observations are advisory; nothing propagates to the form.
        }
    };

    const observe = (input: SellerObservationInput) => {
        try {
            if (stopped) return;
            const session = loadSession();
            if (session.count >= SELLER_OBSERVATION_MAX_PER_SESSION) return;

            const key = stepKey(input);
            const visit = key && session.viewed.includes(key) ? 'revisit' : 'first';
            const event = {
                ...input,
                id: randomId(),
                seq: Math.min(session.seq, 9999),
                ...(key ? { visit } : {}),
            } as SellerObservationEvent;

            saveSession({
                id: session.id,
                seq: session.seq + 1,
                count: session.count + 1,
                viewed: key && !session.viewed.includes(key) ? [...session.viewed, key].slice(-40) : session.viewed,
            });
            queue = [...queue, { event, tries: 0 }].slice(-MAX_QUEUE);
            schedule();
        } catch {
            // Observations are advisory; nothing propagates to the form.
        }
    };

    const attach = () => {
        const flushNow = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            void flush();
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') flushNow();
        };
        try {
            window.addEventListener('online', flushNow);
            window.addEventListener('pagehide', flushNow);
            document.addEventListener('visibilitychange', onVisibility);
        } catch {
            return () => undefined;
        }
        return () => {
            try {
                window.removeEventListener('online', flushNow);
                window.removeEventListener('pagehide', flushNow);
                document.removeEventListener('visibilitychange', onVisibility);
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            } catch {
                // ignore
            }
        };
    };

    return { observe, attach };
}
