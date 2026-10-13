import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';

// The real seller page, wizard and stylesheet in an isolated bundle. Every request
// is answered here: nothing reaches the application, a limiter, a database,
// email or a provider.
const TOKEN = 'synthetic-seller-capability-sentinel';
const API = `/api/seller/${TOKEN}`;
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;
const SHOTS = process.env.MAINTENANCE_SCREENSHOT_DIR;

let server: Server;
let origin: string;
test.beforeAll(async () => {
    const bundle = await build({
        entryPoints: ['tests/fixtures/maintenance-harness.tsx'], bundle: true, write: false,
        platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': process.cwd(), 'next/link': path.resolve('tests/fixtures/seller-observation-link.tsx') },
    });
    const cssPath = path.resolve('app/globals.css');
    const css = (await postcss([tailwind()]).process(await readFile(cssPath, 'utf8'), { from: cssPath })).css;
    server = createServer((req, res) => {
        if (req.url === '/bundle.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(bundle.outputFiles[0].text);
        } else if (req.url === '/styles.css') {
            res.setHeader('Content-Type', 'text/css');
            res.end(css);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local harness port');
    origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

type Fixture = {
    /** Flip to start or end the pause, like the deployment's flag. */
    paused: boolean;
    expectedBackAt: string | null;
    submissions: Array<{ refused: boolean; body: Record<string, unknown> }>;
    refused: Record<string, number>;
    served: Record<string, number>;
    unexpected: string[];
    errors: string[];
};

const refusal = (fixture: Fixture) => ({
    status: 503,
    headers: { 'Retry-After': '1800', 'Cache-Control': 'no-store', 'X-UtilitySheet-Maintenance': '1' },
    json: { error: 'server wording', code: 'MAINTENANCE', maintenance: true, expectedBackAt: fixture.expectedBackAt },
});

async function intercept(context: BrowserContext, page: Page, initial: Partial<Fixture> = {}): Promise<Fixture> {
    const fixture: Fixture = { paused: false, expectedBackAt: null, submissions: [], refused: {}, served: {}, unexpected: [], errors: [], ...initial };
    const count = (bucket: Record<string, number>, key: string) => { bucket[key] = (bucket[key] ?? 0) + 1; };
    page.on('pageerror', error => fixture.errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const gated = async (key: string, serve: () => Promise<void>) => {
            if (fixture.paused) {
                count(fixture.refused, key);
                await route.fulfill(refusal(fixture));
            } else {
                count(fixture.served, key);
                await serve();
            }
        };
        if (url.origin !== origin) {
            fixture.unexpected.push(request.url());
            await route.abort();
        } else if (url.pathname === '/api/maintenance') {
            await route.fulfill({ json: { maintenance: fixture.paused, expectedBackAt: fixture.paused ? fixture.expectedBackAt : null } });
        } else if (url.pathname === `${API}/observations`) {
            await route.fulfill({ status: 202, json: { ok: true } });
        } else if (url.pathname === `${API}/suggestions`) {
            await gated('suggestions', () => route.fulfill({ json: { suggestions: {
                electric: [{ display_name: 'Sentinel Electric Cooperative', confidence: 0.9 }],
                water: [{ display_name: 'Sentinel Water Authority', confidence: 0.9 }],
            } } }));
        } else if (url.pathname === `${API}/suggestions/search`) {
            await gated('search', () => route.fulfill({ json: [] }));
        } else if (url.pathname === `${API}/send-link`) {
            await gated('send-link', () => route.fulfill({ json: { success: true } }));
        } else if (url.pathname === API && request.method() === 'POST') {
            fixture.submissions.push({ refused: fixture.paused, body: JSON.parse(request.postData()!) });
            await gated('submit', () => route.fulfill({ json: { success: true } }));
        } else if (url.pathname === API && request.method() === 'GET') {
            // The form read is not one of the paused endpoints.
            await route.fulfill({ json: {
                request: {
                    property_address: '12 Sentinel Street, Faketown, PA 18301',
                    utility_categories: ['electric', 'water'],
                    collect_electric_meter_number: false, collect_hoa_questions: false,
                    status: 'in_progress', edit_version: 0, packet_mode: 'simple',
                },
                brandProfile: { name: 'Sentinel Realty', contact_email: 'team@example.test', primary_color: '#3b5b8c' },
                suggestions: {},
            } });
        } else if (request.isNavigationRequest() || url.pathname === '/bundle.js' || url.pathname === '/styles.css') {
            await route.continue();
        } else if (request.resourceType() === 'image' || request.resourceType() === 'font') {
            await route.fulfill({ status: 204 });
        } else {
            fixture.unexpected.push(request.url());
            await route.abort();
        }
    });
    return fixture;
}

async function shot(page: Page, name: string) {
    if (!SHOTS) return;
    await page.screenshot({ path: path.join(SHOTS, `${test.info().project.name.replace(/\s+/g, '-').toLowerCase()}-${name}.png`), fullPage: true });
}

/** No sideways scrolling, and nothing inside the notice wider than the screen. */
async function expectFitsViewport(page: Page, testId: string) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await page.getByTestId(testId).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 0.5);
}

/** The styled control is a real, named, focusable button with a finger-sized target. */
async function expectUsableButton(page: Page, testId: string) {
    const button = page.getByTestId(testId);
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName('Check again');
    const box = (await button.boundingBox())!;
    const touch = test.info().project.name !== 'Desktop Chrome';
    expect(box.height).toBeGreaterThanOrEqual(touch ? 44 : 36);
    await button.focus();
    await expect(button).toBeFocused();
    // The stylesheet really loaded: an unstyled button has no rounded corners.
    expect(await button.evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThan(0);
}

async function fillToReview(page: Page) {
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /public water/i }).click();
    await page.getByRole('button', { name: /septic system/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('button', { name: /sentinel electric cooperative/i }).click();
    await page.getByRole('button', { name: /sentinel water authority/i }).click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
}

test('a new visit during a pause sees a calm paused screen, then the form once it is over', async ({ page, context }) => {
    const fixture = await intercept(context, page, { paused: true, expectedBackAt: '2099-01-01T02:45:00.000Z' });
    await page.goto(`${origin}/s/${TOKEN}`);

    const notice = page.getByTestId('seller-maintenance-screen');
    await expect(page.getByRole('heading', { level: 1, name: 'This form is paused for maintenance' })).toBeVisible();
    await expect(notice.getByRole('status')).toBeVisible();
    await expect(notice).toContainText('Nothing is wrong with your link.');
    await expect(notice).toContainText('We expect to be back around');
    await expect(page.getByText(/this link isn’t working/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /get started/i })).toHaveCount(0);
    await expect(page.getByTestId('seller-maintenance-draft')).toHaveCount(0);
    await expectFitsViewport(page, 'seller-maintenance-screen');
    await expectUsableButton(page, 'seller-maintenance-screen-check');
    await shot(page, 'new-visit-paused');

    // Reachable and operable from the keyboard.
    await page.getByTestId('seller-maintenance-screen-check').press('Enter');
    await expect(page.getByTestId('seller-maintenance-screen-check-result')).toHaveText('Still paused. Thank you for your patience.');
    expect(fixture.refused).toEqual({});
    expect(fixture.submissions).toEqual([]);

    fixture.paused = false;
    await page.getByTestId('seller-maintenance-screen-check').click();
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});

test('an open tab keeps its answers through a refused submit, a reload and the reopening', async ({ page, context }) => {
    const fixture = await intercept(context, page);
    await page.goto(`${origin}/s/${TOKEN}`);
    await fillToReview(page);

    // The pause starts while the tab is open.
    fixture.paused = true;
    await page.getByRole('button', { name: /submit/i }).click();
    const banner = page.getByTestId('seller-maintenance-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('role', 'alert');
    await expect(banner).toContainText('Not sent yet: paused for maintenance');
    await expect(banner).toContainText('They are still on this page.');
    await expect(banner).not.toContainText('server wording');
    await expect(banner).not.toContainText('We expect to be back');
    await expect(page.getByTestId('review-submit-error')).toHaveCount(0);
    await expect(page.getByText('Sentinel Water Authority')).toBeVisible();
    await expect(page.getByTestId('seller-maintenance-draft')).toContainText('stored in this browser on this device, not on our servers');
    // Shown where the seller is looking: next to the Submit button they just pressed.
    await expect(banner).toBeInViewport();
    await expectFitsViewport(page, 'seller-maintenance-banner');
    await expectUsableButton(page, 'seller-maintenance-banner-check');
    await shot(page, 'open-tab-submit-refused');

    await page.getByTestId('seller-maintenance-banner-check').click();
    await expect(page.getByTestId('seller-maintenance-banner-check-result')).toHaveText('Still paused. Thank you for your patience.');
    expect(fixture.submissions).toHaveLength(1);

    // Closing and reopening the link during the pause: paused screen, draft still there.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'This form is paused for maintenance' })).toBeVisible();
    await expect(page.getByTestId('seller-maintenance-draft')).toContainText('If you come back in this same browser they should still be here.');
    expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toContain('Sentinel Water Authority');
    await shot(page, 'reload-paused-with-draft');

    // Reopened: the answers come back from the draft, and nothing was sent for the seller.
    fixture.paused = false;
    await page.getByTestId('seller-maintenance-screen-check').click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
    await expect(page.getByText('Sentinel Electric Cooperative')).toBeVisible();
    await expect(page.getByText('Sentinel Water Authority')).toBeVisible();
    await page.waitForTimeout(500);
    expect(fixture.submissions).toHaveLength(1);

    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toHaveCount(0);
    await expect(page.getByTestId('review-submit-error')).toHaveCount(0);
    expect(fixture.submissions.map(submission => submission.refused)).toEqual([true, false]);
    // The retry carries the same answers and the same idempotency key as the refused attempt.
    expect(fixture.submissions[1].body.submission_key).toBe(fixture.submissions[0].body.submission_key);
    expect(fixture.submissions[1].body.utilities).toEqual(fixture.submissions[0].body.utilities);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});

test('with storage blocked the seller is told to keep the page open, and can still send after the pause', async ({ page, context }) => {
    await page.addInitScript(() => {
        const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
        for (const method of ['getItem', 'setItem', 'removeItem'] as const) Storage.prototype[method] = blocked;
    });
    const fixture = await intercept(context, page);
    await page.goto(`${origin}/s/${TOKEN}`);
    await fillToReview(page);

    fixture.paused = true;
    await page.getByRole('button', { name: /submit/i }).click();
    const banner = page.getByTestId('seller-maintenance-banner');
    await expect(page.getByTestId('seller-maintenance-draft')).toContainText('Keep this page open so they stay on the screen.');
    await expect(banner).not.toContainText('stored in this browser');
    await expect(page.getByText('Sentinel Water Authority')).toBeVisible();

    fixture.paused = false;
    await page.getByTestId('seller-maintenance-banner-check').click();
    await expect(page.getByTestId('seller-maintenance-over')).toHaveText('We’re back. Tap Submit to send your answers.');
    await expect(banner).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(fixture.submissions).toHaveLength(1);

    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByRole('heading', { name: 'Review and Submit' })).toHaveCount(0);
    expect(fixture.submissions.map(submission => submission.refused)).toEqual([true, false]);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});

test('paused suggestions, lookup and return-link email read as paused, and suggestions return afterwards', async ({ page, context }) => {
    const fixture = await intercept(context, page);
    await page.goto(`${origin}/s/${TOKEN}`);
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();

    // The pause starts after the form opened and before any suggestion was loaded.
    fixture.paused = true;
    await page.getByRole('button', { name: /get started/i }).click();
    const banner = page.getByTestId('seller-maintenance-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('role', 'status');
    await expect(banner).toContainText('you can keep filling in your answers');
    await expectFitsViewport(page, 'seller-maintenance-banner');

    await page.getByRole('button', { name: /public water/i }).click();
    await page.getByRole('button', { name: /septic system/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.getByRole('heading', { name: 'Provider suggestions are paused' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Help us find your provider' })).toHaveCount(0);
    await shot(page, 'suggestions-paused');

    // A typed name is still accepted; the lookup says it is paused, not that nothing matched.
    await page.getByRole('button', { name: 'Type provider name' }).click();
    await page.getByTestId('seller-provider-search-input').fill('zzqx power');
    await page.getByTestId('seller-provider-search-run').click();
    await expect(page.getByTestId('seller-search-paused')).toBeVisible();
    await expect(page.getByText(/no matches in our directory/i)).toHaveCount(0);

    // The return-link email explains itself and offers another way back.
    await page.getByTestId('seller-save-link-open').click();
    await page.getByTestId('seller-save-link-email').fill('seller@example.test');
    await page.getByTestId('seller-save-link-send').click();
    await expect(page.getByText(/Emailing this link is paused for a short planned update, so nothing was sent\./)).toBeVisible();
    await expect(page.getByText(/sent! check your inbox/i)).toHaveCount(0);
    expect(fixture.refused['send-link']).toBe(1);

    await page.getByTestId('seller-provider-use-typed').click();
    // Water was refused too, so it is still paused here.
    await expect(page.getByRole('heading', { name: 'Provider suggestions are paused' })).toBeVisible();

    fixture.paused = false;
    await page.getByTestId('seller-maintenance-banner-check').click();
    await expect(page.getByRole('button', { name: /sentinel water authority/i })).toBeVisible();
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId('seller-maintenance-over')).toContainText('We’re back.');
    // Reopening re-read suggestions only; it sent no email and no submission.
    expect(fixture.refused['send-link']).toBe(1);
    expect(fixture.served['send-link']).toBeUndefined();
    expect(fixture.submissions).toEqual([]);
    expect(fixture.unexpected).toEqual([]);
    expect(fixture.errors).toEqual([]);
});
