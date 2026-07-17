import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3789';
const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const pages = [
    ['landing', '/'],
    ['pricing', '/pricing'],
    ['login', '/auth/login'],
    ['signup', '/auth/signup'],
    ['demo', '/demo'],
];

const viewports = [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
];

const browser = await chromium.launch();
for (const [scheme] of [['light'], ['dark']]) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    for (const [vpName, vp] of viewports) {
        const page = await ctx.newPage();
        await page.setViewportSize(vp);
        for (const [name, path] of pages) {
            try {
                await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
                // next-themes: force theme to match
                await page.evaluate((s) => {
                    localStorage.setItem('theme', s);
                }, scheme);
                await page.reload({ waitUntil: 'networkidle' });
                await page.waitForTimeout(800);
                await page.screenshot({ path: `${OUT}/${name}-${scheme}-${vpName}.png`, fullPage: name === 'landing' || name === 'pricing' });
                console.log('ok', name, scheme, vpName);
            } catch (e) {
                console.log('FAIL', name, scheme, vpName, e.message);
            }
        }
        await page.close();
    }
    await ctx.close();
}
await browser.close();
