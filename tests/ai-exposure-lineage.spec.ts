import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { sellerObservationBodySchema } from '../lib/validation/schemas';

let server: Server, origin: string;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TOKEN = 'synthetic-lineage-capability';
const INITIAL = id(2), REMOTE = id(3), EMPTY = id(4), CANCELED = id(5);
test.beforeAll(async () => {
    const bundle = await build({ entryPoints: ['tests/fixtures/ai-exposure-lineage-harness.tsx'],bundle: true,write: false,
        platform: 'browser',format: 'iife',jsx: 'automatic',define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': process.cwd(),'next/link': path.resolve('tests/fixtures/seller-observation-link.tsx') } });
    const css = (await postcss([tailwind()]).process(await readFile('app/globals.css','utf8'),{ from: path.resolve('app/globals.css') })).css;
    server = createServer((req,res) => {
        if (req.url==='/bundle.js') { res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text); }
        else { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`); }
    });
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const address = server.address(); if (!address || typeof address==='string') throw new Error('No fixture port');
    origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); });

type Event = Record<string,unknown> & { type: string;exposure_id?: string;rendered_item_ids?: string[] };
async function fixture(context: BrowserContext,page: Page,blocked = false) {
    const events: Event[] = [], submissions: Record<string,unknown>[] = [], errors: string[] = [], unexpected: string[] = [];
    let slowStarted = false; let release: (() => void) | undefined;
    page.on('pageerror',error => errors.push(error.message));
    await context.route('**/*',async route => {
        const request = route.request(), url = new URL(request.url()), api = `/api/seller/${TOKEN}`;
        if (url.origin!==origin) { unexpected.push(url.origin);await route.abort(); }
        else if (url.pathname===`${api}/observations`) {
            const body = JSON.parse(request.postData()!);
            expect(sellerObservationBodySchema.safeParse(body).success).toBe(true);
            expect(Buffer.byteLength(request.postData()!)).toBeLessThanOrEqual(8192);
            events.push(...body.events);
            if (blocked) await route.abort(); else await route.fulfill({ status: 202,json: { ok: true } });
        } else if (url.pathname===`${api}/suggestions`) {
            await route.fulfill({ json: { suggestions: { water: [] },exposures: { water: { exposure_id: EMPTY,run_id: null } } } });
        } else if (url.pathname===`${api}/suggestions/search`) {
            const query = url.searchParams.get('query');
            if (query==='slow') { slowStarted=true; await new Promise<void>(resolve => { release=resolve; }); }
            const exposure = query==='slow' ? CANCELED : REMOTE;
            const results = [
                { display_name: 'Fixture Electric',confidence: 0.9,ai_lineage: { run_id: id(21),exposure_id: exposure,item_id: id(22) } },
                { display_name: 'Fixture Remote Power',confidence: 0.9,ai_lineage: { run_id: id(21),exposure_id: exposure,item_id: id(23) } },
            ];
            try { await route.fulfill({ json: { results,exposure: { exposure_id: exposure,run_id: id(21) } } }); } catch { /* canceled requests need no acknowledgment */ }
        } else if (url.pathname===api && request.method()==='POST') {
            submissions.push(JSON.parse(request.postData()!));await route.fulfill({ json: { success: true } });
        } else if (request.isNavigationRequest() || url.pathname==='/bundle.js') await route.continue();
        else if (request.resourceType()==='image') await route.fulfill({ status: 204 });
        else { unexpected.push(url.pathname);await route.abort(); }
    });
    return { events,submissions,errors,unexpected,slowStarted: () => slowStarted,release: () => release?.() };
}
async function start(page: Page) {
    await page.goto(`${origin}/s/${TOKEN}`);
    await page.getByRole('button',{ name: /get started/i }).click();
    await page.getByRole('button',{ name: /public water/i }).click();
    await page.getByRole('button',{ name: /septic system/i }).click();
    await page.getByRole('button',{ name: /^continue$/i }).click();
    await expect(page.getByRole('button',{ name: 'Fixture Electric',exact: true })).toBeVisible();
}
async function finish(page: Page) {
    await expect(page.getByRole('button',{ name: /search providers/i })).toBeVisible();
    await page.getByRole('button',{ name: /search providers/i }).click();
    await page.getByTestId('seller-provider-search-input').fill('Typed Water Sentinel');
    await page.getByTestId('seller-provider-use-typed').click();
    await expect(page.getByRole('heading',{ name: 'Review and Submit' })).toBeVisible();
    await page.getByRole('button',{ name: /submit/i }).click();
    await expect(page.getByRole('heading',{ name: /all done|thank you|submitted/i })).toBeVisible();
}
test('acknowledges top-three, filtered initial and deduplicated remote memberships; draft reload keeps the selected origin',async ({ page,context },testInfo) => {
    const f = await fixture(context,page);
    await start(page);
    await expect.poll(() => f.events.some(e => e.exposure_id===INITIAL)).toBe(true);
    expect(f.events.find(e => e.exposure_id===INITIAL)?.rendered_item_ids).toEqual([id(11),id(12),id(13)]);
    await page.screenshot({ path: testInfo.outputPath('initial.png'),fullPage: true });
    await page.getByRole('button',{ name: /search for another/i }).click();
    await page.getByTestId('seller-provider-search-input').fill('Fourth');
    await expect(page.getByRole('button',{ name: 'Fixture Fourth Utility',exact: true })).toBeVisible();
    await expect.poll(() => f.events.some(e => e.exposure_id===INITIAL && e.rendered_item_ids?.length===1 && e.rendered_item_ids[0]===id(14))).toBe(true);
    await page.getByTestId('seller-provider-search-input').fill('Fixture');
    await page.getByTestId('seller-provider-search-run').click();
    await expect(page.getByRole('button',{ name: 'Fixture Remote Power',exact: true })).toBeVisible();
    await expect.poll(() => f.events.some(e => e.exposure_id===REMOTE)).toBe(true);
    expect(f.events.filter(e => e.exposure_id===REMOTE).every(e => JSON.stringify(e.rendered_item_ids)===JSON.stringify([id(23)]))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('search.png'),fullPage: true });
    await page.getByRole('button',{ name: 'Fixture Remote Power',exact: true }).click();
    await expect.poll(() => page.evaluate(() => {
        const raw=localStorage.getItem('us_seller_draft:synthetic-lineage-capability');
        return raw ? JSON.parse(raw).state.utilities.electric?.ai_lineage?.exposure_id : null;
    })).toBe(REMOTE);
    await page.reload();
    await finish(page);
    expect(f.submissions).toHaveLength(1);
    const utilities = f.submissions[0].utilities as Record<string,Record<string,unknown>>;
    expect(utilities.electric.ai_lineage).toEqual({ exposure_id: REMOTE,run_id: id(21),item_id: id(23) });
    expect(utilities.water.ai_lineage).toBeUndefined();
    expect(f.events.some(e => e.exposure_id===EMPTY && e.rendered_item_ids?.length===0)).toBe(true);
    for (const sentinel of [TOKEN,'Fixture Electric','Typed Water Sentinel','12 Fixture Street']) expect(JSON.stringify(f.events)).not.toContain(sentinel);
    expect(f.errors).toEqual([]);expect(f.unexpected).toEqual([]);
});
test('canceled searches never acknowledge an old exposure and a blocked collector cannot gate submission',async ({ page,context }) => {
    const f = await fixture(context,page,true);await start(page);
    await page.getByRole('button',{ name: /search for another/i }).click();
    await page.getByTestId('seller-provider-search-input').fill('slow');
    await page.getByTestId('seller-provider-search-run').click();
    await expect.poll(f.slowStarted).toBe(true);
    await page.getByTestId('seller-provider-search-input').fill('Fixture');
    await page.getByTestId('seller-provider-search-run').click();
    await expect(page.getByRole('button',{ name: 'Fixture Remote Power',exact: true })).toBeVisible();
    f.release();
    await page.getByRole('button',{ name: 'Fixture Remote Power',exact: true }).click();
    await finish(page);
    expect(f.submissions).toHaveLength(1);expect(f.events.some(e => e.exposure_id===CANCELED)).toBe(false);
    expect(f.errors).toEqual([]);expect(f.unexpected).toEqual([]);
});
