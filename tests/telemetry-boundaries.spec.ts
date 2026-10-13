import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import path from 'node:path';

let server: Server;
let origin: string;
test.beforeAll(async () => {
    const bundle = await build({
        entryPoints: ['tests/fixtures/telemetry-harness.tsx'], bundle: true, write: false,
        platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: { '@': process.cwd(), 'next/navigation.js': path.resolve('tests/fixtures/telemetry-navigation.ts') },
    });
    server = createServer((req, res) => {
        if (req.url === '/bundle.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(bundle.outputFiles[0].text);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end('<div id="root"></div><script src="/bundle.js"></script>');
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local harness port');
    origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

// Synthetic collector scripts consume the installed SDK queues, apply its
// registered hooks and emit beacons. All scripts and POSTs are intercepted.
const collectorScript = (kind: 'analytics' | 'speed') => `(() => {
    const name = ${JSON.stringify(kind === 'analytics' ? 'va' : 'si')};
    let hook;
    const emit = (type, payload) => {
        const filtered = hook?.({type, url: location.href, route: location.pathname, referrer: 'synthetic-private-referrer'});
        if (filtered) navigator.sendBeacon('/synthetic-beacon/${kind}', JSON.stringify({ ...filtered, ...payload }));
    };
    const queue = window[name + 'q'] || [];
    window[name] = (action, data) => {
        if (action === 'beforeSend') hook = data;
        if (action === 'event') emit('event', {name: data.name, data: data.data});
    };
    queue.forEach(args => window[name](...args));
    emit(${JSON.stringify(kind === 'analytics' ? 'pageview' : 'vital')});
})();`;

test('intercepts safe pageview, custom event, vital and attribution on a capability URL', async ({ page, context }) => {
    const beacons: Array<Record<string, unknown>> = [];
    const attributions: Array<Record<string, unknown>> = [];
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.includes('/insights/script') || url.hostname === 'va.vercel-scripts.com') {
            await route.fulfill({ contentType: 'application/javascript', body: collectorScript('analytics') });
        } else if (url.pathname.includes('/speed-insights/script')) {
            await route.fulfill({ contentType: 'application/javascript', body: collectorScript('speed') });
        } else if (url.pathname.startsWith('/synthetic-beacon/')) {
            beacons.push(JSON.parse(request.postData()!));
            await route.fulfill({ status: 204 });
        } else if (url.pathname === '/api/growth/attribution') {
            attributions.push(JSON.parse(request.postData()!));
            await route.fulfill({ status: 204 });
        } else if (url.origin === origin && (request.isNavigationRequest() || url.pathname === '/bundle.js')) {
            await route.continue();
        } else {
            unexpected.push(request.url());
            await route.abort();
        }
    });
    await page.goto(`${origin}/s/synthetic-secret?password=synthetic-password&utm_source=facebook&utm_campaign=123%20Sentinel%20Street#private-account`);
    await expect.poll(() => beacons.length).toBe(2);
    await page.getByRole('button', { name: 'Emit synthetic event' }).click();
    await expect.poll(() => beacons.length).toBe(3);
    await expect.poll(() => attributions.length).toBe(1);
    expect(beacons.map(event => event.type).sort()).toEqual(['event', 'pageview', 'vital']);
    for (const beacon of beacons) expect(beacon.url).toBe(`${origin}/s/[token]`);
    expect(beacons.find(event => event.type === 'vital')?.route).toBe('/s/[token]');
    expect(beacons.find(event => event.type === 'event')).toMatchObject({ name: 'seller_step_viewed', data: { step: 'basics', packet_mode: 'simple' } });
    expect(attributions[0]).toMatchObject({ source: 'facebook', campaign: null, landingPath: '/s/[token]' });
    const captured = JSON.stringify({ beacons, attributions });
    for (const sentinel of ['synthetic-secret', 'synthetic-password', '123 Sentinel Street', 'private-account', 'synthetic-private-referrer']) expect(captured).not.toContain(sentinel);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
});
