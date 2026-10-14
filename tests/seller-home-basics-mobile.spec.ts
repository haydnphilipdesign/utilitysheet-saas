import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// The actual public page, wizard and CSS, with synthetic API responses only.
// Home Basics with every optional section configured: required questions in
// full, optional extras behind summary rows, and the answers inside them kept
// through a draft reload, Review edits and submission.
const TOKEN = 'synthetic-home-basics-regression';
const categories = ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable'];
// Continue's bottom edge, in viewport heights. Before the summary rows this
// form measured 3.7 on iPhone 14 and 3.1 on desktop after an HOA Yes.
const CONTINUE_SCREEN_BUDGET = 2.6;
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

const expectStepAtTop = async (page: Page, title: string) => {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect.poll(() => page.getByRole('heading', { name: title, exact: true }).evaluate(heading => {
        const header = document.querySelector('header')!;
        return heading.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(0);
};

test('optional extras stay one tap away and keep their answers through the journey', async ({ page, context }) => {
    const errors: string[] = [];
    const unexpected: string[] = [];
    const submissions: Record<string, unknown>[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
            unexpected.push(url.origin);
            await route.abort();
        } else if (url.pathname === `/api/seller/${TOKEN}` && request.method() === 'POST') {
            submissions.push(JSON.parse(request.postData() || '{}'));
            await route.fulfill({ json: { success: true } });
        } else if (url.pathname === `/api/seller/${TOKEN}`) {
            await route.fulfill({ json: {
                request: {
                    property_address: '12 Synthetic Street, Faketown, PA 18301',
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

    await page.goto(`${origin}/s/${TOKEN}`);
    await page.getByTestId('seller-welcome-continue').click();
    await expectStepAtTop(page, 'Home Basics');

    const hoaToggle = page.getByTestId('hoa-details-toggle');
    const handoffToggle = page.getByTestId('basics-handoff-toggle');
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(page.getByText('Required', { exact: true })).toHaveCount(2);

    // An HOA Yes and two fuels: the heaviest Home Basics this request can show.
    await page.getByTestId('has-hoa-yes').click();
    await page.getByRole('button', { name: 'Natural Gas', exact: true }).click();
    await page.getByRole('button', { name: 'Electric', exact: true }).click();
    await expect(hoaToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Association Name')).toHaveCount(0);
    await expect(handoffToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(handoffToggle).toContainText('All 4 included');
    const continueScreens = await continueButton.evaluate(button =>
        (button.getBoundingClientRect().bottom + window.scrollY) / window.innerHeight);
    expect(continueScreens).toBeLessThanOrEqual(CONTINUE_SCREEN_BUDGET);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

    // Keyboard: the summary row opens with Enter and Tab moves into its fields.
    await hoaToggle.focus();
    await page.keyboard.press('Enter');
    await expect(hoaToggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Association Name')).toBeFocused();
    await page.keyboard.type('Lakeview Commons HOA');
    await page.getByTestId('hoa-dues-frequency-quarterly').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await hoaToggle.click();
    await expect(hoaToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(hoaToggle).toContainText('2 of 8 added');

    // Required answers still gate Continue, with the same explanation.
    await expect(continueButton).toBeDisabled();
    await expect(page.getByText('Choose a water and sewer option above to continue.')).toBeVisible();
    await page.getByRole('button', { name: /^Private Well/ }).click();
    await page.getByRole('button', { name: /^Septic System/ }).click();
    await expect(continueButton).toBeEnabled();

    await handoffToggle.click();
    await page.getByTestId('advanced-group-mailbox_access').click();
    await expect(page.getByTestId('advanced-group-mailbox_access')).toHaveAttribute('aria-pressed', 'false');
    await handoffToggle.click();
    await expect(handoffToggle).toContainText('3 of 4 included');

    // The same-browser draft brings back the answers and opens the details.
    await expect.poll(() => page.evaluate(token => {
        const draft = JSON.parse(localStorage.getItem(`us_seller_draft:${token}`) || 'null');
        return Boolean(draft?.state?.hoa_name && draft.state.sewer_type && !draft.state.advanced_modules.includes('mailbox_access'));
    }, TOKEN)).toBe(true);
    await page.reload();
    await expectStepAtTop(page, 'Home Basics');
    await expect(hoaToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Association Name')).toHaveValue('Lakeview Commons HOA');
    await expect(page.getByTestId('hoa-dues-frequency-quarterly')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Private Well/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(handoffToggle).toContainText('3 of 4 included');

    await continueButton.click();
    await expectStepAtTop(page, 'Electric Provider');
    await page.getByTestId('seller-utility-skip-electric').click();
    await page.getByTestId('seller-utility-skip-gas').click();
    await page.getByTestId('seller-utility-no-service-trash').click();
    // Mailbox & Home Access was skipped, so four handoff pages remain.
    for (let section = 0; section < 4; section += 1) {
        await expect(page.getByTestId('advanced-continue')).toBeVisible();
        await page.getByTestId('advanced-continue').click();
    }
    await expectStepAtTop(page, 'Review and Submit');
    await expect(page.getByTestId('review-hoa')).toContainText('Lakeview Commons HOA');

    // Editing Home Basics from Review shows the details open and returns.
    await page.getByRole('button', { name: 'Edit Home Basics' }).click();
    await expectStepAtTop(page, 'Home Basics');
    await expect(hoaToggle).toHaveAttribute('aria-expanded', 'true');
    await page.getByLabel('Dues').fill('$240');
    await continueButton.click();
    await expectStepAtTop(page, 'Review and Submit');
    await expect(page.getByTestId('review-hoa')).toContainText('$240 per quarter');

    await page.getByRole('button', { name: /^Submit/ }).click();
    await expect(page.getByRole('heading', { name: 'All Done!' })).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
        has_hoa: 'yes',
        hoa_name: 'Lakeview Commons HOA',
        hoa_dues_amount: '$240',
        hoa_dues_frequency: 'quarterly',
        water_source: 'well',
        sewer_type: 'septic',
        fuels_present: ['natural_gas', 'electric'],
        advanced_modules: ['lawn_exterior', 'irrigation_seasonal_controls', 'smart_home_security', 'service_providers'],
    });
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
});
