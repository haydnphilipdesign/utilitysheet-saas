import { defineConfig, devices } from '@playwright/test';

// Isolated browser bundle: no Next server, auth, DB or real collector scripts.
export default defineConfig({
    testDir: '.', testMatch: ['telemetry-boundaries.spec.ts', 'seller-observations.spec.ts', 'seller-wizard-scroll.spec.ts', 'ops-coverage.spec.ts'], workers: 1,
    reporter: 'list',
    projects: [
        { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 14'], browserName: 'webkit' } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    ],
});
