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
    /** The current paid plan is set to end on this date. */
    cancelAt?: string;
    /** The Pro plan is in its free month, which ends on this date. */
    trialEndsAt?: string;
    /** The server refuses a Pro checkout because Stripe already has a subscription. */
    existingSubscription?: boolean;
    /** The workspace was on Teams and no longer is, for this reason. */
    lapse?: 'payment_failed' | 'payment_failed_ended' | 'ended';
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
    const state = { ...scenario, accountLoads: 0, seats: 4 };
    const writes: { url: string; method: string; body: Record<string, unknown> }[] = [];
    const team = () => state.plan === 'team';
    const invites = [
        { id: 'inv_1', email: 'casey.nguyen@riverbendtitle.example', role: 'member', expires_at: '2026-10-14T12:00:00.000Z', status: 'pending' },
        { id: 'inv_0', email: 'robin.adeyemi@riverbendtitle.example', role: 'member', expires_at: '2026-09-20T12:00:00.000Z', status: 'expired' },
    ];
    const pendingInvites = () => invites.filter((invite) => invite.status === 'pending').length;
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
                account: {
                    id: 'acc_1',
                    full_name: 'Jordan Rivera',
                    email: 'jordan@example.com',
                    notification_preferences: preferences,
                    subscription_cancel_at: state.plan === 'pro' ? state.cancelAt ?? null : null,
                    subscription_trial_ends_at: state.plan === 'pro' ? state.trialEndsAt ?? null : null,
                },
                activeOrganization: {
                    id: 'org_1',
                    name: 'Riverbend Transaction Services',
                    role: state.role,
                    subscription_status: team() ? 'team' : 'free',
                    seat_quantity: team() ? state.seats : null,
                    subscription_cancel_at: team() ? state.cancelAt ?? null : null,
                    subscription_lapse_reason: state.lapse ?? null,
                    subscription_lapsed_at: state.lapse ? '2026-09-28T16:00:00.000Z' : null,
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
                organization: { id: 'org_1', name: 'Riverbend Transaction Services', subscription_status: team() ? 'team' : 'free', seat_quantity: team() ? state.seats : null, subscription_cancel_at: team() ? state.cancelAt ?? null : null, subscription_lapse_reason: state.lapse ?? null, subscription_lapsed_at: state.lapse ? '2026-09-28T16:00:00.000Z' : null },
                role: state.role,
                members: team() ? [
                    { account_id: 'acc_1', email: 'jordan@example.com', full_name: 'Jordan Rivera', member_role: state.role },
                    { account_id: 'acc_2', email: 'pat.lee@riverbendtitle.example', full_name: 'Pat Lee', member_role: 'admin' },
                    { account_id: 'acc_3', email: 'sam.okafor-williams@riverbendtitle.example', full_name: null, member_role: 'member' },
                ] : [
                    { account_id: 'acc_1', email: 'jordan@example.com', full_name: 'Jordan Rivera', member_role: 'admin' },
                ],
                seatUsage: { used: team() ? 3 : 1, pendingInvites: team() ? pendingInvites() : 0 },
            });
        }
        if (path.startsWith('/api/organization/members/') && method === 'DELETE') {
            return json({ success: true, left: path.endsWith('/acc_1'), requestsMoved: 2, profilesMoved: 1, recipientAccountId: 'acc_1' });
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
        if (path === '/api/organization/invites/inv_0' && method === 'PATCH') {
            // Every seat is taken, so an expired invitation cannot be sent again yet.
            return json({ error: 'No seats available' }, 409);
        }
        if (path === '/api/organization' && method === 'PATCH') {
            return json({ organization: { id: 'org_1', name: req.postDataJSON().name } });
        }
        if (path === '/api/billing/checkout' && state.existingSubscription) {
            return json({
                error: 'Existing subscription',
                message: 'Your subscription has a payment that did not go through. Update your card in Manage subscription instead of starting a new one.',
                manageBilling: true,
            }, 409);
        }
        if (path === '/api/billing/checkout') return json({ message: 'Checkout is not available in this test.' }, 400);
        if (path === '/api/billing/portal') return json({ error: 'Billing is not available in this test.' }, 400);
        if (path === '/api/organization/billing/seats' && method === 'POST') {
            state.seats = Number(req.postDataJSON().seats);
            return json({ seatQuantity: state.seats, previousSeatQuantity: 4 });
        }
        if (path === '/api/organization/billing/portal') return json({ error: 'Billing is not available in this test.' }, 400);
        if (path === '/api/organization/billing/checkout' && state.existingSubscription) {
            return json({
                error: 'Existing subscription',
                message: 'The Teams subscription for this workspace has a payment that did not go through. Update the card in Manage Teams billing instead of starting a new one.',
                manageBilling: 'workspace',
            }, 409);
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
                forms: [{ ...form, shared: false, isMine: true, canEdit: true, canShare: true, canDelete: false, ownerName: null }],
                linkBase: { slug: 'jordan-rivera', url: 'https://example.com/form/jordan-rivera', revision: 1, formId: form.id, formName: form.name, isActive: true, reservedSuffixes: [{ suffix: 'form-1', formId: form.id }] },
                defaultId: form.id,
                isPaid: state.plan !== 'free',
                workspaceName: 'Riverbend Transaction Services',
                capabilities: { canCreate: state.plan !== 'free', reason: null, usage: 1, allowance: state.plan === 'free' ? 1 : 10, totalUsage: 1, upgradeRequired: state.plan === 'free', pilotAvailable: false, message: '', sharing: { available: state.plan === 'team', canShare: state.plan === 'team', usage: 0, allowance: state.plan === 'team' ? 30 : 0, message: '' } },
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
    // An invitation that expired stays visible, off the seat count, with a way to send it again.
    await expect(page.getByText('Pending invitations (1)', { exact: true })).toBeVisible();
    await expect(page.getByText('Expired Sep 20, 2026 without being accepted. It no longer uses a seat.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove expired invitation to robin.adeyemi@riverbendtitle.example', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Send a new invitation to robin.adeyemi@riverbendtitle.example', exact: true }).click();
    await expect(page.getByText('All of your seats are in use. Add seats in Billing or cancel a pending invitation, then try again.', { exact: true })).toBeVisible();
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
    await expect(dialog.getByText('They lose access to this workspace right away.', { exact: false })).toBeVisible();
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

test('a Teams member can leave the workspace after being told what happens to their work', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'team', role: 'member' }, '?tab=workspace');
    await page.route('**/dashboard', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Left the workspace</h1>' }));

    await expect(page.getByText('Leave this workspace', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Leave workspace', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Leave Riverbend Transaction Services?' });
    await expect(dialog.getByText('You lose access right away.', { exact: false })).toBeVisible();
    await healthy(page, testInfo, 'team-member-leave-confirm');
    expect(writes).toEqual([]);

    await dialog.getByRole('button', { name: 'Leave workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Left the workspace' })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/organization/members/acc_1', method: 'DELETE', body: {} }]);
});

test('an admin removing a member is told where that person’s work goes', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'team', role: 'admin' }, '?tab=workspace');

    // Another admin stays, so this admin may leave too.
    await expect(page.getByRole('button', { name: 'Leave workspace', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove sam.okafor-williams@riverbendtitle.example', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('The requests and Branding Profiles they created stay here and become yours, and so do the seller forms they shared with the workspace', { exact: false })).toBeVisible();
    await healthy(page, testInfo, 'team-admin-remove-confirm');
    await dialog.getByRole('button', { name: 'Remove member', exact: true }).click();

    await expect(page.getByText('Their 2 requests and 1 Branding Profile now belong to you.', { exact: false })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/organization/members/acc_3', method: 'DELETE', body: {} }]);
    await healthy(page, testInfo, 'team-admin-removed');
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

    // Changing a live Pro subscription is confirmed first, and can be declined.
    await seats.fill('6');
    await upgrade.click();
    const dialog = page.getByRole('dialog', { name: 'Change your Pro plan to Teams?' });
    await expect(dialog.getByText('Your Pro subscription becomes a Teams plan with 6 seats at $42 a month.', { exact: false })).toBeVisible();
    await healthy(page, testInfo, 'pro-teams-confirm');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([]);

    await upgrade.click();
    await dialog.getByRole('button', { name: 'Change to Teams', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Checkout is not available in this test.' })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/organization/billing/checkout', method: 'POST', body: { seats: 6 } }]);
});

test('arriving from "Start Teams" opens Billing with the Teams section in view', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'free', role: 'admin' }, '?tab=billing&plan=teams');

    const start = page.getByRole('button', { name: 'Start Teams', exact: true });
    await expect(start).toBeInViewport();
    await expect(page.getByLabel('Number of seats', { exact: true })).toHaveValue('3');
    await page.screenshot({ path: testInfo.outputPath('start-teams-arrival-viewport.png') });
    await healthy(page, testInfo, 'start-teams-arrival');
    expect(writes).toEqual([]);
});

test('arriving from "Start Pro" starts Pro checkout once and stays on Billing if it cannot', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'free', role: 'admin' }, '?tab=billing&plan=pro');

    await expect(page.getByRole('alert').filter({ hasText: 'Checkout is not available in this test.' })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/billing/checkout', method: 'POST', body: {} }]);
    await expect(page).not.toHaveURL(/plan=pro/);
    await expect(page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true })).toBeEnabled();
    await healthy(page, testInfo, 'start-pro-arrival-refused');

    // Reloading the page the person is left on does not try again.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true })).toBeVisible();
    expect(writes).toHaveLength(1);
});

test('a Pro account arriving from "Start Pro" is not sent to checkout', async ({ page }) => {
    const { writes } = await open(page, { plan: 'pro', role: 'admin' }, '?tab=billing&plan=pro');

    await expect(page.getByRole('button', { name: 'Manage subscription', exact: true })).toBeVisible();
    expect(writes).toEqual([]);
});

test('a Teams admin changes seats in Billing, within the minimum and the seats in use', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'team', role: 'admin' }, '?tab=billing');

    await expect(page.getByText('4 seats, $28 a month', { exact: true })).toBeVisible();
    await expect(page.getByText('4 in use: 3 members and 1 pending invitation.', { exact: false })).toBeVisible();
    const seats = page.getByLabel('Number of seats', { exact: true });
    const update = page.getByRole('button', { name: 'Update seats', exact: true });
    await expect(seats).toHaveValue('4');
    await expect(update).toBeDisabled();

    await seats.fill('2');
    await expect(page.getByText('Teams starts at 3 seats.', { exact: true })).toBeVisible();
    await seats.fill('3');
    await expect(page.getByText('This workspace already uses 4 seats (members and pending invitations), so choose at least 4.', { exact: true })).toBeVisible();
    await expect(update).toBeDisabled();

    await seats.fill('6');
    await expect(page.getByText('$42/mo', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'team-admin-seats');
    await update.click();
    const dialog = page.getByRole('dialog', { name: 'Change from 4 to 6 seats?' });
    await expect(dialog.getByText('Your plan becomes $42 a month. Stripe adds the cost of the extra seats for the rest of this billing period to your next invoice.', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'team-admin-seats-confirm');
    expect(writes).toEqual([]);

    await dialog.getByRole('button', { name: 'Change to 6 seats', exact: true }).click();
    await expect(page.getByText('You now have 6 seats, $42 a month.', { exact: true })).toBeVisible();
    await expect(page.getByText('6 seats, $42 a month', { exact: true })).toBeVisible();
    await expect(seats).toHaveValue('6');
    await healthy(page, testInfo, 'team-admin-seats-changed');
    expect(writes).toEqual([{ url: '/api/organization/billing/seats', method: 'POST', body: { seats: 6 } }]);

    // A member never sees seat controls.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { plan: 'team', role: 'member' }, '?tab=billing');
    await expect(page.getByText('Your workspace admins manage this plan, its seats and its invoices.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update seats', exact: true })).toHaveCount(0);
});

test('returning from checkout waits for the account before calling a plan active', async ({ page }, testInfo) => {
    const { state } = await open(page, { plan: 'free', role: 'admin', used: 3 }, '?tab=billing&session_id=cs_test_synthetic');

    await expect(page.getByText('Confirming your Pro checkout with Stripe.', { exact: false })).toBeVisible();
    await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
    await expect(page.getByText('You’re on Pro', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true })).toBeDisabled();
    expect(new URL(page.url()).search).toBe('?tab=billing');
    await healthy(page, testInfo, 'checkout-confirming');

    state.plan = 'pro';
    await expect(page.getByText('You’re on Pro. Thanks for upgrading.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pro plan', { exact: true })).toBeVisible();
    await healthy(page, testInfo, 'checkout-confirmed');
});

test('a plan that is set to end says when, for Pro and for a Teams member', async ({ page }, testInfo) => {
    await open(page, { plan: 'pro', role: 'admin', cancelAt: '2026-11-03T12:00:00.000Z' }, '?tab=billing');

    await expect(page.getByText('Your Pro plan is set to end on November 3, 2026.', { exact: true })).toBeVisible();
    await expect(page.getByText('To keep the plan, choose Manage subscription and renew it.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage subscription', exact: true })).toBeVisible();
    await healthy(page, testInfo, 'pro-plan-ending');

    await open(page, { plan: 'team', role: 'member', cancelAt: '2026-11-03T12:00:00.000Z' }, '?tab=billing');
    await expect(page.getByText('Your Teams plan is set to end on November 3, 2026.', { exact: true })).toBeVisible();
    await expect(page.getByText('A workspace admin can keep the plan going.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Teams billing', exact: true })).toHaveCount(0);
    await healthy(page, testInfo, 'teams-member-plan-ending');
});

test('a failed Teams payment is explained, with the way to fix it for an admin', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'free', role: 'admin', lapse: 'payment_failed' }, '?tab=billing');

    await expect(page.getByText('Teams is paused because the last payment didn’t go through.', { exact: true })).toBeVisible();
    await expect(page.getByText('Since September 28, 2026 this workspace has been on the Free plan.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Teams', exact: true })).toHaveCount(0);
    await healthy(page, testInfo, 'teams-payment-failed-admin');

    await page.getByRole('button', { name: 'Manage Teams billing', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Billing is not available in this test.' })).toBeVisible();
    expect(writes).toEqual([{ url: '/api/organization/billing/portal', method: 'POST', body: {} }]);
});

test('a member sees that Teams is paused and who can fix it; an ended plan can be started again', async ({ page }, testInfo) => {
    await open(page, { plan: 'free', role: 'member', lapse: 'payment_failed' }, '?tab=billing');
    await expect(page.getByText('Teams is paused because the last payment didn’t go through.', { exact: true })).toBeVisible();
    await expect(page.getByText('A workspace admin can bring Teams back in Billing.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage Teams billing|Start Teams/ })).toHaveCount(0);
    await healthy(page, testInfo, 'teams-payment-failed-member');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { plan: 'free', role: 'admin', lapse: 'ended' }, '?tab=billing');
    await expect(page.getByText('Your Teams plan ended on September 28, 2026.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Teams', exact: true })).toBeEnabled();
    await healthy(page, testInfo, 'teams-ended-admin');
});

test('a refused Pro checkout explains why and offers Manage subscription', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'free', role: 'admin', existingSubscription: true }, '?tab=billing');

    await expect(page.getByRole('button', { name: 'Manage subscription', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Upgrade to Pro, $9/mo', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your subscription has a payment that did not go through.' })).toBeVisible();
    const manage = page.getByRole('button', { name: 'Manage subscription', exact: true });
    await expect(manage).toBeVisible();
    await healthy(page, testInfo, 'pro-checkout-refused');

    await manage.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Billing is not available in this test.' })).toBeVisible();
    expect(writes.map((write) => write.url)).toEqual(['/api/billing/checkout', '/api/billing/portal']);
});

test('the free month of Pro says when it ends and how to keep the plan', async ({ page }, testInfo) => {
    await open(page, { plan: 'pro', role: 'admin', trialEndsAt: '2026-11-03T12:00:00.000Z' }, '?tab=billing');

    await expect(page.getByText('Your free month of Pro ends on November 3, 2026.', { exact: true })).toBeVisible();
    await expect(page.getByText('To keep Pro after that, add a payment method in Manage subscription.', { exact: false })).toBeVisible();
    await expect(page.getByText('is set to end on', { exact: false })).toHaveCount(0);
    await healthy(page, testInfo, 'pro-free-month');
});

test('a refused Teams checkout explains why and offers Manage Teams billing', async ({ page }, testInfo) => {
    const { writes } = await open(page, { plan: 'free', role: 'admin', existingSubscription: true }, '?tab=billing');

    await page.getByRole('button', { name: 'Start Teams', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The Teams subscription for this workspace has a payment that did not go through.' })).toBeVisible();
    const manage = page.getByRole('button', { name: 'Manage Teams billing', exact: true });
    await expect(manage).toBeVisible();
    await healthy(page, testInfo, 'teams-checkout-refused');

    await manage.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Billing is not available in this test.' })).toBeVisible();
    expect(writes.map((write) => write.url)).toEqual(['/api/organization/billing/checkout', '/api/organization/billing/portal']);
});
