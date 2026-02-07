import { expect, test } from '@playwright/test';

test('Intake address input is mobile-safe and transitions into seller flow', async ({ page }, testInfo) => {
  await page.route('**/api/intake/test-mobile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accepting: true,
        brandProfile: null,
      }),
    });
  });

  await page.route('**/api/intake/test-mobile/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sellerToken: 'mock-token',
      }),
    });
  });

  await page.route('**/api/seller/mock-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request: {
          property_address: '123 Main St, Austin, TX',
          utility_categories: ['electric', 'water', 'gas'],
        },
        suggestions: {
          electric: [{ display_name: 'Austin Energy' }],
          water: [],
          gas: [],
        },
        brandProfile: null,
      }),
    });
  });

  await page.goto('/i/test-mobile');

  const addressInput = page.getByTestId('intake-address-input');
  await expect(addressInput).toBeVisible();

  const fontSize = await addressInput.evaluate((node) =>
    Number.parseFloat(window.getComputedStyle(node).fontSize)
  );
  if (testInfo.project.name === 'Desktop Chrome') {
    expect(fontSize).toBeGreaterThanOrEqual(14);
  } else {
    expect(fontSize).toBeGreaterThanOrEqual(16);
  }

  await addressInput.fill('123 Main St, Austin, TX');
  await page.getByTestId('intake-continue').click();

  await expect(page).toHaveURL(/\/s\/mock-token$/);
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
});
