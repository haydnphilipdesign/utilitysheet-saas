import { test, expect, type Page } from '@playwright/test';

/**
 * First-use guide and seller test journey with every /api call mocked in the
 * browser, so no request, email, or account data is created.
 */

const TOKEN = 'test-drive-journey-token';
const TEST_ADDRESS = '[TEST] 123 Maple Street, Anytown, PA 18301';
const SHOT_DIR = process.env.QA_SHOT_DIR;

type TestDriveMock = Record<string, unknown>;

async function screenshot(page: Page, name: string, projectName: string, fullPage = true) {
    if (!SHOT_DIR) return;
    // Let step entrance animations settle before capturing.
    await page.waitForTimeout(600);
    const slug = projectName.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `${SHOT_DIR}/${slug}-${name}.png`, fullPage });
}

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

async function mockApis(page: Page, options: { testDrive: () => TestDriveMock; onStart?: () => void; onSubmit?: () => void }) {
    // Registered first so specific handlers below take precedence.
    await page.route('**/api/**', (route) => route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not mocked' }),
    }));

    const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

    await page.route('**/api/account', (route) => route.fulfill(json({
        account: { id: 'acc_fixture', full_name: 'Jordan Fixture', email: 'fixture@example.com', subscription_status: 'free', onboarding_completed_at: null },
        activeOrganization: null,
    })));
    await page.route('**/api/branding', (route) => route.fulfill(json([{
        id: 'brand_fixture',
        name: 'Fixture Realty',
        primary_color: '#2563eb',
        secondary_color: '#1e40af',
        logo_url: null,
        contact_name: 'Jordan Fixture',
        contact_email: 'fixture@example.com',
        contact_phone: '(555) 010-0000',
        contact_website: null,
        is_default: true,
        show_powered_by: true,
        show_generation_date: true,
    }])));
    await page.route('**/api/intake-link', (route) => route.fulfill(json({
        intakeLink: { slug: 'fixture-link', url: 'https://example.com/i/fixture-link', is_active: true },
    })));
    await page.route('**/api/test-drive', (route) => {
        if (route.request().method() === 'POST') {
            options.onStart?.();
            return route.fulfill(json({ status: 'ready', sellerUrl: `/s/${TOKEN}`, invitationDelivery: 'sent' }, 201));
        }
        return route.fulfill(json(options.testDrive()));
    });
    await page.route(`**/api/seller/${TOKEN}`, (route) => {
        if (route.request().method() === 'POST') {
            options.onSubmit?.();
            return route.fulfill(json({ success: true }));
        }
        return route.fulfill(json({
            request: {
                property_address: TEST_ADDRESS,
                utility_categories: ['electric', 'water'],
                collect_electric_meter_number: false,
                status: 'in_progress',
                packet_mode: 'simple',
                is_demo: true,
            },
            brandProfile: { name: 'Fixture Realty', primary_color: '#2563eb', contact_email: 'fixture@example.com' },
            suggestions: {},
        }));
    });
}

test.describe('first-use guide and seller test', () => {
    test('onboarding sample sheet, one-click test start, and evaluator completion', async ({ page }, testInfo) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        let testDriveState: TestDriveMock = { status: 'eligible' };
        let started = false;
        let submitted = false;
        await mockApis(page, {
            testDrive: () => testDriveState,
            onStart: () => {
                started = true;
                testDriveState = { status: 'ready', sellerUrl: `/s/${TOKEN}`, invitationDelivery: 'sent' };
            },
            onSubmit: () => {
                submitted = true;
                testDriveState = {
                    status: 'completed',
                    reviewUrl: '/packet/fixture-public-token',
                    pdfUrl: '/api/packet/fixture-public-token/pdf',
                    delivery: 'sent',
                };
            },
        });

        await page.goto('/onboarding');
        await expect(page.getByRole('heading', { name: /your seller link is ready/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'See how UtilitySheet works' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start seller test' })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '01-onboarding', testInfo.project.name);

        // Sample sheet: one click, no request created.
        await page.getByRole('button', { name: 'View sample sheet' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Sample utility sheet' })).toBeVisible();
        await expect(dialog.getByText(/shown with your saved default Branding Profile/i)).toBeVisible();
        await expect(dialog.getByTitle('Branding profile PDF preview')).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Download sample PDF' })).toBeEnabled();
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '02-sample-dialog', testInfo.project.name);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        expect(started).toBe(false);

        // Keyboard reachability and a visible focus ring on the start action.
        const start = page.getByRole('button', { name: 'Start seller test' });
        await start.focus();
        await expect(start).toBeFocused();
        const box = await start.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(testInfo.project.name === 'Desktop Chrome' ? 32 : 44);

        await start.click();
        await page.waitForURL(`**/s/${TOKEN}`);
        expect(started).toBe(true);

        // Test-mode seller welcome.
        await expect(page.getByTestId('seller-test-drive-banner')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Exit test' })).toHaveAttribute('href', '/dashboard');
        await expect(page.getByRole('heading', { name: /see what your seller sees/i })).toBeVisible();
        await expect(page.getByText(/does not count toward your plan/i)).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '03-seller-welcome', testInfo.project.name, false);

        await page.getByTestId('seller-welcome-continue').click();
        await expect(page.getByRole('heading', { name: 'Home Basics' })).toBeVisible();
        await expect(page.getByTestId('seller-save-link-open')).toHaveCount(0);
        await page.getByRole('button', { name: 'Continue' }).click();

        await expect(page.getByRole('heading', { name: 'Electric Provider' })).toBeVisible();
        await page.getByTestId('seller-utility-skip-electric').click();

        await expect(page.getByRole('heading', { name: 'Review and Submit' })).toBeVisible();
        await page.getByRole('button', { name: /submit/i }).click();

        // Evaluator completion.
        await expect(page.getByRole('heading', { name: 'Your test is complete' })).toBeVisible();
        expect(submitted).toBe(true);
        await expect(page.getByRole('link', { name: 'Open test sheet' })).toHaveAttribute('href', '/packet/fixture-public-token');
        await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', '/api/packet/fixture-public-token/pdf');
        await expect(page.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
        await expect(page.getByText(/has been notified/i)).toHaveCount(0);
        await expect(page.getByText(/safely close this page/i)).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '04-test-success', testInfo.project.name, false);

        expect(pageErrors).toEqual([]);
    });

    test('onboarding shows resume and completed states', async ({ page }, testInfo) => {
        let state: TestDriveMock = { status: 'ready', sellerUrl: `/s/${TOKEN}`, invitationDelivery: 'failed' };
        await mockApis(page, { testDrive: () => state });

        await page.goto('/onboarding');
        const resume = page.getByRole('link', { name: 'Resume seller test' });
        await expect(resume).toHaveAttribute('href', `/s/${TOKEN}`);
        await expect(page.getByText(/could not email you the test link/i)).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '05-onboarding-resume', testInfo.project.name);

        state = {
            status: 'completed',
            reviewUrl: '/packet/fixture-public-token',
            pdfUrl: '/api/packet/fixture-public-token/pdf',
            delivery: 'failed',
        };
        await page.reload();
        await expect(page.getByText('Seller test complete')).toBeVisible();
        await expect(page.getByText(/could not email your copy/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /open test sheet/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Copy seller link' })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await screenshot(page, '06-onboarding-completed', testInfo.project.name);
    });

    test('public demo entry still renders', async ({ page }) => {
        await page.route('**/api/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
        await page.goto('/demo');
        await expect(page.getByRole('textbox').first()).toBeVisible();
        await expect(page.getByTestId('seller-test-drive-banner')).toHaveCount(0);
    });
});
