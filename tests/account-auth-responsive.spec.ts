import { expect, test } from '@playwright/test';

test.describe('configured authentication surfaces', () => {
  test('login shows configured auth methods without horizontal overflow', async ({ page, request }) => {
    const configResponse = await request.get('/api/auth/config');
    expect(configResponse.ok()).toBe(true);
    const config = (await configResponse.json()) as { oauthProviderIds: string[] };

    await page.goto('/auth/login');

    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    if (config.oauthProviderIds.includes('google')) {
      await expect(page.getByTestId('login-google')).toBeVisible();
    } else {
      await expect(page.getByTestId('login-google')).toHaveCount(0);
    }

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  });

  test('signup shows configured auth methods without horizontal overflow', async ({ page, request }) => {
    const configResponse = await request.get('/api/auth/config');
    expect(configResponse.ok()).toBe(true);
    const config = (await configResponse.json()) as { oauthProviderIds: string[] };

    await page.goto('/auth/signup');

    await expect(page.getByTestId('signup-form')).toBeVisible();
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    if (config.oauthProviderIds.includes('google')) {
      await expect(page.getByTestId('signup-google')).toBeVisible();
    } else {
      await expect(page.getByTestId('signup-google')).toHaveCount(0);
    }

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  });

  test('"Start Teams" on pricing leads to a sign-up that says Teams comes next', async ({ page }, testInfo) => {
    await page.goto('/pricing');

    await expect(page.getByText('Org-wide packet defaults')).toHaveCount(0);
    await expect(page.getByText('Branding Profiles shared by the whole team')).toBeVisible();
    const cta = page.getByTestId('pricing-teams-cta');
    await expect(cta).toHaveAttribute('href', '/auth/signup?plan=teams');
    await cta.click();

    await expect(page.getByRole('heading', { name: 'Create an account to start Teams' })).toBeVisible();
    await expect(page.getByText('Next you’ll choose how many seats you need and start Teams.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
      'href',
      '/auth/login?next=%2Fdashboard%2Fsettings%3Ftab%3Dbilling%26plan%3Dteams',
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('signup-for-teams.png'), fullPage: true });
  });
});
