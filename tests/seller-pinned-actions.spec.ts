import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// The actual public page, wizard and CSS, with synthetic API responses only.
// Phones (under 640px wide, over 500px tall) pin the main action of Home
// Basics, the handoff sections and Review to the bottom of the screen; larger
// screens keep it in place, and Review uses two columns on desktop. These need
// real layout, which JSDOM cannot compute.
const TOKEN = 'synthetic-pinned-actions';
const ADDRESS = '12 Synthetic Street, Faketown, PA 18301';
const categories = ['electric', 'water', 'sewer'];
let server: Server;
let origin: string;

test.beforeAll(async () => {
    const bundle = await build({
        stdin: {
            contents: `import React, {Suspense} from 'react'; import {createRoot} from 'react-dom/client';
                import Page from '@/app/s/[token]/page';
                const params = Promise.resolve({token: '${TOKEN}'});
                createRoot(document.getElementById('root')).render(
                    <Suspense fallback={<p>Loading fixture...</p>}><Page params={params}/></Suspense>);`,
            resolveDir: process.cwd(), loader: 'tsx',
        },
        bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': process.cwd(), 'next/link': path.resolve('tests/fixtures/seller-observation-link.tsx') },
    });
    const css = (await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), {
        from: path.resolve('app/globals.css'),
    })).css;
    server = createServer((req, res) => {
        if (req.url === '/bundle.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(bundle.outputFiles[0].text);
        } else {
            const dark = (req.url || '').includes('dark=1');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html><html class="${dark ? 'dark' : ''}"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
                <style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local fixture port');
    origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

interface Fixture { advanced?: boolean; failFirstSubmit?: boolean }

async function routeSeller(context: BrowserContext, fixture: Fixture = {}) {
    const log = { unexpected: [] as string[], submissions: 0 };
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
            log.unexpected.push(url.origin);
            await route.abort();
        } else if (url.pathname === `/api/seller/${TOKEN}` && request.method() === 'POST') {
            log.submissions += 1;
            if (fixture.failFirstSubmit && log.submissions === 1) await route.fulfill({ status: 500, json: { error: 'synthetic' } });
            else await route.fulfill({ json: { success: true } });
        } else if (url.pathname === `/api/seller/${TOKEN}`) {
            await route.fulfill({ json: {
                request: {
                    property_address: ADDRESS, utility_categories: categories, collect_hoa_questions: true,
                    collect_electric_meter_number: false,
                    packet_mode: fixture.advanced ? 'advanced' : 'simple',
                    advanced_modules: fixture.advanced ? ['lawn_exterior', 'mailbox_access'] : [],
                },
                suggestions: Object.fromEntries(categories.map(category => [category, []])),
                brandProfile: { name: 'Synthetic Realty', primary_color: null, contact_email: 'help@example.com' },
            } });
        } else if (url.pathname === '/api/maintenance') {
            await route.fulfill({ json: { maintenance: false } });
        } else if (url.pathname.endsWith('/observations')) {
            await route.fulfill({ status: 202, json: { ok: true } });
        } else if (request.resourceType() === 'image') {
            await route.fulfill({ status: 204, body: '' });
        } else if (request.isNavigationRequest() || url.pathname === '/bundle.js') {
            await route.continue();
        } else {
            log.unexpected.push(url.pathname);
            await route.abort();
        }
    });
    return log;
}

async function open(page: Page, context: BrowserContext, size: { width: number; height: number }, fixture: Fixture = {}) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const log = await routeSeller(context, fixture);
    await page.setViewportSize(size);
    await page.goto(`${origin}/s/${TOKEN}`);
    await page.getByTestId('seller-welcome-continue').click();
    await expect(page.getByRole('heading', { name: 'Home Basics', exact: true })).toBeVisible();
    return { errors, log };
}

const position = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).position);

// Fully on screen: below the fixed header and above the bottom edge.
const onScreen = (locator: Locator) => locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= document.querySelector('header')!.getBoundingClientRect().bottom && r.bottom <= window.innerHeight + 0.5;
});

async function answerBasics(page: Page) {
    await page.getByTestId('has-hoa-yes').click();
    await page.getByRole('button', { name: /^Public Water/ }).click();
    await page.getByRole('button', { name: /^Public Sewer/ }).click();
}

async function continueToReview(page: Page) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    for (const provider of ['Electric', 'Water', 'Sewer']) {
        await expect(page.getByRole('heading', { name: `${provider} Provider`, exact: true })).toBeVisible();
        await page.getByRole('button', { name: /I.m not sure/ }).first().click();
    }
}

const PHONES = [
    { name: 'small phone', width: 320, height: 568 },
    { name: 'phone with browser bars', width: 390, height: 664 },
];

for (const phone of PHONES) {
    test(`${phone.name}: Home Basics keeps Continue on screen without covering content`, async ({ page, context }) => {
        const { errors, log } = await open(page, context, phone);
        const actions = page.getByTestId('basics-actions');
        const button = page.getByRole('button', { name: 'Continue', exact: true });
        // Pinned from the first screen, with the reason it is disabled.
        expect(await position(actions)).toBe('sticky');
        await expect(button).toBeDisabled();
        expect(await onScreen(button)).toBe(true);
        expect(await onScreen(page.locator('#basics-continue-blocked'))).toBe(true);

        await answerBasics(page);
        await page.getByTestId('hoa-details-toggle').click();
        await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
        await expect(button).toBeEnabled();
        expect(await onScreen(button)).toBe(true);

        // Typing: the bar returns to its place after the last question instead of floating over the keyboard.
        const field = page.getByLabel('Association Name');
        await field.focus();
        await expect.poll(() => position(actions)).toBe('static');
        expect(await field.evaluate((el, bar) => {
            const f = el.getBoundingClientRect(); const b = bar!.getBoundingClientRect();
            return f.bottom <= b.top || f.top >= b.bottom;
        }, await actions.elementHandle())).toBe(true);
        await field.blur();
        await expect.poll(() => position(actions)).toBe('sticky');

        // A control under the bar that gets focus is scrolled clear of it (WCAG 2.4.11).
        await page.evaluate(() => window.scrollTo(0, 0));
        const hidden = await page.evaluate(() => {
            const bar = document.querySelector('[data-testid="basics-actions"]')!.getBoundingClientRect();
            const target = [...document.querySelectorAll<HTMLElement>('main button')].find(el => {
                const r = el.getBoundingClientRect();
                return !el.closest('[data-testid="basics-actions"]') && r.bottom > bar.top && r.top < window.innerHeight;
            });
            target?.setAttribute('data-under-bar', '');
            return Boolean(target);
        });
        expect(hidden).toBe(true);
        await page.locator('[data-under-bar]').focus();
        await expect.poll(() => page.locator('[data-under-bar]').evaluate(el =>
            el.getBoundingClientRect().bottom <= document.querySelector('[data-testid="basics-actions"]')!.getBoundingClientRect().top + 0.5
        )).toBe(true);

        // At the end of the page the last content sits above the bar, not under it.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        expect(await actions.evaluate(bar => {
            const previous = bar.previousElementSibling!.getBoundingClientRect();
            return previous.bottom <= bar.getBoundingClientRect().top + 0.5;
        })).toBe(true);

        // Keyboard order is unchanged: the last optional control, then Continue.
        await page.getByTestId('hoa-details-toggle').click();
        await page.getByTestId('hoa-details-toggle').focus();
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        expect(await onScreen(button)).toBe(true);

        // Provider steps are not pinned, and the next step still starts at the top below the header.
        await button.click();
        await expect(page.getByRole('heading', { name: 'Electric Provider', exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        expect(await page.evaluate(() => [...document.querySelectorAll('main *')].some(el => getComputedStyle(el).position === 'sticky'))).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        expect(errors).toEqual([]);
        expect(log.unexpected).toEqual([]);
    });
}

test('phone: handoff sections pin Continue and Skip, Review pins Back and Submit and shows a failed send', async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { errors, log } = await open(page, context, { width: 390, height: 664 }, { advanced: true, failFirstSubmit: true });
    await answerBasics(page);
    await continueToReview(page);

    await expect(page.getByRole('heading', { level: 2, name: 'Lawn & Snow Care', exact: true })).toBeVisible();
    expect(await position(page.getByTestId('advanced-actions'))).toBe('sticky');
    expect(await onScreen(page.getByTestId('advanced-continue'))).toBe(true);
    expect(await onScreen(page.getByTestId('advanced-skip-section'))).toBe(true);
    await page.getByTestId('advanced-skip-section').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Mailbox & Home Access', exact: true })).toBeVisible();
    // Reduced motion swaps steps without waiting, so the previous one may still be leaving.
    await expect(page.getByTestId('advanced-continue')).toHaveCount(1);
    await page.getByTestId('advanced-continue').click();

    await expect(page.getByRole('heading', { name: 'Review and Submit', exact: true })).toBeVisible();
    const actions = page.getByTestId('review-actions');
    expect(await position(actions)).toBe('sticky');
    await expect(page.getByTestId('advanced-continue')).toHaveCount(0);
    expect(await onScreen(actions.getByRole('button', { name: 'Back', exact: true }))).toBe(true);
    const submit = page.getByRole('button', { name: /^Submit/ });
    expect(await onScreen(submit)).toBe(true);

    // Submitting from the top of the page: the failure is brought into view above the bar.
    await submit.click();
    const failure = page.getByTestId('review-submit-error');
    await expect(failure).toBeVisible();
    await expect.poll(() => failure.evaluate(el =>
        el.getBoundingClientRect().top >= document.querySelector('header')!.getBoundingClientRect().bottom
        && el.getBoundingClientRect().bottom <= document.querySelector('[data-testid="review-actions"]')!.getBoundingClientRect().top + 0.5,
    )).toBe(true);
    await page.getByTestId('review-submit-retry').click();
    await expect(page.getByRole('heading', { name: 'All Done!' })).toBeVisible();
    expect(log.submissions).toBe(2);
    expect(errors).toEqual([]);
    expect(log.unexpected).toEqual([]);
});

for (const size of [
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'small landscape phone', width: 568, height: 320 },
]) {
    test(`${size.name}: actions stay in place`, async ({ page, context }) => {
        await open(page, context, size);
        expect(await position(page.getByTestId('basics-actions'))).toBe('static');
        expect(await page.getByTestId('basics-actions').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
    });
}

const DESKTOPS = [
    { name: 'laptop', width: 1280, height: 720 },
    { name: 'desktop', width: 1920, height: 1080 },
];

for (const desktop of DESKTOPS) {
    test(`${desktop.name}: Review uses two columns with the header aligned; questions stay one column`, async ({ page, context }) => {
        const { errors, log } = await open(page, context, desktop, { advanced: true });
        const edges = () => page.evaluate(() => {
            const header = document.querySelector('header > div')!;
            const main = document.querySelector('main')!;
            const h = header.getBoundingClientRect(); const m = main.getBoundingClientRect();
            const hs = getComputedStyle(header); const ms = getComputedStyle(main);
            return {
                header: [Math.round(h.left + parseFloat(hs.paddingLeft)), Math.round(h.right - parseFloat(hs.paddingRight))],
                main: [Math.round(m.left + parseFloat(ms.paddingLeft)), Math.round(m.right - parseFloat(ms.paddingRight))],
                width: Math.round(m.width),
            };
        });
        const basics = await edges();
        expect(basics.width).toBe(672);
        expect(basics.header).toEqual(basics.main);

        await answerBasics(page);
        await continueToReview(page);
        for (const section of ['Lawn & Snow Care', 'Mailbox & Home Access']) {
            await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
            await expect(page.getByTestId('advanced-continue')).toHaveCount(1);
            await page.getByTestId('advanced-continue').click();
        }
        await expect(page.getByRole('heading', { name: 'Review and Submit', exact: true })).toBeVisible();
        const review = await edges();
        expect(review.width).toBe(1024);
        expect(review.header).toEqual(review.main);

        // One frame, so the step's slide-in moves every card alike.
        const [home, utilities, details] = await page.evaluate(titles => titles.map(title => {
            const h = [...document.querySelectorAll('main h3')].find(el => el.textContent === title)!;
            const r = h.closest('.bg-card')!.getBoundingClientRect();
            // Where the heading text sits, not its box.
            const range = document.createRange();
            range.selectNodeContents(h);
            return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), heading: Math.round(range.getBoundingClientRect().top) };
        }), ['Home Basics', 'Utility Providers', 'Additional Home Details']);
        expect(home.top).toBe(utilities.top);
        expect(Math.abs(home.heading - utilities.heading)).toBeLessThanOrEqual(1);
        expect(utilities.left).toBeGreaterThan(home.left + home.width);
        expect(details.left).toBe(home.left);
        expect(details.width).toBe(review.main[1] - review.main[0]);
        expect(await position(page.getByTestId('review-actions'))).toBe('static');
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        expect(errors).toEqual([]);
        expect(log.unexpected).toEqual([]);
    });
}

for (const size of [
    { name: 'small phone', width: 320, height: 568, columns: 2 },
    { name: 'phone', width: 390, height: 664, columns: 2 },
    { name: 'sm breakpoint', width: 640, height: 900, columns: 4 },
    { name: 'tablet', width: 768, height: 1024, columns: 4 },
    { name: 'laptop', width: 1280, height: 720, columns: 4 },
]) {
    test(`${size.name}: water and sewer labels fit on one line in ${size.columns} columns`, async ({ page, context }) => {
        await open(page, context, size);
        for (const group of ['basics-water-label', 'basics-sewer-label']) {
            const result = await page.locator(`[aria-labelledby="${group}"]`).evaluate(grid => ({
                columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
                lines: [...grid.querySelectorAll('button span.font-medium')].map(label =>
                    Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight))),
                labels: [...grid.querySelectorAll('button span.font-medium')].map(label => label.textContent),
            }));
            expect(result.columns).toBe(size.columns);
            expect(result.labels).toContain('Paid by HOA');
            expect(result.lines.every(lines => lines === 1)).toBe(true);
        }
    });
}
