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

  await addressInput.fill('123 Main St, Austin, TX 78701');
  await page.getByTestId('intake-continue').click();

  await expect(page).toHaveURL(/\/s\/mock-token$/);
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
});

test('nested form link uses its exact metadata/start route and retains address confirmation', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', e => failures.push(e.message));
  let starts = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/intake/jane/forms/start') return json({ accepting: true, sellerIntro: 'Closing introduction', brandProfile: null });
    if (path === '/api/intake/jane/forms/start/start') {
      starts += 1;
      expect(route.request().postDataJSON().propertyAddress).toContain('78701');
      return json({ sellerToken: 'nested-fixture-token' });
    }
    if (path === '/api/seller/nested-fixture-token') return json({ request: { property_address: '123 Main St, Austin, TX 78701', utility_categories: ['electric'], seller_intro: 'Closing introduction' }, suggestions: {}, brandProfile: null });
    return json({}, 404);
  });
  // The suffix "start" must not collide with the original flat start endpoint.
  await page.goto('/i/jane/start');
  await expect(page.getByText('Closing introduction', { exact: true })).toBeVisible();
  await page.getByTestId('intake-address-input').fill('123 Main St');
  await page.getByTestId('intake-continue').click();
  expect(starts).toBe(0);
  await page.getByLabel('City', { exact: true }).fill('Austin');
  await page.getByLabel('State', { exact: true }).selectOption('TX');
  await page.getByLabel('ZIP Code', { exact: true }).fill('78701');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('nested-intake.png'), fullPage: true });
  await page.getByTestId('intake-continue').click();
  await expect(page).toHaveURL(/\/s\/nested-fixture-token$/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  expect(starts).toBe(1);
  expect(failures).toEqual([]);
});

test('Intake address confirms missing fields before submit', async ({ page }) => {
  let startCallCount = 0;

  await page.route('**/api/intake/test-confirm', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accepting: true,
        brandProfile: null,
      }),
    });
  });

  await page.route('**/api/intake/test-confirm/start', async (route) => {
    startCallCount += 1;
    const reqBody = route.request().postDataJSON() as { propertyAddress?: string };
    const address = reqBody.propertyAddress || '';
    const hasZip = /\b\d{5}\b/.test(address);
    if (!hasZip) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Incomplete address',
          message: 'Please include street address, city, state, and ZIP code.',
          missingFields: ['zip'],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sellerToken: 'confirm-token',
      }),
    });
  });

  await page.route('**/api/seller/confirm-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request: {
          property_address: '123 Main St, Austin, TX 78701',
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

  await page.goto('/i/test-confirm');

  await page.getByTestId('intake-address-input').fill('123 Main St, Austin, TX');
  await page.getByTestId('intake-continue').click();

  const confirmCard = page.getByTestId('intake-address-confirm');
  await expect(confirmCard).toBeVisible();
  await expect(page.getByTestId('intake-address-confirm-zip')).toBeVisible();
  await expect(page.getByTestId('intake-address-confirm-zip')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByTestId('intake-address-confirm-zip')).toHaveAttribute('pattern', '[0-9]*');

  await page.getByTestId('intake-address-confirm-zip').fill('78701');
  await page.getByTestId('intake-continue').click();

  expect(startCallCount).toBe(1);
  await expect(page).toHaveURL(/\/s\/confirm-token$/);
});
