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

test('Packet page shows the HOA answer and association details without overflowing', async ({ page }) => {
  await page.route('**/api/packet/test-packet-hoa', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        request: {
          property_address: '42 Palm Ave, Miami, FL',
          created_at: new Date().toISOString(),
          water_source: 'hoa',
          sewer_type: 'public',
          heating_type: 'electric',
          has_hoa: 'yes',
          hoa_name: 'Palm Avenue Condominium Association',
          hoa_management_company: 'Crest Property Management',
          hoa_management_contact: 'Jordan Lee',
          hoa_management_phone: '(555) 204-8890',
          hoa_management_email: 'a-very-long-management-office-address@palm-avenue-condominiums.example',
          hoa_dues_amount: '$240',
          hoa_dues_frequency: 'quarterly',
          hoa_portal_or_payment: 'https://portal.palm-avenue-condominiums.example/residents/payments-and-documents',
        },
        brand: { name: 'UtilitySheet', primary_color: '#10b981' },
        utilities: [{ category: 'electric', provider_name: 'Florida Power' }],
      }),
    });
  });

  await page.goto('/packet/test-packet-hoa');

  await expect(page.getByText('HOA / Condo Association', { exact: true })).toBeVisible();
  const details = page.getByTestId('packet-hoa-details');
  await expect(details.getByText('Palm Avenue Condominium Association')).toBeVisible();
  await expect(details.getByText('$240 per quarter')).toBeVisible();
  await expect(page.getByText('Included in HOA / Condo Fee')).toBeVisible();

  // Long unbroken email and portal values must wrap inside the card on a phone.
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflows).toBe(false);
});
