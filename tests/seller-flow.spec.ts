import { test, expect } from '@playwright/test';

test.describe('Seller Wizard Flow', () => {
    // Use a fake token since we are testing the UI flow mostly
    // In a real scenario, we would seed the DB and get a real token
    const FAKE_TOKEN = 'test-token-123';

    test('Shows unavailable state for invalid token', async ({ page }) => {
        // Mock the API response to return 404
        await page.route(`**/api/seller/${FAKE_TOKEN}`, async route => {
            await route.fulfill({ status: 404 });
        });

        await page.goto(`/s/${FAKE_TOKEN}`);

        // Expect the error UI
        await expect(page.getByText('Unavailable')).toBeVisible();
        await expect(page.getByText('Request not found')).toBeVisible();

        // Check for retry button
        await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    });

    test('Loads wizard with valid data', async ({ page }) => {
        // Mock the API response for success
        await page.route(`**/api/seller/${FAKE_TOKEN}`, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    request: {
                        property_address: '123 Test Lane',
                        utility_categories: ['electric', 'water', 'gas']
                    },
                    suggestions: {
                        electric: [{ provider_name: 'Test Electric Co', confidence: 0.9 }],
                        water: [],
                        gas: []
                    }
                })
            });
        });

        await page.goto(`/s/${FAKE_TOKEN}`);

        // Verify Welcome Screen
        await expect(page.getByText('123 Test Lane')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    });
});
