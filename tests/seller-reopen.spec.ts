import { test, expect, type Page } from '@playwright/test';

/**
 * Read-only after submission, and the seller side of a coordinator reopen.
 * Every API call is mocked; nothing is stored and no email is sent.
 */

const TOKEN = 'reopen-flow-token-123';
const ADDRESS = '456 Verification Way, Easton, PA 18040';
const DRAFT_KEY = `us_seller_draft:${TOKEN}`;

const BRAND = { name: 'Maple Realty', contact_email: 'agent@maple.example', contact_phone: '(555) 010-2000' };

const OPEN_REQUEST = {
    property_address: ADDRESS,
    utility_categories: ['electric', 'water', 'internet'],
    collect_electric_meter_number: true,
    collect_hoa_questions: false,
    status: 'in_progress',
    packet_mode: 'simple',
};

const REOPENED_REQUEST = {
    ...OPEN_REQUEST,
    edit_version: 1,
    prefill: {
        water_source: 'city',
        sewer_type: 'septic',
        heating_type: 'electric',
        utilities: [
            { category: 'electric', entry_mode: 'free_text', display_name: 'Corrected Power Co', raw_text: 'Corrected Power Co', meter_number: 'M-77', canonical_id: null, confidence_score: null, contact_phone: '555-0100', contact_url: null, extra: {} },
            { category: 'water', entry_mode: 'suggested_confirmed', display_name: 'Easton Suburban Water Authority', raw_text: null, meter_number: null, canonical_id: null, confidence_score: 0.9, contact_phone: null, contact_url: null, extra: {} },
        ],
    },
};

async function mockApi(page: Page, request: Record<string, unknown>, post: { status: number; body: Record<string, unknown> } = { status: 200, body: { success: true } }) {
    await page.route('**/api/**', async (route) => {
        const isSeller = new URL(route.request().url()).pathname === `/api/seller/${TOKEN}`;
        if (isSeller && route.request().method() === 'GET') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ request, brandProfile: BRAND, suggestions: {} }) });
            return;
        }
        if (isSeller) {
            await route.fulfill({ status: post.status, contentType: 'application/json', body: JSON.stringify(post.body) });
            return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Seller form after submission', () => {
    test('a submitted request shows a read-only notice and drops any local draft', async ({ page }) => {
        await mockApi(page, { property_address: ADDRESS, status: 'submitted', edit_version: 0, is_demo: false });
        await page.addInitScript(([key]) => {
            localStorage.setItem(key, JSON.stringify({ v: 2, currentStep: 4, state: { utilities: { electric: { display_name: 'Leftover Draft Power' } } } }));
        }, [DRAFT_KEY]);

        await page.goto(`/s/${TOKEN}`);

        await expect(page.getByTestId('seller-notice-submitted')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Already submitted' })).toBeVisible();
        await expect(page.getByText(/Ask Maple Realty to reopen the form/)).toBeVisible();
        await expect(page.getByRole('contentinfo').getByRole('link', { name: 'agent@maple.example' })).toBeVisible();
        await expect(page.getByTestId('seller-welcome-continue')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /submit/i })).toHaveCount(0);
        expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
        await expect.poll(
            () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        ).toBeLessThanOrEqual(0);
    });

    test('a reopened request starts from the stored sheet, not an old draft, and submits for the new session', async ({ page }) => {
        await mockApi(page, REOPENED_REQUEST);
        // Left on this device by the first session.
        await page.addInitScript(([key]) => {
            if (sessionStorage.getItem('seeded')) return;
            sessionStorage.setItem('seeded', '1');
            localStorage.setItem(key, JSON.stringify({
                v: 2, editVersion: 0, currentStep: 4, utilityIndex: 0,
                state: { water_source: 'well', sewer_type: 'not_sure', fuels_present: [], optional_utilities: [], utilities: { electric: { entry_mode: 'free_text', display_name: 'Old Draft Power', hidden: false } } },
            }));
        }, [DRAFT_KEY]);

        await page.goto(`/s/${TOKEN}`);

        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await expect(page.getByTestId('review-reopened-notice')).toBeVisible();
        await expect(page.getByText('Corrected Power Co')).toBeVisible();
        await expect(page.getByText('Old Draft Power')).toHaveCount(0);
        await expect(page.getByText('Public Water')).toBeVisible();
        await expect(page.getByTestId('review-electric-meter-number')).toHaveValue('M-77');

        // Correct one answer and come straight back.
        await page.getByRole('button', { name: 'Edit Water' }).click();
        await expect(page.getByTestId('seller-utility-current-water')).toContainText('Easton Suburban Water Authority');
        await page.getByTestId('seller-utility-skip-water').click();
        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();

        const submission = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/api/seller/${TOKEN}`));
        await page.getByRole('button', { name: /submit/i }).click();
        const body = (await submission).postDataJSON();
        expect(body.edit_version).toBe(1);
        expect(body.submission_key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
        expect(body.utilities.electric).toMatchObject({ display_name: 'Corrected Power Co', contact_phone: '555-0100', meter_number: 'M-77' });
        expect(body.utilities.water).toMatchObject({ entry_mode: 'unknown' });
        expect(body.property_address).toBeUndefined();

        await expect(page.getByRole('heading', { name: 'All Done!' })).toBeVisible();
        await expect(page.getByText(/want a copy/i)).toHaveCount(0);
        await page.waitForTimeout(500);
        expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    });

    test('a tab from an earlier session is told to reload and cannot submit', async ({ page }) => {
        await mockApi(page, OPEN_REQUEST, { status: 409, body: { code: 'STALE_SESSION' } });
        await page.goto(`/s/${TOKEN}`);
        await page.getByTestId('seller-welcome-continue').click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByTestId('seller-utility-skip-electric').click();
        await page.getByRole('button', { name: /submit/i }).click();

        await expect(page.getByTestId('seller-notice-stale')).toBeVisible();
        await expect(page.getByTestId('seller-notice-reload')).toBeVisible();
        await expect(page.getByRole('button', { name: /submit/i })).toHaveCount(0);
        await page.waitForTimeout(500);
        expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
    });

    test('a second tab submitting after the first is shown the read-only notice', async ({ page }) => {
        await mockApi(page, OPEN_REQUEST, { status: 409, body: { code: 'ALREADY_SUBMITTED' } });
        await page.goto(`/s/${TOKEN}`);
        await page.getByTestId('seller-welcome-continue').click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByTestId('seller-utility-skip-electric').click();
        await page.getByRole('button', { name: /submit/i }).click();

        await expect(page.getByTestId('seller-notice-submitted')).toBeVisible();
    });
});
