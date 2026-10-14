import { test, expect } from '@playwright/test';
import { build, type Plugin } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// Actual server component and UI styles, with only data/auth/triage boundaries
// replaced. No Next server, hosted DB, auth provider, email or collectors.
let server: Server;
let origin: string;
const now = '2026-10-13T12:00:00Z';
const ok = <T,>(data: T) => ({ status: 'ok', data });
function snapshot(state: string) {
    const monitor = { jobName: 'ops_monitor', health: state === 'unavailable' ? 'partial' : state, lastStatus: state === 'stuck' ? 'running' : 'partial',
        firstObservedAt: now, lastStartedAt: now, lastSuccessAt: null, lastDurationMs: 100 };
    return {
        generatedAt: now, incidents: ok({ incidents: [], firstObservationAt: null, lastObservationAt: null, truncated: false }),
        jobs: ok(state === 'unknown' ? [{ ...monitor, health: 'not_observed', lastStatus: null, lastStartedAt: null, firstObservedAt: null }] : [monitor]),
        reminders: ok({ windowDays: 30, accepted: 0, delivered: 0, delayed: 0, bounced: 0, complained: 0, deliveryFailed: 0, deliveryUnknown: 0, notSent: 0, unresolved: [] }),
        followUp: ok({ inactiveRequests: { total: 0, items: [] }, accountsNotStarted: { total: 0, items: [] } }),
        coverage: state === 'unavailable' ? { status: 'error' } : ok([
            { collector: 'ai_runs', lastRecordAt: null }, { collector: 'seller', lastRecordAt: now },
        ]),
    };
}

test.beforeAll(async () => {
    const mocks: Record<string, string> = {
        '@/lib/admin': 'export async function requireAdmin() { return {}; }',
        '@/lib/ops/alerts': 'export function getAlertConfig() { return {enabled:false, ai:{sharePct:50,minRuns:10,windowHours:24}}; }',
        '@/lib/ops/triage': 'export async function getTriageRecords() { return new Map(); } export function effectiveTriageState() { return {state:"open",returned:null}; }',
        '@/lib/ops/events': 'export const SCHEDULED_JOBS=["activation_reconcile","activation_reengagement","account_closure_retry","ops_monitor"]; export function getOpsRetentionDays(){return 90;}',
        '@/lib/neon/statements': 'export function getStatementExecutor(){throw new Error("Fixture forbids DB access");} export function isMissingRelationError(){return false;}',
        '@/lib/telemetry/retention': 'export async function loadRetentionStatus(){return {status:"ok",data:{mode:"off",plan:[],lastRun:null}};}',
        '@/components/admin/TriageControls': 'export function TriageControls(){return null;}',
        'next/link': 'import React from "react"; export default function Link(props){return React.createElement("a",props);}',
    };
    const plugin: Plugin = { name: 'isolated-operations', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
        builder.onLoad({ filter: /lib[\\/]ops[\\/]overview\.ts$/ }, async args => ({
            contents: (await readFile(args.path, 'utf8')).replace('export async function getOperationsSnapshot(', 'async function unusedOperationsSnapshot(')
                + '\nexport async function getOperationsSnapshot() { return globalThis.__operationsFixture; }',
            loader: 'ts', resolveDir: path.dirname(args.path),
        }));
    } };
    const artifact = path.resolve('test-results/ops-coverage-renderer.mjs');
    await mkdir(path.dirname(artifact), { recursive: true });
    await build({
        stdin: { contents: `import {renderToStaticMarkup} from 'react-dom/server';
            import Page from '@/app/(admin)/admin/operations/page';
            export async function render(snapshot) { globalThis.__operationsFixture=snapshot;
                return renderToStaticMarkup(await Page({searchParams:Promise.resolve({})})); }`, resolveDir: process.cwd(), loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: artifact,
        alias: { '@': process.cwd() }, plugins: [plugin], jsx: 'automatic',
    });
    const renderer = await import(pathToFileURL(artifact).href);
    const css = (await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: path.resolve('app/globals.css') })).css;
    const pages = new Map<string, string>();
    for (const state of ['unknown', 'partial', 'stuck', 'unavailable']) {
        pages.set('/' + state, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main style="max-width:1200px;margin:auto;padding:24px">${await renderer.render(snapshot(state))}</main></body></html>`);
    }
    server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(pages.get(req.url ?? '') ?? 'Missing fixture'); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local fixture port');
    origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

test('shows monitor and collector uncertainty across browser sizes without external requests', async ({ page }, testInfo) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        if (route.request().url().startsWith(origin)) return route.continue();
        external.push(route.request().url());
        return route.abort();
    });
    await page.goto(origin + '/unknown');
    await expect(page.getByText('Operations monitor', { exact: true })).toBeVisible();
    await expect(page.getByText('No runs observed yet', { exact: true })).toBeVisible();
    await expect(page.getByText('Never observed in retained records; coverage unknown', { exact: true })).toBeVisible();
    await expect(page.getByText(/do not establish a collection rate/)).toBeVisible();
    await page.goto(origin + '/partial');
    await expect(page.getByText('Finished with some failures', { exact: true })).toBeVisible();
    await expect(page.getByText(/Every 15 minutes.*overdue after 35 minutes/)).toBeVisible();
    await page.goto(origin + '/stuck');
    await expect(page.getByText('Running too long (finish not recorded)', { exact: true })).toBeVisible();
    await page.goto(origin + '/unavailable');
    await expect(page.getByText(/Collector coverage could not be loaded/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('ops-coverage.png'), fullPage: true });
});
