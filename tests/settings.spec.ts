import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Dashboard Settings rendered by the development-only fixture route. Every API
// call is mocked here; nothing reaches auth, the database, email or Stripe.

type Role = 'admin' | 'member';
type Scenario = {
    plan: 'free' | 'pro' | 'team';
    role: Role;
    used?: number;
    /** Fail these requests with a 500 until the test flips the flag off. */
    failAccount?: boolean;
    failAccountSave?: boolean;
    emailSent?: boolean;
};

const preferences = { seller_submissions: true, seller_submission_pdf_attachment: true, contact_resolution: true };
const form = {
    id: '00000000-0000-4000-8000-000000000021',
    name: 'Listing information',
    slug: 'jordan-rivera',
    url: 'https://example.com/form/jordan-rivera',
    endingUrl: 'https://example.com/form/jordan-rivera/form-1',
    linkSuffix: 'form-1',
    revision: 1,
    organizationId: 'org_1',
    isDefault: true,
    isActive: true,
    sellerHeading: null,
    sellerIntro: null,
    defaultBrandProfileId: null,
    defaultUtilityCategories: ['electric', 'water', 'gas'],
    defaultPacketMode: 'simple',
    advancedModules: [],
    advancedModuleExclusions: {},
    collectHoaQuestions: true,
    collectElectricMeterNumber: true,
};

async function mocks(page: Page, scenario: Scenario) {
    const state = { ...scenario, accountLoads: 0 };
    const writes: { url: string; method: string; body: Record<string, unknown> }[] = [];
    const team = () => state.plan === 'team';
    const invites = [{ id: 'inv_1', email: 'casey.nguyen@riverbendtitle.example', role: 'member', expires_at: '2026-10-14T12:00:00.000Z' }];
    await page.route('**/api/**', async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const method = req.method();
        const json = (body: unknown, status = 200) =>
            route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (method !== 'GET') writes.push({ url: path, method, body: req.postDataJSON() || {} });

        if (path === '/api/account' && method === 'GET') {
            state.accountLoads += 1;
            if (state.failAccount) return json({ error: 'Internal server error' }, 500);
            return json({
                account: { id: 'acc_1', full_name: 'Jordan Rivera', email: 'jordan@example.com', notification_preferences: preferences },
                activeOrganization: {
                    id: 'org_1',
                    name: 'Riverbend Transaction Services',
                    role: state.role,
                    subscription_status: team() ? 'team' : 'free',
                    seat_quantity: team() ? 4 : null,
                    notification_settings: { notify_admins_on_submission: false },
                },
                usage: state.plan === 'free'
                    ? { used: state.used ?? 2, limit: 3, plan: 'free' }
                    : { used: 12, limit: 999999, plan: state.plan },
            });
        }
        if (path === '/api/account' && method === 'POST') {
            return state.failAccountSave ? json({ error: 'Internal server error' }, 500) : json({ account: { id: 'acc_1' } });
        }
        if (path === '/api/organization/members' && method === 'GET') {
            return json({
                organization: { id: 'org_1', name: 'Riverbend Transaction Services', subscription_status: team() ? 'team' : 'free', seat_quantity: team() ? 4 : null },
                role: state.role,
                members: team() ? [
                    { account_id: 'acc_1', email: 'jordan@example.com', full_name: 'Jordan Rivera', member_role: state.role },
                    { account_id: 'acc_2', email: 'pat.lee@riverbendtitle.example', full_name: 'Pat Lee', member_role: 'admin' },
                    { account_id: 'acc_3', email: 'sam.okafor-williams@riverbendtitle.example', full_name: null, member_role: 'member' },
                ] : [
                    { account_id: 'acc_1', email: 'jordan@example.com', full_name: 'Jordan Rivera', member_role: 'admin' },
                ],
                seatUsage: { used: team() ? 3 : 1, pendingInvites: team() ? invites.length : 0 },
            });
        }
        if (path === '/api/organization/invites' && method === 'GET') return json({ invites });
        if (path === '/api/organization/invites' && method === 'POST') {
            const email = String(req.postDataJSON().email);
            return json({
                invite: { id: 'inv_2', email, role: 'member', expires_at: '2026-10-14T12:00:00.000Z' },
                inviteUrl: 'https://example.com/invite/synthetic-invite-token',
                emailSent: state.emailSent ?? true,
            });
        }
        if (path === '/api/organization' && method === 'PATCH') {
            return json({ organization: { id: 'org_1', name: req.postDataJSON().name } });
        }
        if (path === '/api/organization/billing/checkout') {
            return json({ error: 'Checkout is not available in this test.' }, 400);
        }
        if (path === '/api/account/security') {
            return json({
                primaryEmail: 'jordan@example.com',
                primaryEmailVerified: true,
                hasPassword: true,
                methods: { credential: true, magicLink: false, passkey: false, oauthProviders: [] },
                contactChannels: [{ id: 'email_1', value: 'jordan@example.com', isPrimary: true, isVerified: true, usedForAuth: true }],
                sessions: [
                    { id: 'current', createdAt: '2026-10-07T12:00:00.000Z', lastUsedAt: '2026-10-07T12:05:00.000Z', isCurrentSession: true, isImpersonation: false, location: 'Austin, TX, US' },
                    { id: 'other', createdAt: '2026-10-01T12:00:00.000Z', lastUsedAt: '2026-10-02T09:30:00.000Z', isCurrentSession: false, isImpersonation: false, location: null },
                ],
            });
        }
        if (path === '/api/referrals') {
            return json({
                referralLink: 'https://example.com/auth/signup?ref=jordan-rivera',
                counts: { earned: 1, applied: 2 },
                isSubscribed: state.plan !== 'free',
                referralAttribution: { code: null, canClaim: true, status: 'available' },
            });
        }
        if (path === '/api/seller-forms') {
            return json({
                forms: [form],
                linkBase: { slug: 'jordan-rivera', url: 'https://example.com/form/jordan-rivera', revision: 1, formId: form.id, formName: form.name, isActive: true, reservedSuffixes: [{ suffix: 'form-1', formId: form.id }] },
                defaultId: form.id,
                isPaid: state.plan !== 'free',
                workspaceName: 'Riverbend Transaction Services',
                capabilities: { canCreate: state.plan !== 'free', reason: null, usage: 1, allowance: state.plan === 'free' ? 1 : 10, totalUsage: 1, upgradeRequired: state.plan === 'free', pilotAvailable: false, message: '' },
                brandProfiles: [],
            });
        }
        if (path === '/api/branding') return json([]);
        return json({}, 404);
    });
    return { state, writes };
}

async function open(page: Page, scenario: Scenario, query = '') {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const mocked = await mocks(page, scenario);
    await page.goto(`/test-fixtures/settings${query}`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    return { ...mocked, errors };
}

async function tab(page: Page, name: string) {
    const target = page.getByRole('tab', { name, exact: true });
    await target.click();
    await expect(target).toHaveAttribute('aria-selected', 'true');
}

/** No client crash, no sideways scrolling, and a screenshot for review. */
async function healthy(page: Page, testInfo: TestInfo, name: string) {
    await expect(page.getByText('Application error: a client-side exception has occurred', { exact: false })).toHaveCount(0);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    // Let the tab highlight finish its transition before the picture is taken.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test('every tab renders for a Free solo workspace without sideways scrolling', async ({ page }, testInfo) => {
    const { errors } = await open(page, { plan: 'free', role: 'admin' });

    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Jordan Rivera');
    await expect(page.getByRole('heading', { name: 'Signed-in devices', exact: true })).toBeVisible();
    await expect(page.getByText('To change your sign-in email: add the new address', { exact: false })).toBeVisible();
    await healthy(page, testInfo, 'free-account');

    await tab(page, 'Seller forms');
    await expect(page.getByRole('heading', { name: 'Seller forms', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'free-seller-forms');

    await tab(page, 'Notifications');
    await expect(page.getByRole('switch', { name: 'Missing provider contact alerts', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Open Workspace & Team', exact: true })).toHaveCount(0);
    await healthy(page, testInfo, 'free-notifications');

    await tab(page, 'Workspace & Team');
    await expect(page.getByText('This workspace is for one person. To invite teammates, start a Teams plan in Billing.', { exact: true })).toBeVisible();
    await expect(page.getByText('Jordan Rivera', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'free-workspace');

    await page.getByRole('button', { name: 'See Teams in Billing', exact: true }).click();
    await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Submitted sheets this month' })).toHaveAttribute('aria-valuenow', '2');
    await expect(page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'free-billing');

    await tab(page, 'Referrals');
    await expect(page.getByLabel('Referral link', { exact: true })).toHaveValue('https://example.com/auth/signup?ref=jordan-rivera');
    await healthy(page, testInfo, 'free-referrals');
    expect(errors).toEqual([]);
});

test('a Teams admin manages people by name and sees honest invitation results', async ({ page }, testInfo) => {
    const { state, writes, errors } = await open(page, { plan: 'team', role: 'admin', emailSent: false }, '?tab=workspace');

    await expect(page.getByText('4 of 4 seats in use: 3 members and 1 pending invitation. Each member and each pending invitation uses one seat.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change Pat Lee to a member', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove sam.okafor-williams@riverbendtitle.example', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Jordan Rivera/ })).toHaveCount(0);
    await healthy(page, testInfo, 'team-admin-workspace');

    // Workspace name: unchanged, unsaved, then saved beside the button.
    const save = page.getByRole('button', { name: 'Save workspace name', exact: true });
    await expect(save).toBeDisabled();
    await page.getByLabel('Workspace name', { exact: true }).fill('R');
    await expect(page.getByText('Use between 2 and 100 characters.', { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    await page.getByLabel('Workspace name', { exact: true }).fill('Riverbend TC');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await save.click();
    await expect(page.getByText('Workspace name saved', { exact: true })).toBeVisible();
    expect(writes.at(-1)).toMatchObject({ url: '/api/organization', method: 'PATCH', body: { name: 'Riverbend TC' } });

    // The response did not confirm an email, so the page must not say one was sent.
    await page.getByLabel('Teammate’s email', { exact: true }).fill('new.person@example.com');
    await page.getByRole('button', { name: 'Send invitation', exact: true }).click();
    await expect(page.getByText('Invitation created, but we couldn’t confirm the email was sent.', { exact: false })).toBeVisible();
    await expect(page.getByText('Invitation emailed', { exact: false })).toHaveCount(0);
    await expect(page.getByLabel('Invite link for new.person@example.com', { exact: true })).toHaveValue('https://example.com/invite/synthetic-invite-token');
    await healthy(page, testInfo, 'team-admin-invited');

    // Confirmations use the app dialog and can be declined.
    await page.getByRole('button', { name: 'Remove Pat Lee', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove Pat Lee?' });
    await expect(dialog.getByText('They lose access to this workspace right away.', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes.some((write) => write.method === 'DELETE')).toBe(false);

    await tab(page, 'Billing');
    await expect(page.getByText('Teams plan', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Teams billing', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'team-admin-billing');

    state.emailSent = true;
    await tab(page, 'Notifications');
    await expect(page.getByRole('button', { name: 'Open Workspace & Team', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'team-notifications');
    expect(errors).toEqual([]);
});

test('a Teams member sees why controls are unavailable and no billing actions', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'team', role: 'member' }, '?tab=workspace');

    await expect(page.getByText('Pat Lee', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Workspace name', { exact: true })).toBeDisabled();
    await expect(page.getByText('Only workspace admins can rename the workspace.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save workspace name', exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Notify workspace admins of all team submissions', exact: true })).toBeDisabled();
    await expect(page.getByText('Only workspace admins can send invitations and see who has been invited.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Remove|Make|Change) / })).toHaveCount(0);
    await healthy(page, testInfo, 'team-member-workspace');

    await tab(page, 'Billing');
    await expect(page.getByText('Your workspace admins manage this plan, its seats and its invoices.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage|Upgrade|Start Teams/ })).toHaveCount(0);
    await healthy(page, testInfo, 'team-member-billing');
    expect(writes).toEqual([]);
});

test('a failed account load never shows a plan or a checkout button, and retry recovers', async ({ page }, testInfo) => {
    const { state, writes } = await open(page, { plan: 'pro', role: 'admin', failAccount: true }, '?tab=billing');

    await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t load your plan. Nothing about your billing has changed.' })).toBeVisible();
    await expect(page.getByText('Free plan', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Upgrade|Manage|Start Teams/ })).toHaveCount(0);
    await healthy(page, testInfo, 'billing-load-failed');

    await tab(page, 'Notifications');
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('We couldn’t load your notification settings. Nothing was changed.', { exact: true })).toBeVisible();
    await tab(page, 'Account');
    await expect(page.getByText('We couldn’t load your profile. Nothing was changed.', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'account-load-failed');

    state.failAccount = false;
    await tab(page, 'Billing');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('Pro plan', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage subscription', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true })).toHaveCount(0);
    await healthy(page, testInfo, 'pro-billing');
    expect(writes).toEqual([]);
});

test('profile and notification saves report saved, unsaved and failed next to the control', async ({ page }, testInfo) => {
    const { state, writes } = await open(page, { plan: 'free', role: 'admin' });

    const saveProfile = page.getByRole('button', { name: 'Save profile', exact: true });
    await expect(saveProfile).toBeDisabled();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    await page.getByLabel('Full name', { exact: true }).fill('Jordan R. Rivera');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();

    state.failAccountSave = true;
    await saveProfile.click();
    await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t save your name.' })).toBeVisible();
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Jordan R. Rivera');
    await healthy(page, testInfo, 'profile-save-failed');

    state.failAccountSave = false;
    await saveProfile.click();
    await expect(page.getByText('Profile saved', { exact: true })).toBeVisible();
    await expect(saveProfile).toBeDisabled();
    expect(writes.at(-1)).toEqual({ url: '/api/account', method: 'POST', body: { full_name: 'Jordan R. Rivera' } });

    await tab(page, 'Notifications');
    const alerts = page.getByRole('switch', { name: 'Missing provider contact alerts', exact: true });
    await alerts.click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(alerts).not.toBeChecked();

    state.failAccountSave = true;
    const submissions = page.getByRole('switch', { name: 'Seller submissions', exact: true });
    await submissions.click();
    await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t save that, so it’s back to what was saved.' })).toBeVisible();
    await expect(submissions).toBeChecked();
    await expect(alerts).not.toBeChecked();
    await healthy(page, testInfo, 'notification-save-failed');
});

test('a Teams seat count can be typed and is checked before checkout', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'pro', role: 'admin' }, '?tab=billing');

    const seats = page.getByLabel('Number of seats', { exact: true });
    const upgrade = page.getByRole('button', { name: 'Upgrade Pro to Teams', exact: true });
    await expect(seats).toHaveValue('3');
    await seats.fill('');
    await seats.pressSequentially('10');
    await expect(seats).toHaveValue('10');
    await expect(page.getByText('$70/mo', { exact: true })).toBeVisible();
    await expect(page.getByText('Stripe adds the prorated difference from Pro to your next invoice.', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'pro-teams-seats');

    await seats.fill('2');
    await expect(page.getByText('Teams starts at 3 seats.', { exact: true })).toBeVisible();
    await expect(upgrade).toBeDisabled();
    expect(writes).toEqual([]);

    await seats.fill('6');
    await upgrade.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Checkout is not available in this test.' })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/organization/billing/checkout', method: 'POST', body: { seats: 6 } }]);
});

test('returning from checkout waits for the account before calling a plan active', async ({ page }, testInfo) => {
    const { state } = await open(page, { plan: 'free', role: 'admin', used: 3 }, '?tab=billing&session_id=cs_test_synthetic');

    await expect(page.getByText('Confirming your Pro checkout with Stripe.', { exact: false })).toBeVisible();
    await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
    await expect(page.getByText('You’re on Pro', { exact: false })).toHaveCount(0);
    expect(new URL(page.url()).search).toBe('?tab=billing');
    await healthy(page, testInfo, 'checkout-confirming');

    state.plan = 'pro';
    await expect(page.getByText('You’re on Pro. Thanks for upgrading.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pro plan', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'checkout-confirmed');
});
