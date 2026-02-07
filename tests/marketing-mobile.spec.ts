import { expect, test } from '@playwright/test';

test('Landing first screen explains product and shows primary CTA on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only first-impression check');

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Stop chasing sellers/i })).toBeVisible();
  await expect(page.getByText(/UtilitySheet gives you a guided seller link workflow/i)).toBeVisible();
  await expect(page.getByTestId('hero-signup-cta')).toBeVisible();
  await expect(page.getByTestId('marketing-header-mobile-signup-cta')).toBeVisible();
});

test('Sticky CTA appears on scroll and can be dismissed on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only sticky CTA behavior');

  await page.goto('/');
  await expect(page.getByTestId('hero-signup-cta')).toBeVisible();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

  await expect(page.getByTestId('sticky-cta-signup')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('sticky-cta-signup')).toBeHidden();
});

test('PDF attachment value prop appears in multiple landing sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/Completion Email \+ PDF Attachment/i)).toBeVisible();
  await expect(page.getByText(/auto-attach the utility sheet PDF to the completion email/i)).toBeVisible();
  await expect(page.getByText(/Optional completion-email PDF attachment/i)).toBeVisible();

  await page.getByRole('button', { name: /Can UtilitySheet auto-attach the PDF/i }).click();
  await expect(page.getByText(/enabled by default and can be changed in Settings/i)).toBeVisible();
});

test('iPad-like layout keeps nav and CTA readable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');

  const header = page.locator('header').first();
  await expect(header.getByRole('link', { name: 'Workflow' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Features' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Pricing' })).toBeVisible();
  await expect(page.getByTestId('marketing-header-signup-cta')).toBeVisible();
});

test('About and Demo top sections communicate value with signup path', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByText(/UtilitySheet helps transaction coordinators collect utility providers/i)).toBeVisible();
  const aboutSummaryHeading = page.getByRole('heading', { name: /What UtilitySheet does/i });
  await aboutSummaryHeading.scrollIntoViewIfNeeded();
  await expect(aboutSummaryHeading).toBeVisible();

  await page.goto('/demo');
  await expect(page.getByText(/After seller submission, TCs can receive a completion email/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Start Free instead/i })).toBeVisible();
});

test('Landing primary and final CTAs remain reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hero-signup-cta')).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 2200, behavior: 'instant' }));
  await expect(page.getByTestId('marketing-final-signup-cta')).toBeVisible();
});
