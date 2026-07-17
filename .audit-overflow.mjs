import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3789';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const path of ['/', '/pricing', '/demo', '/auth/login', '/auth/signup', '/features', '/faq']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    const r = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
    }));
    console.log(path, r.scrollW > r.clientW ? `OVERFLOW ${r.scrollW}px vs ${r.clientW}px` : 'ok');
}
await browser.close();
