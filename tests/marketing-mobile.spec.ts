import { expect, test } from '@playwright/test';

test('Landing primary and final CTAs are reachable', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('hero-signup-cta')).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'instant' }));
  await expect(page.getByTestId('marketing-final-signup-cta')).toBeVisible();
});
