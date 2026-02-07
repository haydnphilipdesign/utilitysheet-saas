import { expect, test } from '@playwright/test';

test('Packet page exposes contact actions on mobile and desktop', async ({ page }, testInfo) => {
  await page.route('**/api/packet/test-packet', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request: {
          property_address: '42 Palm Ave, Miami, FL',
          created_at: new Date().toISOString(),
        },
        brand: {
          name: 'UtilitySheet',
          contact_email: 'team@example.com',
          contact_phone: '(555) 123-9999',
          contact_website: 'https://example.com',
          primary_color: '#10b981',
        },
        utilities: [
          {
            category: 'electric',
            provider_name: 'Florida Power',
            provider_phone: '(555) 123-4567',
            provider_website: 'https://power.example.com',
          },
        ],
      }),
    });
  });

  await page.goto('/packet/test-packet');

  await expect(page.getByTestId('packet-copy-link')).toBeVisible();
  await expect(page.getByTestId('packet-download-pdf')).toBeVisible();

  const visibleWebsiteLink = page.locator('a:visible', { hasText: 'Website' }).first();

  if (testInfo.project.name === 'Desktop Chrome') {
    await expect(visibleWebsiteLink).toBeVisible();
  } else {
    await expect(page.locator('a:visible', { hasText: 'Call' }).first()).toBeVisible();
    await expect(visibleWebsiteLink).toBeVisible();
  }
});
