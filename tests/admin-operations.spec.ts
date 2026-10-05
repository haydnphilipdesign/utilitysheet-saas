import { expect, test, type Page } from '@playwright/test';

/**
 * Authenticated Admin browser checks for the operational-readiness work.
 *
 * These run only against an environment you have deliberately prepared: a
 * non-production database with the new migrations applied, a test email key and
 * an Admin test user. See docs/admin-operations-runbook.md section 5.6. They
 * are read-only: no dialog is submitted.
 */
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD;

async function signIn(page: Page, next: string) {
    await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel('Email').fill(ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD!);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(`**${next}**`, { timeout: 30_000 });
}

test.describe('Admin operations', () => {
    test.beforeEach(() => {
        test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD for a safe test environment.');
    });

    test('Issues & Triage is reachable from navigation and separates service issues from follow-up', async ({ page, isMobile }) => {
        await signIn(page, '/admin');

        if (isMobile) await page.getByRole('button', { name: 'Open admin navigation' }).click();
        await page.getByRole('navigation', { name: /admin navigation/i }).getByRole('link', { name: 'Issues & Triage' }).click();
        await expect(page).toHaveURL(/\/admin\/operations/);

        await expect(page.getByRole('heading', { name: 'Operations', level: 1 })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Service issues' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Customer follow-up' })).toBeVisible();
        await expect(page.getByText('What this page can and cannot tell you')).toBeVisible();

        // No horizontal overflow at this viewport.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
    });

    test('overview uses account-based access wording and links to the matching list', async ({ page }) => {
        await signIn(page, '/admin');
        const metric = page.getByRole('link', { name: /Paid-plan access/ });
        await expect(metric).toBeVisible();
        await expect(page.getByText(/accounts, not subscriptions/)).toBeVisible();
        await expect(metric).toHaveAttribute('href', '/admin/users?plan=paying&role=user');
    });

    test('request dialogs are keyboard operable and return focus when dismissed', async ({ page }) => {
        await signIn(page, '/admin/requests');
        const firstRequest = page.locator('a[href^="/admin/requests/"]').first();
        test.skip(await firstRequest.count() === 0, 'Seed at least one request to check the support dialogs.');
        await firstRequest.click();
        await page.waitForURL(/\/admin\/requests\/[0-9a-f-]{36}/);

        const trigger = page.getByRole('button', { name: 'Correct status' });
        test.skip(await trigger.isDisabled(), 'The first request is deleted; controls are intentionally disabled.');
        await trigger.focus();
        await page.keyboard.press('Enter');

        const dialog = page.getByRole('dialog', { name: 'Correct request status' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/does not record a submission/)).toBeVisible();
        // Submitted is never offered as a manual choice for an unmetered request.
        const options = await dialog.getByRole('option').allTextContents();
        if (options.length > 1) expect(options).not.toContain('Submitted');

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
    });
});
