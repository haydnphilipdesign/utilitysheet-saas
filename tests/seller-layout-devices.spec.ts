import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// The actual public page, wizard and CSS, with synthetic API responses only.
// The shared header is sized by CSS for each screen class; this checks its
// height, the content clearance below it, the address and brand contrast on
// real layouts that JSDOM cannot compute.
const TOKEN = 'synthetic-layout-devices';
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
            // ?dark stands in for next-themes, which puts the class on <html>.
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

async function routeSeller(context: BrowserContext, primaryColor: string | null, unexpected: string[]) {
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
            unexpected.push(url.origin);
            await route.abort();
        } else if (url.pathname === `/api/seller/${TOKEN}`) {
            await route.fulfill({ json: {
                request: {
                    property_address: ADDRESS, utility_categories: categories, collect_hoa_questions: true,
                    collect_electric_meter_number: false, packet_mode: 'simple', advanced_modules: [],
                },
                suggestions: Object.fromEntries(categories.map(category => [category, []])),
                brandProfile: { name: 'Synthetic Realty', primary_color: primaryColor, contact_email: 'help@example.com' },
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
            unexpected.push(url.pathname);
            await route.abort();
        }
    });
}

const headerHeight = (page: Page) => page.evaluate(() => document.querySelector('header')!.getBoundingClientRect().height);

const expectStepClearOfHeader = async (page: Page, title: string) => {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect.poll(() => page.getByRole('heading', { name: title, exact: true }).evaluate(heading =>
        heading.getBoundingClientRect().top - document.querySelector('header')!.getBoundingClientRect().bottom
    )).toBeGreaterThanOrEqual(8);
};

// Contrast of an element's text against its composited background, as rendered.
const contrastOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string) => {
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top: number[], bottom: number[]) => top.slice(0, 3).map((v, i) => v * top[3] + bottom[i] * (1 - top[3])).concat(1);
    const layers: number[][] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 1) break;
    }
    let background = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i -= 1) background = over(layers[i], background);
    const text = over(rgba(getComputedStyle(el).color), background);
    const luminance = (c: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const [hi, lo] = [luminance(text), luminance(background)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
});

const SCREENS = [
    { name: 'small phone', width: 320, height: 568, maxHeader: 100 },
    { name: 'landscape phone', width: 844, height: 390, maxHeader: 64 },
    { name: 'small landscape phone', width: 568, height: 320, maxHeader: 64 },
    { name: 'laptop', width: 1280, height: 720, maxHeader: 113 },
];

for (const screenSize of SCREENS) {
    test(`header fits the ${screenSize.name} and steps start below it`, async ({ page, context }) => {
        const errors: string[] = [];
        const unexpected: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await routeSeller(context, '#10b981', unexpected);
        await page.setViewportSize({ width: screenSize.width, height: screenSize.height });
        await page.goto(`${origin}/s/${TOKEN}`);
        await page.getByTestId('seller-welcome-continue').click();
        await expectStepClearOfHeader(page, 'Home Basics');
        expect(await headerHeight(page)).toBeLessThanOrEqual(screenSize.maxHeader);

        // The property stays on screen in full where there is room, and in the title otherwise.
        const address = page.locator(screenSize.width < 640 ? '[data-testid="seller-header-address"]' : '[data-testid="seller-header-address-wide"]');
        await expect(address).toBeVisible();
        await expect(address).toHaveAttribute('title', ADDRESS);
        if (screenSize.width >= 640) {
            expect(await address.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        await expect(page.getByRole('progressbar', { name: 'Form progress' })).toHaveAttribute('aria-valuenow', '18');

        await page.getByTestId('has-hoa-no').click();
        await page.getByRole('button', { name: /^Public Water/ }).click();
        await page.getByRole('button', { name: /^Public Sewer/ }).click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expectStepClearOfHeader(page, 'Electric Provider');
        await expect(page.getByTestId('seller-step-announcement')).toHaveText('Electric Provider, step 2 of 5');
        expect(await headerHeight(page)).toBeLessThanOrEqual(screenSize.maxHeader);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        expect(errors).toEqual([]);
        expect(unexpected).toEqual([]);
    });
}

for (const brand of [
    // No stored color: the product default (the app's slate-blue primary).
    { name: 'product default', color: null, dark: false },
    { name: 'product default in dark mode', color: null, dark: true },
    // Emerald was the default before 2026-10-14 and many profiles still store it.
    { name: 'emerald', color: '#10b981', dark: false },
    { name: 'light yellow', color: '#facc15', dark: false },
    { name: 'navy in dark mode', color: '#1e3a8a', dark: true },
]) {
    test(`brand text meets WCAG AA contrast: ${brand.name}`, async ({ page, context }) => {
        const unexpected: string[] = [];
        await routeSeller(context, brand.color, unexpected);
        await page.goto(`${origin}/s/${TOKEN}${brand.dark ? '?dark=1' : ''}`);
        expect(await contrastOf(page, '[data-testid="seller-welcome-continue"] span')).toBeGreaterThanOrEqual(4.5);
        await page.getByTestId('seller-welcome-continue').click();
        await expect(page.getByRole('heading', { name: 'Home Basics', exact: true })).toBeVisible();
        await page.getByTestId('has-hoa-yes').click();
        // Accent question label, a selected tile and the primary button.
        expect(await contrastOf(page, '#basics-water-label')).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOf(page, '[data-testid="has-hoa-yes"] span')).toBeGreaterThanOrEqual(4.5);
        await page.getByRole('button', { name: /^Public Water/ }).click();
        await page.getByRole('button', { name: /^Public Sewer/ }).click();
        const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
        await expect(continueButton).toBeEnabled();
        expect(await contrastOf(page, 'main button:text-is("Continue")')).toBeGreaterThanOrEqual(4.5);
        expect(unexpected).toEqual([]);
    });
}
