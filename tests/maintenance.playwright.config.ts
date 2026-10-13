import { defineConfig, devices } from '@playwright/test';

// Isolated browser bundle: no Next server, auth, DB, limiter, email or provider.
export default defineConfig({
    testDir: '.', testMatch: ['maintenance.spec.ts'], workers: 1,
    reporter: 'list',
    projects: [
        { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 14'], browserName: 'webkit' } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    ],
});
