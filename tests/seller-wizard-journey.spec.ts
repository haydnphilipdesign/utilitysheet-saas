import { test, expect } from '@playwright/test';

/**
 * Full seller wizard journey with mocked APIs: welcome -> home basics ->
 * provider steps (suggestion pick, dedupe check, "I'm not sure") -> trash and
 * recycling day pickers -> review -> submit -> success.
 */

const TOKEN = 'journey-token-123';
const ADDRESS = '456 Verification Way, Easton, PA 18040';

const REQUEST_RESPONSE = {
    request: {
        property_address: ADDRESS,
        utility_categories: ['electric', 'water', 'gas', 'trash'],
        collect_electric_meter_number: false,
    },
    suggestions: {
        electric: [
            { display_name: 'PPL Electric Utilities', confidence: 0.9, rationale_short: 'Primary electric utility for the Lehigh Valley' },
            { display_name: 'PPL Electric Utilities Inc', confidence: 0.7, rationale_short: 'Duplicate variant that should be collapsed' },
            { display_name: 'Met-Ed (FirstEnergy)', confidence: 0.8, rationale_short: 'Serves parts of eastern Pennsylvania' },
        ],
        water: [
            { display_name: 'Pennsylvania American Water', confidence: 0.9, rationale_short: 'Largest water utility in PA' },
            { display_name: 'PA American Water', confidence: 0.8, rationale_short: 'Duplicate variant that should be collapsed' },
        ],
        gas: [
            { display_name: 'UGI Utilities', confidence: 0.9, rationale_short: 'Natural gas provider for the region' },
        ],
        trash: [
            { display_name: 'Waste Management', confidence: 0.8, rationale_short: 'National waste hauler' },
        ],
    },
};

test.describe('Seller wizard full journey', () => {
    test.beforeEach(async ({ page }) => {
        await page.route(`**/api/seller/${TOKEN}`, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true }),
                });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(REQUEST_RESPONSE),
            });
        });
    });

    test('completes the wizard end to end', async ({ page }) => {
        await page.goto(`/s/${TOKEN}`);

        // Welcome
        await expect(page.getByText(ADDRESS).filter({ visible: true }).first()).toBeVisible();
        await page.getByTestId('seller-welcome-continue').click();

        // Home basics: public water adds the water step, natural gas adds gas,
        // and trash is opted in from the optional utilities.
        await expect(page.getByRole('heading', { name: 'Home Basics' })).toBeVisible();
        await page.getByRole('button', { name: 'Public Water' }).click();
        await page.getByRole('button', { name: 'Natural Gas' }).click();
        await page.getByRole('button', { name: 'Trash & Recycling' }).click();
        await page.getByRole('button', { name: 'Continue' }).click();

        // Electric: near-duplicate suggestions must be collapsed client-side.
        await expect(page.getByRole('heading', { name: 'Electric Provider' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'PPL Electric Utilities', exact: false })).toHaveCount(1);
        await page.getByRole('button', { name: 'PPL Electric Utilities', exact: false }).click();

        // Water: dedupe keeps the spelled-out name and drops the abbreviation.
        await expect(page.getByRole('heading', { name: 'Water Provider' })).toBeVisible();
        await expect(page.getByText('Pennsylvania American Water')).toBeVisible();
        await expect(page.getByText('PA American Water', { exact: true })).toHaveCount(0);

        // Use the "I'm not sure" path for water.
        await page.getByTestId('seller-utility-skip-water').click();

        // Gas
        await expect(page.getByRole('heading', { name: 'Natural Gas Provider' })).toBeVisible();
        await page.getByRole('button', { name: 'UGI Utilities', exact: false }).click();

        // Trash: pick provider, then fill the schedule details.
        await expect(page.getByRole('heading', { name: 'Trash & Recycling Provider' })).toBeVisible();
        await page.getByRole('button', { name: 'Waste Management', exact: false }).click();

        await expect(page.getByTestId('seller-trash-details-step')).toBeVisible();
        await page.getByTestId('seller-trash-pickup-day-mon').click({ force: true });
        await page.getByTestId('seller-trash-pickup-day-thu').click({ force: true });
        await page.getByTestId('seller-trash-recycling-yes').click();
        await page.getByTestId('seller-recycling-pickup-day-tue').click({ force: true });
        await page.getByRole('button', { name: 'Continue' }).click();

        // Review: summary reflects the selections, including the uncertain one.
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await expect(page.getByText('Trash pickup: Monday, Thursday')).toBeVisible();
        await expect(page.getByText('Recycling pickup: Tuesday')).toBeVisible();
        await expect(page.getByText('Not sure').first()).toBeVisible();

        // Submit -> success
        await page.getByRole('button', { name: /submit/i }).click();
        await expect(page.getByRole('heading', { name: 'All Done!' })).toBeVisible();
    });

    test('"Not sure" clears selected trash days and survives to review', async ({ page }) => {
        await page.goto(`/s/${TOKEN}`);

        await page.getByTestId('seller-welcome-continue').click();
        await page.getByRole('button', { name: 'Trash & Recycling' }).click();
        await page.getByRole('button', { name: 'Continue' }).click();

        // Electric -> skip straight through to trash.
        await page.getByTestId('seller-utility-skip-electric').click();
        await expect(page.getByRole('heading', { name: 'Trash & Recycling Provider' })).toBeVisible();
        await page.getByTestId('seller-utility-skip-trash').click();

        await expect(page.getByTestId('seller-trash-details-step')).toBeVisible();
        await page.getByTestId('seller-trash-pickup-day-fri').click({ force: true });
        await page.getByTestId('seller-trash-pickup-not_sure').click();
        await expect(page.getByTestId('seller-trash-pickup-not_sure')).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Continue' }).click();

        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await expect(page.getByText('Trash pickup: Not sure')).toBeVisible();
    });
});
