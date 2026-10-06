import { expect, test, type Page } from '@playwright/test';
const first = '00000000-0000-4000-8000-000000000011';
const second = '00000000-0000-4000-8000-000000000012';
function form(id: string, name: string, hoa: boolean) {
    return {
        id,
        name,
        slug: name.toLowerCase(),
        url: `https://example.com/i/listing${id === first ? '' : `/${name.toLowerCase()}`}`,
        endingUrl: `https://example.com/i/listing/${id === first ? 'intake' : name.toLowerCase()}`,
        linkSuffix: id === first ? 'intake' : name.toLowerCase(),
        revision: 2,
        organizationId: 'workspace-A',
        isDefault: id === first,
        isActive: true,
        is_active: true,
        sellerIntro: `${name} introduction`,
        defaultBrandProfileId: null,
        defaultUtilityCategories: ['electric', 'water'],
        defaultPacketMode: 'simple',
        advancedModules: ['service_providers'],
        advancedModuleExclusions: {},
        collectHoaQuestions: hoa,
        collectElectricMeterNumber: hoa,
    };
}
async function mocks(page: Page) {
    const forms = [
        form(first, 'Listing', false),
        form(second, 'Closing', true),
    ];
    const writes: {
        url: string;
        method: string;
        body: Record<string, unknown>;
    }[] = [];
    let conflict = false;
    const linkBase = {
        slug: 'listing', url: 'https://example.com/i/listing', revision: 2,
        formId: first, formName: 'Listing', isActive: true,
        reservedSuffixes: [{ suffix: 'intake', formId: first }, { suffix: 'closing', formId: second }],
    };
    // The default shares the bare base; every form keeps its own ending link.
    const relink = () => forms.forEach(f => {
        f.endingUrl = `${linkBase.url}/${f.linkSuffix}`;
        f.url = f.isDefault ? linkBase.url : f.endingUrl;
    });
    const access = { isPaid: true, capabilities: { canCreate: true, reason: null as string | null, usage: 2, allowance: 10, totalUsage: 2, upgradeRequired: false, pilotAvailable: true, message: '' } };
    await page.route('**/api/**', async (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const json = (body: unknown, status = 200) =>
            route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        if (req.method() !== 'GET')
            writes.push({
                url: path,
                method: req.method(),
                body: req.postDataJSON() || {},
            });
        if (path === '/api/seller-forms' && req.method() === 'POST') {
            const body = req.postDataJSON();
            if (linkBase.reservedSuffixes.some(a => a.suffix === body.suffix))
                return json({ error: 'That ending was already shared. Choose another.', code: 'SUFFIX_IN_USE' }, 409);
            return json({}, 400);
        }
        if (path === '/api/seller-forms') {
            const opened = forms.find(f => f.isDefault)!;
            return json({
                forms,
                linkBase: { ...linkBase, formId: opened.id, formName: opened.name, isActive: opened.isActive },
                defaultId: forms.find(f => f.isDefault)?.id,
                isPaid: access.isPaid,
                workspaceName: 'Workspace A',
                capabilities: access.capabilities,
                brandProfiles: [],
            });
        }
        if (path === '/api/seller-form-link-base') {
            if (conflict) return json({ error: 'Form changed. Reload before saving.', code: 'FORM_REVISION_CONFLICT' }, 409);
            Object.assign(linkBase, { slug: req.postDataJSON().base, revision: linkBase.revision + 1 });
            linkBase.url = `https://example.com/i/${linkBase.slug}`;
            relink();
            return json({ linkBase });
        }
        if (path === `/api/seller-forms/${second}/default`) {
            forms.forEach(f => { f.isDefault = f.id === second; });
            relink();
            return json({ form: forms[1] });
        }
        if (path === `/api/seller-forms/${second}`) {
            const body = req.postDataJSON();
            const taken = linkBase.reservedSuffixes.find(a => a.suffix === body.suffix && a.formId !== second);
            if (taken) return json({ error: 'That ending was already shared. Choose another.', code: 'SUFFIX_IN_USE' }, 409);
            Object.assign(forms[1], body, { revision: forms[1].revision + 1 });
            if (body.suffix) {
                forms[1].linkSuffix = body.suffix;
                relink();
                linkBase.reservedSuffixes.push({ suffix: body.suffix, formId: second });
            }
            return json({ form: forms[1] });
        }
        if (path === `/api/seller-forms/${first}`) {
            if (conflict)
                return json(
                    {
                        error: 'Form changed. Reload before saving.',
                        code: 'FORM_REVISION_CONFLICT',
                    },
                    409,
                );
            Object.assign(forms[0], req.postDataJSON(), { revision: 3 });
            return json({ form: forms[0] });
        }
        if (path === '/api/requests') {
            const body = req.postDataJSON();
            const selected = forms.find(f => f.id === body.formId);
            if (selected && selected.revision !== body.formRevision) return json({ error: 'Form changed. Reload before saving or starting.', code: 'FORM_REVISION_CONFLICT' }, 409);
            return json({ id: 'synthetic-created-request', seller_token: 'synthetic-seller-token' });
        }
        if (path === '/api/branding') return json([]);
        if (path === '/api/account')
            return json({
                account: {
                    subscription_status: 'pro',
                    notification_preferences: {},
                },
                activeOrganization: {
                    id: 'workspace-A',
                    subscription_status: 'team',
                },
            });
        if (path === '/api/intake-link')
            return json({ intakeLink: forms[0], canCustomize: true });
        if (path.startsWith('/api/intake/'))
            return json({
                accepting: true,
                sellerIntro: 'Listing introduction',
                brandProfile: null,
            });
        return json({}, 404);
    });
    return {
        forms,
        access,
        linkBase,
        writes,
        stale: () => {
            conflict = true;
        },
    };
}
async function healthy(page: Page) {
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(
        page.getByText(
            'Application error: a client-side exception has occurred',
            {
                exact: false,
            },
        ),
    ).toHaveCount(0);
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        ),
    ).toBeLessThanOrEqual(0);
}

test('base rename refreshes canonical copies and a confirmed default change moves the base link', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        const state = window as unknown as Window & { copiedLinks: string[] };
        state.copiedLinks = [];
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { state.copiedLinks.push(text); } } });
    });
    const state = await mocks(page);
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByLabel('Base link name')).toHaveValue('listing');
    await page.getByLabel('Base link name').fill('jane-smith');
    await page.getByRole('button', { name: 'Save base link', exact: true }).click();
    const formCards = page.locator('[data-slot="card"]').filter({ has: page.getByRole('button', { name: 'Copy link', exact: true }) });
    const closing = formCards.filter({ has: page.getByText('Closing', { exact: true }) });
    const listing = formCards.filter({ has: page.getByText('Listing', { exact: true }) });
    await expect(listing.getByText('Also opens from https://example.com/i/jane-smith/intake', { exact: true })).toBeVisible();
    await expect(closing.getByText('https://example.com/i/jane-smith/closing', { exact: true })).toBeVisible();
    expect(state.writes[0]).toMatchObject({ url: '/api/seller-form-link-base', body: { base: 'jane-smith', revision: 2 } });
    await closing.getByRole('button', { name: 'Copy link', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as Window & { copiedLinks: string[] }).copiedLinks)).toEqual(['https://example.com/i/jane-smith/closing']);
    // Declining the confirmation changes nothing.
    const prompts: string[] = [];
    page.once('dialog', dialog => { prompts.push(dialog.message()); void dialog.dismiss(); });
    await closing.getByRole('button', { name: 'Make default' }).click();
    expect(prompts[0]).toContain('https://example.com/i/jane-smith will open it from now on');
    expect(state.writes).toHaveLength(1);
    await expect(page.getByText(/The base link currently opens/)).toContainText('Listing');
    page.once('dialog', dialog => void dialog.accept());
    await closing.getByRole('button', { name: 'Make default' }).click();
    await expect(closing.getByText('Default', { exact: true })).toBeVisible();
    await expect(page.getByText(/The base link currently opens/)).toContainText('Closing');
    await expect(closing.getByText('https://example.com/i/jane-smith', { exact: true })).toBeVisible();
    await expect(closing.getByText('Also opens from https://example.com/i/jane-smith/closing', { exact: true })).toBeVisible();
    await expect(listing.getByText('https://example.com/i/jane-smith/intake', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Base link name')).toHaveValue('jane-smith');
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('shared-base-links.png'), fullPage: true });
    expect(errors).toEqual([]);
});

test('suffix editing keeps configuration and duplicate collisions keep the unsaved draft', async ({ page }, testInfo) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await expect(page.getByLabel('Link ending', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Legacy reusable link')).toHaveCount(0);
    await page.getByLabel('Link ending', { exact: true }).fill('detailed');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByText('Seller form saved')).toBeVisible();
    expect(state.writes[0].body).toMatchObject({ suffix: 'detailed', revision: 2 });
    expect(state.writes[0].body).not.toHaveProperty('slug');
    expect(state.forms[1].url).toBe('https://example.com/i/listing/detailed');
    await page.goto(`/test-fixtures/seller-forms?id=new&duplicate=${second}`);
    await expect(page.getByLabel('Link ending', { exact: true })).toHaveValue('closing-copy');
    await page.getByLabel('Internal form name').fill('Listing');
    await expect(page.getByLabel('Link ending', { exact: true })).toHaveValue('listing');
    await page.getByLabel('Link ending', { exact: true }).fill('closing');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That ending was already shared' })).toBeVisible();
    await expect(page.getByLabel('Link ending', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Internal form name')).toHaveValue('Listing');
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('suffix-collision.png'), fullPage: true });
});

test('downgrade keeps canonical links and prevents link edits while ordinary form edits work', async ({ page }) => {
    const state = await mocks(page);
    state.access.isPaid = false;
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByLabel('Base link name')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Pro or Teams', exact: true })).toHaveAttribute('href', '/dashboard/settings?tab=billing');
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await expect(page.getByLabel('Link ending', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Link ending', { exact: true })).toBeDisabled();
    await page.getByLabel('Internal form name').fill('Retained configuration');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByText('Seller form saved')).toBeVisible();
    expect(state.writes[0].body).not.toHaveProperty('suffix');
    expect(state.forms[1].url).toBe('https://example.com/i/listing/closing');
    await healthy(page);
});
test('two forms have independent settings; draft preview sends no writes and stale saves keep the draft', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = await mocks(page);
    await page.goto('/test-fixtures/seller-forms');
    await expect(
        page.getByRole('heading', { name: 'Seller forms' }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="card"]').getByText('Listing', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Closing', { exact: true })).toBeVisible();
    await healthy(page);
    await page.goto(`/test-fixtures/seller-forms?id=${first}`);
    await expect(page.getByLabel('Internal form name')).toHaveValue('Listing');
    await expect(
        page.getByRole('switch', {
            name: 'Ask about HOA or condo association',
        }),
    ).toHaveAttribute('aria-checked', 'false');
    await page
        .getByLabel('Seller introduction (optional)')
        .fill('<b>Draft introduction</b>');
    await page
        .getByRole('button', { name: 'Preview seller form', exact: true })
        .click();
    await expect(
        page
            .getByRole('dialog')
            .getByText('<b>Draft introduction</b>', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('dialog').locator('b')).toHaveCount(0);
    await page.getByTestId('seller-welcome-continue').click();
    const previewDialog = page.getByRole('dialog');
    await expect(previewDialog.getByRole('heading', { name: 'Home Basics' })).toBeVisible();
    const waterChoice = previewDialog.getByRole('button', { name: /Public Water/ });
    await expect(waterChoice).toBeVisible();
    const choiceBounds = await waterChoice.boundingBox();
    expect(choiceBounds!.width).toBeGreaterThan(120);
    expect(choiceBounds!.height).toBeLessThan(160);
    const dialogBounds = await previewDialog.boundingBox();
    expect(choiceBounds!.x).toBeGreaterThanOrEqual(dialogBounds!.x);
    expect(choiceBounds!.x + choiceBounds!.width).toBeLessThanOrEqual(dialogBounds!.x + dialogBounds!.width);
    await expect.poll(() => previewDialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(state.writes).toHaveLength(0);
    await page.keyboard.press('Escape');
    await page
        .getByRole('switch', { name: 'Ask about HOA or condo association' })
        .click();
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByText('Seller form saved')).toBeVisible();
    expect(state.writes[0].body).toMatchObject({
        revision: 2,
        collectHoaQuestions: true,
    });
    expect(state.forms[1].sellerIntro).toBe('Closing introduction');
    state.stale();
    await page.getByLabel('Internal form name').fill('My unsaved revision');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Reload form' }),
    ).toBeVisible();
    await expect(page.getByLabel('Internal form name')).toHaveValue(
        'My unsaved revision',
    );
    expect(errors).toEqual([]);
    await healthy(page);
});

test('duplication stays an unsaved draft and a paused default cannot be shared', async ({
    page,
}) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=new&duplicate=${first}`);
    await expect(page.getByLabel('Internal form name')).toHaveValue(
        'Listing copy',
    );
    await expect(page.getByLabel('Seller introduction (optional)')).toHaveValue(
        'Listing introduction',
    );
    await expect(page.getByLabel('Reusable link')).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
    state.forms[0].isActive = false;
    await page.goto('/test-fixtures/seller-forms');
    const listing = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText('Listing', { exact: true }) });
    await expect(
        listing.getByRole('button', { name: 'Copy link', exact: true }),
    ).toBeDisabled();
    await expect(listing.getByText('Default', { exact: true })).toBeVisible();
    await expect(listing.getByText('Paused', { exact: true })).toBeVisible();
    await healthy(page);
});
test('request form switching confirms request-only changes and keeps the fixed workspace visible', async ({
    page,
}) => {
    await mocks(page);
    await page.goto('/test-fixtures/seller-forms?request=1&onboarding=1');
    await expect(page.getByLabel('Seller form', { exact: true })).toHaveValue(
        first,
    );
    await page.getByTestId('new-request-step-1-continue').click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page
        .getByRole('switch', { name: 'Ask about HOA or condo association' })
        .click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByLabel('Seller form', { exact: true }).selectOption(second);
    await expect(page.getByLabel('Seller form', { exact: true })).toHaveValue(
        first,
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Seller form', { exact: true }).selectOption(second);
    await expect(
        page.getByText('Seller introduction: Closing introduction'),
    ).toBeVisible();
    await page.getByLabel('Seller form', { exact: true }).selectOption(first);
    await expect(
        page.getByText('Seller introduction: Listing introduction'),
    ).toBeVisible();
    await healthy(page);
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await expect(
        page.getByText(
            'Submissions go to Workspace A. This destination stays fixed.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('switch', {
            name: 'Ask about HOA or condo association',
        }),
    ).toHaveAttribute('aria-checked', 'true');
    await healthy(page);
    if (process.env.QA_SHOT_DIR)
        await page.screenshot({
            path: `${process.env.QA_SHOT_DIR}/${test.info().project.name.replace(/\s/g, '-')}-saved-form.png`,
            fullPage: true,
        });
});


for (const keepSettings of [true, false]) {
    test(`stale individual request recovers with latest form and ${keepSettings ? 'retains overrides' : 'reloads defaults'}`, async ({ page }) => {
        const state = await mocks(page);
        const exceptions: string[] = [];
        page.on('pageerror', error => exceptions.push(error.message));
        await page.goto('/test-fixtures/seller-forms?request=1&onboarding=1');
        await expect(page.getByLabel('Seller form', { exact: true })).toHaveValue(first);
        await page.getByTestId('new-request-address-input').fill('456 Synthetic Street');
        await page.getByTestId('new-request-step-1-continue').click();
        await page.getByRole('button', { name: /^continue$/i }).click();
        await page.getByLabel('Seller Name').fill('Synthetic Seller');
        await page.getByLabel('Email', { exact: true }).fill('seller@example.test');
        await page.getByLabel('Phone', { exact: true }).fill('5550101234');
        await page.getByLabel('Closing Date').fill('2026-12-01');
        await page.getByText('Send email notification to seller', { exact: true }).click();
        await page.getByRole('button', { name: /^continue$/i }).click();
        await page.getByRole('switch', { name: 'Ask about HOA or condo association' }).click();
        Object.assign(state.forms[0], { revision: 3, defaultUtilityCategories: ['water'], collectElectricMeterNumber: true, sellerIntro: 'Current introduction' });
        await page.getByTestId('new-request-create').click();
        await expect(page.getByText('Form changed. Reload before saving or starting.', { exact: true })).toBeVisible();
        await expect(page.getByTestId('new-request-create')).toBeDisabled();
        const recovery = page.getByRole('button', { name: keepSettings ? 'Refresh form and keep my settings' : 'Reload form defaults' });
        await recovery.scrollIntoViewIfNeeded();
        await healthy(page);
        if (process.env.QA_SHOT_DIR && keepSettings) await page.screenshot({ path: `${process.env.QA_SHOT_DIR}/${test.info().project.name.replace(/\s/g, '-')}-request-recovery.png`, fullPage: false });
        await recovery.click();
        await expect(page.getByText('Seller introduction: Current introduction')).toBeVisible();
        await expect(page.getByRole('switch', { name: 'Ask about HOA or condo association' })).toHaveAttribute('aria-checked', String(keepSettings));
        await expect(page.getByTestId('new-request-create')).toBeEnabled();
        expect(state.writes.filter(w => w.url === '/api/requests')).toHaveLength(1);
        await page.getByTestId('new-request-create').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        const submits = state.writes.filter(w => w.url === '/api/requests');
        expect(submits).toHaveLength(2);
        expect(submits[1].body).toMatchObject({ formId: first, formRevision: 3, propertyAddress: '456 Synthetic Street', sellerName: 'Synthetic Seller', sellerEmail: 'seller@example.test', sellerPhone: '5550101234', closingDate: '2026-12-01', sendSellerEmail: false, collectHoaQuestions: keepSettings, collectElectricMeterNumber: !keepSettings, utilityCategories: keepSettings ? ['electric', 'water'] : ['water'] });
        expect(exceptions).toEqual([]);
    });
}


test('Free creation actions explain Pro while customization and retained downgraded forms stay accessible', async ({ page }) => {
    const state = await mocks(page);
    state.forms.splice(1, 1);
    state.access.isPaid = false;
    Object.assign(state.access.capabilities, { canCreate: false, reason: 'commercial', pilotAvailable: false, usage: 1, allowance: 1, totalUsage: 1, upgradeRequired: true, message: 'Free includes one customizable form per workspace. Upgrade to Pro for up to ten.' });
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByText('1 of 1 forms in this workspace (including paused forms).')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Preview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'New form Pro' }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Save more workflows with Pro');
    await expect(page.getByRole('dialog').getByText('Additional forms are temporarily unavailable.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Pro upgrade' })).toHaveAttribute('href', '/dashboard/settings?tab=billing');
    if (process.env.QA_SHOT_DIR) await page.screenshot({ path: `${process.env.QA_SHOT_DIR}/${test.info().project.name.replace(/\s/g, '-')}-form-upgrade.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Duplicate Pro' }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Save more workflows with Pro');
    expect(state.writes).toHaveLength(0);
    await page.keyboard.press('Escape');
    state.forms.push(form(second, 'Retained', true)); state.forms[1].isActive = false;
    Object.assign(state.access.capabilities, { usage: 2, totalUsage: 2 });
    await page.reload();
    await expect(page.getByText(/Your existing forms, links and configurations are kept/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(2);
    await healthy(page);
});

test('commercial paid limit and pilot/technical denials have distinct explanations; prices are unchanged', async ({ page }) => {
    const state = await mocks(page);
    const cases = [
        { reason: 'commercial', message: 'This workspace has reached its allowance of ten forms. Edit or reuse an existing form.' },
        { reason: 'pilot', message: 'Additional forms are temporarily unavailable for this account.' },
        { reason: 'technical', message: 'The account form limit has been reached. Existing forms remain available.' },
    ];
    for (const policy of cases) {
        Object.assign(state.access.capabilities, { canCreate: false, upgradeRequired: false, ...policy });
        await page.goto('/test-fixtures/seller-forms');
        await page.getByRole('button', { name: 'New form', exact: true }).click();
        await expect(page.getByRole('dialog').getByText(policy.message)).toBeVisible();
        await expect(page.getByRole('link', { name: 'View Pro upgrade' })).toHaveCount(0);
        await page.keyboard.press('Escape');
    }
    await page.goto('/pricing');
    await expect(page.getByText('1 customizable seller form per workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Up to 10 saved seller forms per workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Up to 10 saved seller forms per member', { exact: true })).toBeVisible();
    await expect(page.getByText('$9', { exact: true })).toBeVisible();
    await expect(page.getByText('$7', { exact: true })).toBeVisible();
    await healthy(page);
});


test('HOA-first preview filters billing choices and explains conflicting answers', async ({ page }) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=${first}`);
    await page.getByRole('switch', { name: 'Ask about HOA or condo association' }).click();
    await page.getByRole('button', { name: 'Preview seller form', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('seller-welcome-continue').click();
    const yes = dialog.getByTestId('has-hoa-yes');
    const water = dialog.getByRole('button', { name: /Public Water/ });
    await expect(yes).toBeVisible();
    expect((await yes.boundingBox())!.y).toBeLessThan((await water.boundingBox())!.y);
    await yes.click();
    await expect(dialog.getByTestId('hoa-details')).toBeVisible();
    const choices = dialog.getByRole('button', { name: /Included in HOA/ });
    await choices.nth(0).click();
    await choices.nth(1).click();
    await dialog.getByTestId('has-hoa-no').click();
    await expect(choices).toHaveCount(0);
    await expect(dialog.getByRole('status')).toContainText('water and sewer selections');
    await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await water.click();
    await dialog.getByRole('button', { name: /Public Sewer/ }).click();
    await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    await expect.poll(() => dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await dialog.getByTestId('has-hoa-not_sure').click();
    await expect(choices).toHaveCount(2);
    expect(state.writes).toHaveLength(0);
});
