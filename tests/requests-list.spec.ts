import { expect, test, type Page, type TestInfo } from '@playwright/test';

// The dashboard Requests list rendered by the development-only fixture route.
// Every API call is mocked here; nothing reaches auth, the database or email.

type Row = Record<string, unknown> & { id: string; account_id: string };

function row(id: string, address: string, seller: string, status: string, accountId: string, ownerName: string | null): Row {
    return {
        id,
        account_id: accountId,
        organization_id: 'org_1',
        brand_profile_id: null,
        property_address: address,
        property_address_structured: null,
        seller_name: seller,
        seller_email: `${id}@example.com`,
        seller_phone: null,
        closing_date: '2026-11-14',
        status,
        public_token: `public-${id}`,
        seller_token: `seller-${id}`,
        packet_mode: 'simple',
        created_at: '2026-10-01T12:00:00.000Z',
        updated_at: '2026-10-05T12:00:00.000Z',
        last_activity_at: '2026-10-05T12:00:00.000Z',
        is_mine: accountId === 'acc_1',
        owner_name: ownerName,
    };
}

const workspaceRows = [
    row('req_1', '1184 Alder Creek Road, Riverbend, OH', 'Morgan Whitfield', 'submitted', 'acc_1', 'Jordan Rivera'),
    row('req_2', '27 Harbor View Terrace, Riverbend, OH', 'Priya Raman', 'sent', 'acc_2', 'Casey Nguyen'),
    row('req_3', '905 Sycamore Court, Riverbend, OH', 'Dana Okafor', 'in_progress', 'acc_3', 'Alexandria Montgomery-Castellanos'),
];

async function open(page: Page, shared: boolean, query = '') {
    const requested: string[] = [];
    await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname !== '/api/requests') {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        }
        requested.push(url.search);
        const all = shared ? workspaceRows : workspaceRows.slice(0, 1);
        const data = url.searchParams.get('owner') === 'mine' ? all.filter((item) => item.account_id === 'acc_1') : all;
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data,
                total: data.length,
                page: 1,
                limit: 20,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
                sharedWorkspace: shared,
            }),
        });
    });
    await page.goto(`/test-fixtures/requests${query}`);
    await expect(page.getByRole('heading', { name: 'Requests', exact: true })).toBeVisible();
    return { requested };
}

/** The table on wide screens, the cards on a phone. */
function visibleList(page: Page) {
    const table = page.getByRole('table');
    return { table, cards: page.locator('[data-testid^="request-mobile-"]') };
}

async function healthy(page: Page, testInfo: TestInfo, name: string) {
    await expect(page.getByText('Application error: a client-side exception has occurred', { exact: false })).toHaveCount(0);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test('a shared workspace names each request’s owner and can be narrowed to the viewer’s own', async ({ page }, testInfo) => {
    const { requested } = await open(page, true);
    const { table, cards } = visibleList(page);
    const wide = await table.isVisible();
    const list = wide ? table : page.locator('body');

    await expect(page.getByText('3 requests', { exact: true })).toBeVisible();
    await expect(list.getByText('You', { exact: true }).first()).toBeVisible();
    await expect(list.getByText('Casey Nguyen', { exact: true }).first()).toBeVisible();
    await expect(list.getByText('Alexandria Montgomery-Castellanos', { exact: true }).first()).toBeVisible();
    if (wide) {
        await expect(page.getByRole('columnheader', { name: 'Owner', exact: true })).toBeVisible();
    } else {
        await expect(cards).toHaveCount(3);
    }
    await healthy(page, testInfo, 'requests-shared-everyone');

    await page.getByLabel('Filter by owner').selectOption('mine');
    await expect(page).toHaveURL(/owner=mine/);
    await expect(page.getByText('1 requests', { exact: true })).toBeVisible();
    await expect(list.getByText('Casey Nguyen', { exact: true })).toHaveCount(0);
    expect(requested.at(-1)).toContain('owner=mine');
    await healthy(page, testInfo, 'requests-shared-mine');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('3 requests', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/owner=/);
});

test('a workspace with one person shows no owner column or filter', async ({ page }, testInfo) => {
    await open(page, false);

    await expect(page.getByText('1 requests', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Filter by owner')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Owner', exact: true })).toHaveCount(0);
    await expect(page.getByText('You', { exact: true })).toHaveCount(0);
    await healthy(page, testInfo, 'requests-solo');
});
