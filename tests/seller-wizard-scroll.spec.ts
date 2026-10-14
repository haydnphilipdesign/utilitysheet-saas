import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// The actual public page, wizard and CSS, with synthetic API responses only.
// This needs a rendered browser: JSDOM cannot reproduce retained page scroll
// hiding a newly selected wizard step behind the fixed header.
const TOKEN = 'synthetic-scroll-regression';
const categories = ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable'];
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
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html><html><head><meta charset="utf-8">
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

test('new steps start below the fixed header after forward and back navigation', async ({ page, context }) => {
    const errors: string[] = [];
    const unexpected: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
            unexpected.push(url.origin);
            await route.abort();
        } else if (url.pathname === `/api/seller/${TOKEN}`) {
            await route.fulfill({ json: {
                request: {
                    property_address: '12 Synthetic Street, Faketown, PA 18301',
                    // Ensure the welcome button requires scrolling on every viewport.
                    seller_intro: 'Please gather any utility details you have available. '.repeat(30),
                    utility_categories: categories, collect_hoa_questions: true,
                    collect_electric_meter_number: false, packet_mode: 'advanced',
                    advanced_modules: ['lawn_exterior', 'irrigation_seasonal_controls', 'mailbox_access', 'smart_home_security', 'service_providers'],
                },
                suggestions: Object.fromEntries(categories.map(category => [category, []])),
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

    const expectStepAtTop = async (title: string) => {
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await expect.poll(() => page.getByRole('heading', { name: title, exact: true }).evaluate(heading => {
            const header = document.querySelector('header')!;
            return heading.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
        })).toBeGreaterThanOrEqual(0);
    };

    await page.goto(`${origin}/s/${TOKEN}`);
    const start = page.getByTestId('seller-welcome-continue');
    await start.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await start.click();
    await expectStepAtTop('Home Basics');

    await page.getByTestId('has-hoa-no').click();
    await page.getByRole('button', { name: /^Public Water/ }).click();
    await page.getByRole('button', { name: /^Public Sewer/ }).click();
    // Editing a choice on the same step should preserve the reader's position.
    await page.getByTestId('advanced-group-mailbox_access').click();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expectStepAtTop('Electric Provider');
    await page.getByTestId('seller-utility-skip-electric').click();
    await expectStepAtTop('Water Provider');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expectStepAtTop('Electric Provider');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expectStepAtTop('Home Basics');
    await expect(page.getByRole('button', { name: /^Public Water/ })).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
});
