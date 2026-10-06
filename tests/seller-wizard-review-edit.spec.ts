import { test, expect } from '@playwright/test';

/**
 * Revisiting answers in the seller wizard with mocked APIs: an edit from Review
 * returns to Review, a Home Basics edit only asks about what it added, an
 * irrigation "No" hides its details, and phone-size controls stay usable.
 */

const TOKEN = 'review-edit-token-123';

const REQUEST_RESPONSE = {
    request: {
        property_address: '456 Verification Way, Easton, PA 18040',
        utility_categories: ['electric', 'water', 'internet'],
        collect_electric_meter_number: true,
        collect_hoa_questions: false,
        packet_mode: 'advanced',
        advanced_modules: ['irrigation_seasonal_controls', 'mailbox_access'],
        advanced_module_exclusions: {},
        advanced_packet_data: {},
    },
    suggestions: {
        electric: [
            { display_name: 'PPL Electric Utilities', confidence: 0.9 },
            { display_name: 'Met-Ed', confidence: 0.8 },
        ],
        water: [{ display_name: 'Easton Suburban Water Authority', confidence: 0.9 }],
        internet: [{ display_name: 'Service Electric', confidence: 0.9 }],
    },
};

test.describe('Seller wizard: revisiting answers', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/**', async (route) => {
            const isSellerRequest = new URL(route.request().url()).pathname === `/api/seller/${TOKEN}`;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(isSellerRequest && route.request().method() === 'GET' ? REQUEST_RESPONSE : { success: true }),
            });
        });
    });

    test('edits return to Review and contradictory irrigation details are hidden', async ({ page }) => {
        await page.goto(`/s/${TOKEN}`);

        // Welcome makes no count or duration promise; the total appears once known.
        await expect(page.getByText(/quick questions|minutes/i)).toHaveCount(0);
        await page.getByTestId('seller-welcome-continue').click();
        await expect(page.getByRole('heading', { name: 'Home Basics' })).toBeVisible();
        await expect(page.locator('header').getByText(/\d+ of \d+/)).toHaveCount(0);
        await page.getByRole('button', { name: 'Public Water' }).click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page.locator('header').getByText('2 of 6')).toBeVisible();

        // Electric and its single-button meter step.
        await page.getByRole('button', { name: 'PPL Electric Utilities' }).click();
        const meter = page.getByTestId('seller-electric-meter-number');
        await meter.fill('M-12345');
        await expect(page.getByRole('button', { name: /without meter number/i })).toHaveCount(0);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();

        // Going Back shows the answer and lets the seller keep it.
        await expect(page.getByRole('heading', { name: 'Water Provider' })).toBeVisible();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.getByTestId('seller-utility-current-electric')).toContainText('PPL Electric Utilities');
        await page.getByTestId('seller-utility-keep-electric').click();
        await expect(meter).toHaveValue('M-12345');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('button', { name: 'Easton Suburban Water Authority' }).click();

        // Irrigation: details entered, then the answer changes to No.
        await expect(page.getByRole('heading', { name: 'Irrigation & Watering', level: 3 })).toBeVisible();
        await page.getByPlaceholder('Name of company or person').fill('GreenSprout Irrigation');
        await page.getByTestId('irrigation-day-mon').click();
        await page.locator('select').first().selectOption('no');
        await page.getByTestId('advanced-continue').click();
        await page.getByPlaceholder('Code to provide at closing').fill('0420');
        await page.getByTestId('advanced-continue').click();

        // Review: question labels, formatted choices, typed values untouched.
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await expect(page.getByText('Has Irrigation System: No')).toBeVisible();
        await expect(page.getByText(/GreenSprout|Watering Days|watering days/)).toHaveCount(0);
        await expect(page.getByText('Garage Door Code: 0420')).toBeVisible();

        // Switching back to Yes restores what was typed.
        await page.getByRole('button', { name: 'Edit Irrigation & Watering' }).click();
        await page.locator('select').first().selectOption('yes');
        await expect(page.getByPlaceholder('Name of company or person')).toHaveValue('GreenSprout Irrigation');
        await page.getByTestId('advanced-continue').click();
        await expect(page.getByText('Irrigation Provider: GreenSprout Irrigation')).toBeVisible();
        await expect(page.getByText('Watering Days: Mon')).toBeVisible();

        // One provider edit goes through its meter step and straight back.
        await page.getByRole('button', { name: 'Edit Electric' }).click();
        await page.getByRole('button', { name: 'Met-Ed' }).click();
        await expect(meter).toHaveValue('M-12345');
        await page.getByRole('button', { name: 'Save & Return to Review' }).click();
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await expect(page.getByText('Met-Ed')).toBeVisible();
        await expect(page.getByText('Easton Suburban Water Authority')).toBeVisible();

        // A Home Basics edit asks only about the utility it added.
        await page.getByRole('button', { name: 'Edit Home Basics' }).click();
        await page.getByRole('button', { name: 'Internet' }).click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Internet Provider' })).toBeVisible();
        await page.getByRole('button', { name: 'Service Electric' }).click();
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();

        const submission = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/api/seller/${TOKEN}`));
        await page.getByRole('button', { name: /submit/i }).click();
        const body = (await submission).postDataJSON();
        expect(body.utilities.electric).toMatchObject({ display_name: 'Met-Ed', meter_number: 'M-12345' });
        expect(body.utilities.water).toMatchObject({ display_name: 'Easton Suburban Water Authority' });
        expect(body.utilities.internet).toMatchObject({ display_name: 'Service Electric' });
        await expect(page.getByRole('heading', { name: 'All Done!' })).toBeVisible();
    });

    test('phone-size inputs and edit controls are large enough', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Sizes are only reduced on wider screens.');
        await page.goto(`/s/${TOKEN}`);
        await page.getByTestId('seller-welcome-continue').click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('button', { name: 'PPL Electric Utilities' }).click();

        const fontSize = (testId: string) => page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(await fontSize('seller-electric-meter-number')).toBeGreaterThanOrEqual(16);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();

        const irrigationField = page.getByPlaceholder('Name of company or person');
        expect(await irrigationField.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        for (const control of [page.getByTestId('irrigation-day-mon'), page.getByRole('button', { name: 'M / W / F' })]) {
            const box = await control.boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
        }
        await page.getByTestId('advanced-continue').click();
        await page.getByTestId('advanced-continue').click();

        expect(await fontSize('review-electric-meter-number')).toBeGreaterThanOrEqual(16);
        const pencil = await page.getByRole('button', { name: 'Edit Electric' }).boundingBox();
        expect(pencil?.width).toBeGreaterThanOrEqual(44);
        expect(pencil?.height).toBeGreaterThanOrEqual(44);
        // Polled because each step slides in from the right before settling.
        await expect.poll(
            () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        ).toBeLessThanOrEqual(0);
    });
});
