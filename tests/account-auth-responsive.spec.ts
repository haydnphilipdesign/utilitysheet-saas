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
});
