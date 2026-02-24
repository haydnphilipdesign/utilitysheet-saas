import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD;

test.describe('Admin Users Pagination Smoke', () => {
    test('navigates to page 2 when available', async ({ page }) => {
        test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD to run admin smoke tests.');

        await page.goto('/auth/login?next=/admin/users');
        await page.getByLabel('Email').fill(ADMIN_EMAIL!);
        await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
        await page.getByTestId('login-submit').click();

        await page.waitForURL('**/admin/users**', { timeout: 30_000 });
        await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();

        const summaryText = (await page.locator('text=/Showing page \\d+ of \\d+/').first().textContent()) || '';
        const match = summaryText.match(/Showing page (\d+) of (\d+)/);
        const totalPages = match ? Number(match[2]) : 1;
        test.skip(totalPages < 2, 'Seed at least two pages of user records to validate page-2 navigation.');

        await page.getByRole('link', { name: 'Next page' }).click();
        await expect(page).toHaveURL(/\/admin\/users\?.*page=2/);
    });
});
