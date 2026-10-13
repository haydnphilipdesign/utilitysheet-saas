import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { sellerObservationBodySchema } from '../lib/validation/schemas';

// Real seller wizard and observation helper in an isolated bundle. Every request is
// intercepted here: nothing reaches the application, a database or a collector.
const TOKEN = 'synthetic-seller-capability-sentinel';
const SENTINELS = [TOKEN, 'Sentinel', '12 ', 'Faketown', 'zzqx'];

let server: Server;
let origin: string;
test.beforeAll(async () => {
    const bundle = await build({
        entryPoints: ['tests/fixtures/seller-observation-harness.tsx'], bundle: true, write: false,
        platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': process.cwd(), 'next/link': path.resolve('tests/fixtures/seller-observation-link.tsx') },
    });
    server = createServer((req, res) => {
        if (req.url === '/bundle.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(bundle.outputFiles[0].text);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local harness port');
    origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

type ObservedEvent = Record<string, unknown> & { type: string; id: string; seq: number };
type Fixture = {
    batches: Array<{ session: string; events: ObservedEvent[] }>;
    submissions: number;
    sentWhileOffline: number;
    unexpected: string[];
    errors: string[];
    events: () => ObservedEvent[];
};

async function intercept(context: BrowserContext, page: Page, options: {
    collector?: 'accept' | 'abort' | 'limited';
    submitStatuses?: number[];
    /** While this returns true the page is treated as disconnected: submits fail at the network. */
    offline?: () => boolean;
} = {}): Promise<Fixture> {
    const fixture: Fixture = {
        batches: [], submissions: 0, sentWhileOffline: 0, unexpected: [], errors: [],
        events: () => fixture.batches.flatMap(batch => batch.events),
    };
    const submitStatuses = [...(options.submitStatuses ?? [200])];
    page.on('pageerror', error => fixture.errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const api = `/api/seller/${TOKEN}`;
        if (url.origin !== origin) {
            fixture.unexpected.push(request.url());
            await route.abort();
        } else if (options.offline?.() && !request.isNavigationRequest()) {
            if (url.pathname === `${api}/observations`) fixture.sentWhileOffline += 1;
            await route.abort('internetdisconnected');
        } else if (url.pathname === '/api/maintenance') {
            // Asked after an unexplained failure; these fixtures are never in a maintenance pause.
            await route.fulfill({ json: { maintenance: false, expectedBackAt: null } });
        } else if (url.pathname === `${api}/observations`) {
            fixture.batches.push(JSON.parse(request.postData()!));
            if (options.collector === 'abort') await route.abort();
            else if (options.collector === 'limited') await route.fulfill({ status: 429, json: { error: 'Too many requests.' } });
            else await route.fulfill({ status: 202, json: { ok: true } });
        } else if (url.pathname === `${api}/suggestions`) {
            // Water has no suggestion for this address.
            await route.fulfill({ json: { suggestions: { water: [] } } });
        } else if (url.pathname === `${api}/suggestions/search`) {
            await route.fulfill({ json: [] });
        } else if (url.pathname === api && request.method() === 'POST') {
            fixture.submissions += 1;
            const status = submitStatuses.shift() ?? 200;
            await route.fulfill(status === 200
                ? { json: { success: true } }
                : { status, json: { error: 'synthetic failure' } });
        } else if (request.isNavigationRequest() || url.pathname === '/bundle.js') {
            await route.continue();
        } else if (request.resourceType() === 'image') {
            // Static layout artwork; the harness serves no files.
            await route.fulfill({ status: 204 });
        } else {
            fixture.unexpected.push(request.url());
            await route.abort();
        }
    });
    return fixture;
}

async function fillToReview(page: Page) {
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /public water/i }).click();
    await page.getByRole('button', { name: /septic system/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('button', { name: /sentinel electric cooperative/i }).click();
    // Water: empty suggestion list, a search with no match, then the typed name.
    await page.getByRole('button', { name: /search providers/i }).click();
    await page.getByTestId('seller-provider-search-input').fill('zzqx waterworks');
    await page.getByTestId('seller-provider-search-run').click();
    await expect(page.getByText(/no matches in our directory/i)).toBeVisible();
    await page.getByTestId('seller-provider-use-typed').click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
}

const steps = (events: ObservedEvent[], type: string) =>
    events.filter(event => event.type === type).map(event => [event.step, event.category].filter(Boolean).join(':'));

test('reports the seller journey, a revisit and the original failed submit without answers', async ({ page, context }) => {
    const fixture = await intercept(context, page, { submitStatuses: [500, 200] });
    await page.goto(`${origin}/s/${TOKEN}`);
    await fillToReview(page);

    // Going back to a step already seen is a revisit, not new progress.
    await page.getByRole('button', { name: /^back$/i }).click();
    await page.getByTestId('seller-utility-keep-water').click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();

    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByTestId('review-submit-error')).toBeVisible();
    await page.getByTestId('review-submit-retry').click();
    await expect(page.getByTestId('review-submit-error')).toHaveCount(0);
    await expect.poll(() => steps(fixture.events(), 'seller_step_viewed').includes('success'), { timeout: 10_000 }).toBe(true);
    expect(fixture.submissions).toBe(2);

    const events = fixture.events();
    for (const batch of fixture.batches) expect(sellerObservationBodySchema.safeParse(batch).success).toBe(true);
    expect(new Set(fixture.batches.map(batch => batch.session)).size).toBe(1);
    expect(new Set(events.map(event => event.id)).size).toBe(events.length);

    const views = events.filter(event => event.type === 'seller_step_viewed');
    expect(steps(events, 'seller_step_viewed')).toEqual(
        ['welcome', 'home_basics', 'utility:electric', 'utility:water', 'review', 'utility:water', 'review', 'success']);
    expect(views.map(event => event.visit)).toEqual(['first', 'first', 'first', 'first', 'first', 'revisit', 'revisit', 'first']);
    // Unique steps are unaffected by the revisit.
    expect(new Set(steps(events, 'seller_step_viewed')).size).toBe(6);
    expect(steps(events, 'seller_step_completed')).toEqual(
        ['welcome', 'home_basics', 'utility:electric', 'utility:water', 'utility:water']);

    const lists = events.filter(event => event.type === 'seller_suggestions_rendered');
    expect(lists).toContainEqual(expect.objectContaining({ category: 'electric', source: 'initial', result_count: 1 }));
    expect(lists).toContainEqual(expect.objectContaining({ category: 'water', source: 'initial', result_count: 0, empty_reason: 'no_suggestions' }));
    expect(lists).toContainEqual(expect.objectContaining({ category: 'water', source: 'search', result_count: 0, empty_reason: 'no_results' }));

    expect(events.filter(event => event.type === 'seller_submission_attempted').map(event => event.attempt)).toEqual([1, 2]);
    expect(events.filter(event => event.type === 'seller_submission_failed')).toEqual([
        expect.objectContaining({ attempt: 1, error_code: 'server_error', status: 500 }),
    ]);

    const captured = JSON.stringify(fixture.batches);
    for (const sentinel of SENTINELS) expect(captured).not.toContain(sentinel);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});

for (const collector of ['abort', 'limited'] as const) {
    test(`a ${collector === 'abort' ? 'blocked' : 'rate-limited'} collector and blocked storage do not stop a submission`, async ({ page, context }) => {
        await page.addInitScript(() => {
            const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
            for (const method of ['getItem', 'setItem', 'removeItem'] as const) Storage.prototype[method] = blocked;
        });
        const fixture = await intercept(context, page, { collector });
        await page.goto(`${origin}/s/${TOKEN}`);
        await fillToReview(page);
        await page.getByRole('button', { name: /submit/i }).click();
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toHaveCount(0);
        await expect(page.getByText(/sending your info/i)).toHaveCount(0);
        await expect(page.getByTestId('review-submit-error')).toHaveCount(0);
        expect(fixture.submissions).toBe(1);
        // The helper tried, and what it sent was still valid and free of answers.
        expect(fixture.batches.length).toBeGreaterThan(0);
        for (const batch of fixture.batches) expect(sellerObservationBodySchema.safeParse(batch).success).toBe(true);
        if (collector === 'limited') expect(fixture.batches).toHaveLength(1);
        for (const sentinel of SENTINELS) expect(JSON.stringify(fixture.batches)).not.toContain(sentinel);
        expect(fixture.unexpected).toEqual([]);
        expect(fixture.errors).toEqual([]);
    });
}

const setConnection = (page: Page, online: boolean) => page.evaluate((value) => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}, online);

test('an offline submit is held, reported after reconnecting, and the retry succeeds', async ({ page, context }) => {
    let offline = false;
    const fixture = await intercept(context, page, { offline: () => offline });
    await page.goto(`${origin}/s/${TOKEN}`);
    await fillToReview(page);
    await expect.poll(() => steps(fixture.events(), 'seller_step_viewed').includes('review')).toBe(true);
    const sentBefore = fixture.batches.length;

    offline = true;
    await setConnection(page, false);
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByTestId('review-submit-error')).toBeVisible();
    await expect(page.getByText(/you appear to be offline/i)).toBeVisible();
    // Longer than the helper's send delay: nothing is attempted while disconnected.
    await page.waitForTimeout(2500);
    expect(fixture.batches.length).toBe(sentBefore);
    expect(fixture.sentWhileOffline).toBe(0);

    offline = false;
    await setConnection(page, true);
    await expect.poll(() => fixture.events().filter(event => event.type === 'seller_submission_failed').length).toBe(1);
    await page.getByTestId('review-submit-retry').click();
    await expect.poll(() => steps(fixture.events(), 'seller_step_viewed').includes('success'), { timeout: 10_000 }).toBe(true);

    const events = fixture.events();
    expect(events.filter(event => event.type === 'seller_submission_failed')).toEqual([
        expect.objectContaining({ attempt: 1, error_code: 'offline' }),
    ]);
    expect(events.find(event => event.type === 'seller_submission_failed')?.status).toBeUndefined();
    expect(events.filter(event => event.type === 'seller_submission_attempted').map(event => event.attempt)).toEqual([1, 2]);
    expect(new Set(events.map(event => event.id)).size).toBe(events.length);
    for (const batch of fixture.batches) expect(sellerObservationBodySchema.safeParse(batch).success).toBe(true);
    expect(fixture.submissions).toBe(1);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});
