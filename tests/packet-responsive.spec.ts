import { expect, test } from '@playwright/test';
import { ADVANCED_MODULE_LABELS, getAdvancedAnswerRows } from '../lib/packet/modules';
import type { AdvancedModuleKey } from '../types';

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

test('Packet page prints handoff answers the way the seller Review step shows them', async ({ page }) => {
  // The packet API builds these rows with the same function, so the mock does too.
  const section = (moduleKey: AdvancedModuleKey, answers: Record<string, unknown>) => ({
    key: moduleKey,
    title: ADVANCED_MODULE_LABELS[moduleKey],
    fields: getAdvancedAnswerRows(moduleKey, answers),
  });

  await page.route('**/api/packet/test-packet-handoff', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'advanced',
        request: {
          property_address: '42 Palm Ave, Miami, FL',
          created_at: new Date().toISOString(),
        },
        brand: { name: 'UtilitySheet', primary_color: '#10b981' },
        utilities: [{ category: 'electric', provider_name: 'Florida Power' }],
        advanced_sections: [
          section('irrigation_seasonal_controls', {
            has_irrigation_system: 'not_sure',
            irrigation_provider_name: 'BlueSprinkler Co.',
            irrigation_provider_phone: '(555) 222-3344',
            watering_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            irrigation_season_start_month: 'feb',
            irrigation_season_end_month: 'sep',
            irrigation_notes: 'mon',
          }),
          section('mailbox_access', { mailbox_number: 'no', garage_door_code: '0420' }),
        ],
      }),
    });
  });

  await page.goto('/packet/test-packet-handoff');

  const row = (label: string) => page.locator('div', { hasText: new RegExp(`^${label}: `) }).last();
  await expect(row('Has Irrigation System')).toHaveText('Has Irrigation System: Not sure');
  await expect(row('Watering Days')).toHaveText('Watering Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun');
  await expect(row('Season Start Month')).toHaveText('Season Start Month: February');
  await expect(row('Season End Month')).toHaveText('Season End Month: September');
  // Typed text is left alone even when it looks like a code.
  await expect(row('Irrigation Notes')).toHaveText('Irrigation Notes: mon');
  await expect(row('Mailbox Number')).toHaveText('Mailbox Number: no');
  await expect(row('Garage Door Code')).toHaveText('Garage Door Code: 0420');
  await expect(row('Irrigation Phone')).toHaveText('Irrigation Phone: (555) 222-3344');

  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflows).toBe(false);
});
