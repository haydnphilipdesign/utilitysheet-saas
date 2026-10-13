import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSellerObserver } from '@/lib/telemetry/seller-observer';
import { sellerObservationBodySchema } from '@/lib/validation/schemas';
import { SELLER_OBSERVATION_MAX_PER_SESSION } from '@/lib/telemetry/seller-observations';

type Body = { v: number; session: string; edit_version: number; events: Array<Record<string, unknown>> };

let fetchMock: ReturnType<typeof vi.fn>;
let tokenCounter = 0;
const nextToken = () => `observer-test-token-${++tokenCounter}`;
const bodies = (): Body[] => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Body);
const accepted = () => new Response(JSON.stringify({ ok: true }), { status: 202 });
const view = (step: 'welcome' | 'home_basics' | 'review') => ({ type: 'seller_step_viewed' as const, step, nav: 'linear' as const });
const setOnline = (value: boolean) => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });

describe('seller observer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
        fetchMock = vi.fn(async () => accepted());
        vi.stubGlobal('fetch', fetchMock);
        setOnline(true);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('batches observations into one valid request without credentials', async () => {
        const token = nextToken();
        const observer = createSellerObserver({ token, editVersion: 2, enabled: true });
        observer.observe(view('welcome'));
        observer.observe({ type: 'seller_step_completed', step: 'welcome', nav: 'linear', duration: '1_3s' });
        observer.observe(view('home_basics'));
        expect(fetchMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`/api/seller/${token}/observations`);
        expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });

        const body = bodies()[0];
        expect(sellerObservationBodySchema.safeParse(body).success).toBe(true);
        expect(body.edit_version).toBe(2);
        expect(body.events.map(e => [e.type, e.seq, e.visit])).toEqual([
            ['seller_step_viewed', 0, 'first'], ['seller_step_completed', 1, undefined], ['seller_step_viewed', 2, 'first'],
        ]);
        expect(new Set(body.events.map(e => e.id)).size).toBe(3);
        expect(JSON.stringify(body)).not.toContain(token);
    });

    it('marks a repeated step as a revisit and keeps one session across reloads of the tab', async () => {
        const token = nextToken();
        const first = createSellerObserver({ token, editVersion: 0, enabled: true });
        first.observe(view('welcome'));
        first.observe(view('home_basics'));
        first.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);

        const reloaded = createSellerObserver({ token, editVersion: 0, enabled: true });
        reloaded.observe(view('home_basics'));
        await vi.advanceTimersByTimeAsync(1500);

        const [before, after] = bodies();
        expect(before.events.map(e => e.visit)).toEqual(['first', 'first', 'revisit']);
        expect(after.session).toBe(before.session);
        expect(after.events[0]).toMatchObject({ visit: 'revisit', seq: 3 });

        // A reopened form is a new editing session with its own first views.
        const reopened = createSellerObserver({ token, editVersion: 1, enabled: true });
        reopened.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);
        expect(bodies()[2].session).not.toBe(before.session);
        expect(bodies()[2].events[0]).toMatchObject({ visit: 'first', seq: 0 });
    });

    it('resends a failed batch with the same event ids, then gives up', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
        observer.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // The next observation carries the unsent one with it.
        observer.observe(view('home_basics'));
        await vi.advanceTimersByTimeAsync(1500);
        observer.observe(view('review'));
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        const welcomeIds = bodies().map(b => b.events.find(e => e.step === 'welcome')?.id);
        expect(welcomeIds[0]).toBeTruthy();
        expect(welcomeIds).toEqual([welcomeIds[0], welcomeIds[0], welcomeIds[0]]);

        // Three failures in a row: left alone for a minute, and the oldest event is dropped.
        fetchMock.mockImplementation(async () => accepted());
        observer.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(bodies()[3].events.some(e => e.id === welcomeIds[0])).toBe(false);
    });

    it('holds observations while offline and sends them on reconnect', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        const detach = observer.attach();
        setOnline(false);
        observer.observe({ type: 'seller_submission_attempted', attempt: 1 });
        observer.observe({ type: 'seller_submission_failed', attempt: 1, error_code: 'offline', duration: 'lt_1s' });
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fetchMock).not.toHaveBeenCalled();

        setOnline(true);
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(bodies()[0].events.map(e => e.type)).toEqual(['seller_submission_attempted', 'seller_submission_failed']);
        detach();
    });

    it('sends what is queued when the page is hidden', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        const detach = observer.attach();
        observer.observe(view('review'));
        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        detach();
        observer.observe(view('welcome'));
        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([400, 404, 413])('stops for the page after a %s refusal', async (status) => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
        observer.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);
        observer.observe(view('home_basics'));
        await vi.advanceTimersByTimeAsync(120_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('drops a rate-limited batch and pauses; retries a server error once the pause ends', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
        observer.observe(view('welcome'));
        await vi.advanceTimersByTimeAsync(1500);
        observer.observe(view('home_basics'));
        await vi.advanceTimersByTimeAsync(30_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(31_500);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(bodies()[1].events.map(e => e.step)).toEqual(['home_basics']);

        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
        observer.observe(view('review'));
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(bodies()[3].events[0].id).toBe(bodies()[2].events[0].id);
    });

    it('stops at the per-session ceiling and never sends more than ten events at once', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        for (let batch = 0; batch < 20; batch += 1) {
            for (let index = 0; index < 10; index += 1) observer.observe({ type: 'seller_submission_attempted', attempt: 1 });
            await vi.advanceTimersByTimeAsync(1500);
        }
        const sent = bodies();
        expect(sent.every(body => body.events.length <= 10)).toBe(true);
        expect(sent.reduce((total, body) => total + body.events.length, 0)).toBe(SELLER_OBSERVATION_MAX_PER_SESSION);
    });

    it('works with storage blocked and never throws into the caller', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: true });
        expect(() => {
            observer.observe(view('welcome'));
            observer.observe(view('welcome'));
        }).not.toThrow();
        await vi.advanceTimersByTimeAsync(1500);
        const [body] = bodies();
        expect(sellerObservationBodySchema.safeParse(body).success).toBe(true);
        expect(body.events.map(e => [e.seq, e.visit])).toEqual([[0, 'first'], [1, 'revisit']]);

        fetchMock.mockImplementation(() => { throw new Error('fetch unavailable'); });
        expect(() => observer.observe(view('review'))).not.toThrow();
        await expect(vi.advanceTimersByTimeAsync(1500)).resolves.not.toThrow();
    });

    it('does nothing when disabled', async () => {
        const observer = createSellerObserver({ token: nextToken(), editVersion: 0, enabled: false });
        observer.observe(view('welcome'));
        observer.attach()();
        await vi.advanceTimersByTimeAsync(5000);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(sessionStorage.length).toBe(0);
    });
});
