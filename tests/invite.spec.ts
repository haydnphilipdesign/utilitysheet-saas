import { expect, test, type Page, type TestInfo } from '@playwright/test';

// The workspace invitation page. Every API call is mocked here; nothing reaches
// auth, the database or email, and the token is synthetic.

type Viewer = { signedIn: boolean; email: string | null; emailMatches: boolean; isMember: boolean; organizationId: string | null };

function invitation(status: 'open' | 'expired' | 'accepted', viewer: Partial<Viewer> = {}) {
    return {
        status,
        workspaceName: 'Riverbend Transaction Services',
        invitedByName: 'Pat Lee',
        invitedEmail: 'casey.nguyen@riverbendtitle.example',
        role: 'member',
        expiresAt: '2026-10-14T12:00:00.000Z',
        workspaceOnTeams: true,
        viewer: { signedIn: false, email: null, emailMatches: false, isMember: false, organizationId: null, ...viewer },
    };
}

async function open(page: Page, lookup: unknown, lookupStatus = 200, accept?: { status: number; body: unknown }) {
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const json = (body: unknown, status = 200) =>
            route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (req.method() !== 'GET') writes.push(path);
        if (path === '/api/organization/invites/lookup') return json(lookup, lookupStatus);
        if (path === '/api/organization/invites/accept' && accept) return json(accept.body, accept.status);
        return json({}, 404);
    });
    await page.goto('/invite/synthetic-invite-token');
    return writes;
}

async function healthy(page: Page, testInfo: TestInfo, name: string) {
    await expect(page.getByText('Application error: a client-side exception has occurred', { exact: false })).toHaveCount(0);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

const signedIn = { signedIn: true, email: 'casey.nguyen@riverbendtitle.example', emailMatches: true };

test('a signed-out visitor sees who invited them and which address to use', async ({ page }, testInfo) => {
    const writes = await open(page, invitation('open'));

    await expect(page.getByRole('heading', { name: 'Join Riverbend Transaction Services on UtilitySheet' })).toBeVisible();
    await expect(page.getByText('casey.nguyen@riverbendtitle.example', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I already have an account', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'invite-signed-out');
    expect(writes).toEqual([]);
});

test('the invited person joins with one deliberate click', async ({ page }, testInfo) => {
    const writes = await open(page, invitation('open', signedIn), 200, { status: 409, body: { error: 'No seats available' } });

    const join = page.getByRole('button', { name: 'Join Riverbend Transaction Services', exact: true });
    await expect(join).toBeVisible();
    await healthy(page, testInfo, 'invite-ready-to-join');
    expect(writes).toEqual([]);

    await join.click();
    await expect(page.getByText('Riverbend Transaction Services has no free seats right now. Ask Pat Lee to add a seat, then open this link again.', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'invite-no-seat');
    expect(writes).toEqual(['/api/organization/invites/accept']);
});

test('the wrong account, an expired invitation and a used one each say what to do', async ({ page }, testInfo) => {
    await open(page, invitation('open', { signedIn: true, email: 'casey.personal@mail.example', emailMatches: false }));
    await expect(page.getByText('casey.personal@mail.example', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out and switch account', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Join / })).toHaveCount(0);
    await healthy(page, testInfo, 'invite-wrong-account');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, invitation('expired', signedIn));
    await expect(page.getByRole('heading', { name: 'This invitation has expired' })).toBeVisible();
    await expect(page.getByText('Ask Pat Lee to send a new one', { exact: false })).toBeVisible();
    await healthy(page, testInfo, 'invite-expired');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, invitation('accepted', { ...signedIn, isMember: true, organizationId: 'org_1' }));
    await expect(page.getByRole('heading', { name: 'You’re already in Riverbend Transaction Services' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Riverbend Transaction Services', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'invite-already-member');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { status: 'not_found' }, 404);
    await expect(page.getByRole('heading', { name: 'This invitation link isn’t valid' })).toBeVisible();
    await healthy(page, testInfo, 'invite-not-found');
});
