import { expect, test, type Page } from '@playwright/test';
const first = '00000000-0000-4000-8000-000000000011';
const second = '00000000-0000-4000-8000-000000000012';
const teammates = '00000000-0000-4000-8000-000000000013';
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
        shared: false,
        isMine: true,
        canEdit: true,
        canShare: true,
        canDelete: id !== first,
        ownerName: null as string | null,
    };
}
/** A form a teammate shared with the workspace, as a member who is not an admin sees it. */
function teammateForm() {
    return {
        ...form(teammates, 'Offer', false),
        url: 'https://example.com/i/jane-smith/offer',
        endingUrl: 'https://example.com/i/jane-smith/offer',
        linkSuffix: 'offer',
        isDefault: false,
        shared: true,
        isMine: false,
        canEdit: false,
        canShare: false,
        canDelete: false,
        ownerName: 'Jane Smith',
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
    const relink = () => forms.filter(f => f.isMine).forEach(f => {
        f.endingUrl = `${linkBase.url}/${f.linkSuffix}`;
        f.url = f.isDefault ? linkBase.url : f.endingUrl;
        f.canDelete = !f.isDefault;
    });
    const access = { isPaid: true, capabilities: { canCreate: true, reason: null as string | null, usage: 2, allowance: 10, totalUsage: 2, upgradeRequired: false, pilotAvailable: true, message: '', sharing: { available: true, canShare: true, usage: 0, allowance: 20, message: '' } } };
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
                return json({ error: 'Another of your forms uses that link, or used it before. Choose a different one.', code: 'SUFFIX_IN_USE' }, 409);
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
        const shareMatch = path.match(/^\/api\/seller-forms\/([^/]+)\/share$/);
        if (shareMatch) {
            const target = forms.find(f => f.id === shareMatch[1])!;
            Object.assign(target, { shared: req.postDataJSON().shared, revision: target.revision + 1 });
            access.capabilities.sharing.usage = forms.filter(f => f.shared).length;
            return json({ form: target });
        }
        if (req.method() === 'DELETE' && path.startsWith('/api/seller-forms/')) {
            const index = forms.findIndex(f => path.endsWith(f.id));
            if (forms[index].isDefault) return json({ error: 'Make another form the default before deleting this one.', code: 'FORM_IS_DEFAULT' }, 409);
            const [gone] = forms.splice(index, 1);
            return json({ deleted: true, id: gone.id });
        }
        if (path === '/api/seller-form-link-base') {
            if (conflict) return json({ error: 'This form was just updated. Reload the page, then try again.', code: 'FORM_REVISION_CONFLICT' }, 409);
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
            if (taken) return json({ error: 'Another of your forms uses that link, or used it before. Choose a different one.', code: 'SUFFIX_IN_USE' }, 409);
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
                        error: 'This form was just updated. Reload the page, then try again.',
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
            if (selected && selected.revision !== body.formRevision) return json({ error: 'This form was just updated. Reload the page, then try again.', code: 'FORM_REVISION_CONFLICT' }, 409);
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
/** Opens a form card's "more" menu and chooses one action. */
async function cardAction(page: Page, formName: string, action: string) {
    await page.getByRole('button', { name: `More actions for ${formName}`, exact: true }).click();
    await page.getByRole('menuitem', { name: action, exact: true }).click();
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
    await page.getByRole('button', { name: 'Rename main link', exact: true }).click();
    await expect(page.getByLabel('Link name', { exact: true })).toHaveValue('listing');
    await page.getByLabel('Link name', { exact: true }).fill('jane-smith');
    await page.getByRole('button', { name: 'Save link name', exact: true }).click();
    const formCards = page.locator('[data-slot="card"]').filter({ has: page.getByRole('button', { name: 'Copy link', exact: true }) });
    const closing = formCards.filter({ has: page.getByText('Closing', { exact: true }) });
    const listing = formCards.filter({ has: page.getByText('Listing', { exact: true }) });
    await expect(listing.getByText("This is your main link. This form's own link is https://example.com/i/jane-smith/intake", { exact: true })).toBeVisible();
    await expect(closing.getByText('https://example.com/i/jane-smith/closing', { exact: true })).toBeVisible();
    expect(state.writes[0]).toMatchObject({ url: '/api/seller-form-link-base', body: { base: 'jane-smith', revision: 2 } });
    await closing.getByRole('button', { name: 'Copy link', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as Window & { copiedLinks: string[] }).copiedLinks)).toEqual(['https://example.com/i/jane-smith/closing']);
    // Declining the confirmation changes nothing.
    await cardAction(page, 'Closing', 'Make default');
    const confirmDefault = page.getByRole('dialog');
    await expect(confirmDefault).toContainText('Your main link (https://example.com/i/jane-smith) will open it from now on');
    await confirmDefault.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmDefault).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    await expect(page.getByText(/Your main link currently opens/)).toContainText('Listing');
    await cardAction(page, 'Closing', 'Make default');
    await page.getByRole('dialog').getByRole('button', { name: 'Make default', exact: true }).click();
    await expect(closing.getByText('Default', { exact: true })).toBeVisible();
    await expect(page.getByText(/Your main link currently opens/)).toContainText('Closing');
    await expect(closing.getByText('https://example.com/i/jane-smith', { exact: true })).toBeVisible();
    await expect(closing.getByText("This is your main link. This form's own link is https://example.com/i/jane-smith/closing", { exact: true })).toBeVisible();
    await expect(listing.getByText('https://example.com/i/jane-smith/intake', { exact: true })).toBeVisible();
    await expect(page.getByText('https://example.com/i/jane-smith', { exact: true })).toHaveCount(2);
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('shared-base-links.png'), fullPage: true });
    expect(errors).toEqual([]);
});

test('a form link is renamed in place on its card and a taken ending keeps the draft', async ({ page }) => {
    const state = await mocks(page);
    await page.goto('/test-fixtures/seller-forms');
    const formCards = page.locator('[data-slot="card"]').filter({ has: page.getByRole('button', { name: 'Copy link', exact: true }) });
    const closing = formCards.filter({ has: page.getByText('Closing', { exact: true }) });
    await cardAction(page, 'Closing', 'Rename link');
    const ending = page.getByLabel('Link for Closing');
    await expect(ending).toHaveValue('closing');
    await ending.fill('Not Valid');
    await closing.getByRole('button', { name: 'Save link', exact: true }).click();
    await expect(closing.getByRole('alert')).toContainText('lowercase');
    expect(state.writes).toHaveLength(0);
    await ending.fill('intake');
    await closing.getByRole('button', { name: 'Save link', exact: true }).click();
    await expect(closing.getByRole('alert')).toContainText('Another of your forms uses that link');
    await expect(ending).toHaveValue('intake');
    await ending.fill('closing-docs');
    await closing.getByRole('button', { name: 'Save link', exact: true }).click();
    await expect(closing.getByText('https://example.com/i/listing/closing-docs', { exact: true })).toBeVisible();
    await expect(ending).toHaveCount(0);
    expect(state.writes.at(-1)).toMatchObject({ url: `/api/seller-forms/${second}`, method: 'PATCH', body: { suffix: 'closing-docs', revision: 2 } });
    // The default form's own link is renamable too; its main link is untouched.
    const listing = formCards.filter({ has: page.getByText('Listing', { exact: true }) });
    await cardAction(page, 'Listing', 'Rename link');
    await expect(page.getByLabel('Link for Listing')).toHaveValue('intake');
    await listing.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(listing.getByText('https://example.com/i/listing', { exact: true })).toBeVisible();
    await healthy(page);
    // Free keeps links but offers no rename.
    state.access.isPaid = false;
    await page.reload();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'More actions for Closing', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Rename link', exact: true })).toHaveCount(0);
    // A locked action stays clickable and leads to billing.
    await expect(page.getByRole('menuitem', { name: 'Rename link Upgrade', exact: true })).toBeEnabled();
});

test('suffix editing keeps configuration and duplicate collisions keep the unsaved draft', async ({ page }, testInfo) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await expect(page.getByLabel('Form link', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Legacy reusable link')).toHaveCount(0);
    await page.getByLabel('Form link', { exact: true }).fill('detailed');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByText('Seller form saved')).toBeVisible();
    expect(state.writes[0].body).toMatchObject({ suffix: 'detailed', revision: 2 });
    expect(state.writes[0].body).not.toHaveProperty('slug');
    expect(state.forms[1].url).toBe('https://example.com/i/listing/detailed');
    await page.goto(`/test-fixtures/seller-forms?id=new&duplicate=${second}`);
    await expect(page.getByLabel('Form link', { exact: true })).toHaveValue('closing-copy');
    await page.getByLabel('Form name', { exact: true }).fill('Listing');
    await expect(page.getByLabel('Form link', { exact: true })).toHaveValue('listing');
    await page.getByLabel('Form link', { exact: true }).fill('closing');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Another of your forms uses that link' })).toBeVisible();
    await expect(page.getByLabel('Form link', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Form name', { exact: true })).toHaveValue('Listing');
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('suffix-collision.png'), fullPage: true });
});

test('downgrade keeps canonical links and prevents link edits while ordinary form edits work', async ({ page }) => {
    const state = await mocks(page);
    state.access.isPaid = false;
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByRole('button', { name: 'Rename main link', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pro or Teams', exact: true })).toHaveAttribute('href', '/dashboard/settings?tab=billing');
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await expect(page.getByLabel('Form link', { exact: true })).toHaveValue('closing');
    await expect(page.getByLabel('Form link', { exact: true })).toBeDisabled();
    await page.getByLabel('Form name', { exact: true }).fill('Retained configuration');
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
    await expect(page.getByLabel('Form name', { exact: true })).toHaveValue('Listing');
    await expect(
        page.getByRole('switch', {
            name: 'Ask about HOA or condo association',
        }),
    ).toHaveAttribute('aria-checked', 'false');
    // The stored introduction is custom; the heading shows the standard wording.
    await expect(page.getByLabel('Seller heading')).toHaveValue('Share your home’s utility details');
    const firstScreen = page.getByTestId('seller-intro-preview');
    await expect(firstScreen.getByText('Listing introduction', { exact: true })).toBeVisible();
    await expect(firstScreen.getByText('Your progress saves automatically.')).toBeVisible();
    await page.getByLabel('Seller heading').fill('Welcome, sellers');
    await expect(firstScreen.getByText('Welcome, sellers', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use the standard introduction' }).click();
    await expect(page.getByLabel('Seller introduction')).toHaveValue('The team helping with the sale of your home sent you this link to collect utility information for the buyer.');
    await page
        .getByLabel('Seller introduction')
        .fill('<b>Draft introduction</b>');
    await expect(firstScreen.getByText('<b>Draft introduction</b>', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use the standard heading' }).click();
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
        // An untouched standard heading is stored as empty.
        sellerHeading: null,
        sellerIntro: '<b>Draft introduction</b>',
    });
    expect(state.forms[1].sellerIntro).toBe('Closing introduction');
    state.stale();
    await page.getByLabel('Form name', { exact: true }).fill('My unsaved revision');
    await page.getByRole('button', { name: 'Save form', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Reload form' }),
    ).toBeVisible();
    await expect(page.getByLabel('Form name', { exact: true })).toHaveValue(
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
    await expect(page.getByLabel('Form name', { exact: true })).toHaveValue(
        'Listing copy',
    );
    await expect(page.getByLabel('Seller introduction')).toHaveValue(
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
    // Resume and pause act right away from the card.
    await listing.getByRole('button', { name: 'Resume form', exact: true }).click();
    await expect(listing.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();
    expect(state.writes.at(-1)).toMatchObject({ url: `/api/seller-forms/${first}`, method: 'PATCH', body: { isActive: true, revision: 2 } });
    await cardAction(page, 'Closing', 'Pause form');
    await expect(page.getByRole('dialog')).toContainText('Sellers who already started can still finish');
    await page.getByRole('dialog').getByRole('button', { name: 'Pause form', exact: true }).click();
    const closing = page.locator('[data-slot="card"]').filter({ has: page.getByText('Closing', { exact: true }) });
    await expect(closing.getByText('Paused', { exact: true })).toBeVisible();
    expect(state.writes.at(-1)).toMatchObject({ url: `/api/seller-forms/${second}`, method: 'PATCH', body: { isActive: false, revision: 2 } });
    await healthy(page);
});

test('a single form shows one link and renames the main link from its card', async ({ page }, testInfo) => {
    const state = await mocks(page);
    state.forms.splice(1, 1);
    Object.assign(state.access.capabilities, { usage: 1, totalUsage: 1 });
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(1);
    await expect(page.getByText('Main link', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/own link is/)).toHaveCount(0);
    await expect(page.getByText('Default', { exact: true })).toHaveCount(0);
    await expect(page.getByText('https://example.com/i/listing', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'More actions for Listing', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Make default', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Rename link', exact: true }).click();
    await page.getByLabel('Link name', { exact: true }).fill('jane-smith');
    await page.getByRole('button', { name: 'Save link name', exact: true }).click();
    await expect(page.getByText('https://example.com/i/jane-smith', { exact: true })).toBeVisible();
    expect(state.writes.at(-1)).toMatchObject({ url: '/api/seller-form-link-base', body: { base: 'jane-smith', revision: 2 } });
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('single-form.png'), fullPage: true });
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
            'Answers from this form always go to Workspace A.',
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
        await page.getByText('Email the seller their link', { exact: true }).click();
        await page.getByRole('button', { name: /^continue$/i }).click();
        await page.getByRole('switch', { name: 'Ask about HOA or condo association' }).click();
        Object.assign(state.forms[0], { revision: 3, defaultUtilityCategories: ['water'], collectElectricMeterNumber: true, sellerIntro: 'Current introduction' });
        await page.getByTestId('new-request-create').click();
        await expect(page.getByText('This form was just updated. Reload the page, then try again.', { exact: true })).toBeVisible();
        await expect(page.getByTestId('new-request-create')).toBeDisabled();
        const recovery = page.getByRole('button', { name: keepSettings ? 'Keep my choices' : 'Use the form’s latest settings' });
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
    await expect(page.getByText('Using 1 of 1 form in Workspace A. Paused forms count.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeEnabled();
    await expect(page.getByText('Main link', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'More actions for Listing', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Preview', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'New form Pro' }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Add more forms with Pro');
    await expect(page.getByRole('dialog').getByText('New forms can’t be added right now.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Pro' })).toHaveAttribute('href', '/dashboard/settings?tab=billing');
    if (process.env.QA_SHOT_DIR) await page.screenshot({ path: `${process.env.QA_SHOT_DIR}/${test.info().project.name.replace(/\s/g, '-')}-form-upgrade.png`, fullPage: false });
    await page.keyboard.press('Escape');
    await cardAction(page, 'Listing', 'Duplicate Pro');
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Add more forms with Pro');
    expect(state.writes).toHaveLength(0);
    await page.keyboard.press('Escape');
    state.forms.push(form(second, 'Retained', true)); state.forms[1].isActive = false;
    Object.assign(state.access.capabilities, { usage: 2, totalUsage: 2 });
    await page.reload();
    await expect(page.getByText(/Your existing forms, links and settings are kept/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(2);
    await healthy(page);
});

test('commercial paid limit and pilot/technical denials have distinct explanations; prices are unchanged', async ({ page }) => {
    const state = await mocks(page);
    const cases = [
        { reason: 'commercial', message: 'This workspace has reached its limit of ten forms. Edit or reuse one you already have.' },
        { reason: 'pilot', message: 'New forms can’t be added to this account right now. Your existing forms still work.' },
        { reason: 'technical', message: 'You’ve reached the most forms one account can have. Your existing forms still work.' },
    ];
    for (const policy of cases) {
        Object.assign(state.access.capabilities, { canCreate: false, upgradeRequired: false, ...policy });
        await page.goto('/test-fixtures/seller-forms');
        await page.getByRole('button', { name: 'New form', exact: true }).click();
        await expect(page.getByRole('dialog').getByText(policy.message)).toBeVisible();
        await expect(page.getByRole('link', { name: 'See Pro' })).toHaveCount(0);
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

test('a form is shared with the workspace, taken back and deleted from its card', async ({ page }, testInfo) => {
    const state = await mocks(page);
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByText('Workspace A is sharing 0 of 20 forms.')).toBeVisible();

    await cardAction(page, 'Closing', 'Share with workspace');
    const shareDialog = page.getByRole('dialog', { name: 'Share "Closing" with Workspace A?' });
    await expect(shareDialog).toContainText('Only you and workspace admins can change it. Its link stays the same.');
    await page.screenshot({ path: testInfo.outputPath('share-dialog.png') });
    await shareDialog.getByRole('button', { name: 'Share form', exact: true }).click();
    await expect(page.getByText('Shared with workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Workspace A is sharing 1 of 20 forms.')).toBeVisible();
    expect(state.writes.at(-1)).toMatchObject({ url: `/api/seller-forms/${second}/share`, method: 'PUT', body: { shared: true, revision: 2 } });
    await page.screenshot({ path: testInfo.outputPath('shared-form.png'), fullPage: true });

    await cardAction(page, 'Closing', 'Stop sharing');
    await page.getByRole('dialog', { name: 'Stop sharing "Closing"?' }).getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await expect(page.getByText('Shared with workspace', { exact: true })).toHaveCount(0);
    expect(state.writes.at(-1)).toMatchObject({ method: 'PUT', body: { shared: false, revision: 3 } });

    // The default form explains why it cannot be deleted.
    await page.getByRole('button', { name: 'More actions for Listing', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /Delete form/ })).toBeDisabled();
    await expect(page.getByText('Make another form the default first.')).toBeVisible();
    await page.keyboard.press('Escape');

    await cardAction(page, 'Closing', 'Delete form');
    const deleteDialog = page.getByRole('dialog', { name: 'Delete "Closing"?' });
    await expect(deleteDialog).toContainText('This cannot be undone. Requests already created from it are kept');
    await page.screenshot({ path: testInfo.outputPath('delete-dialog.png') });
    await deleteDialog.getByRole('button', { name: 'Delete form', exact: true }).click();
    await expect(page.getByRole('button', { name: 'More actions for Closing', exact: true })).toHaveCount(0);
    expect(state.writes.at(-1)).toMatchObject({ url: `/api/seller-forms/${second}`, method: 'DELETE', body: { revision: 4 } });
    await healthy(page);
});

test('a teammate\'s shared form can be used but not changed, and sharing leads to Teams when the plan lacks it', async ({ page }, testInfo) => {
    const state = await mocks(page);
    state.forms.push(teammateForm());
    await page.goto('/test-fixtures/seller-forms');
    await expect(page.getByRole('heading', { name: 'Shared by your team' })).toBeVisible();
    await expect(page.getByText('Shared by Jane Smith', { exact: true })).toBeVisible();
    await expect(page.getByText('https://example.com/i/jane-smith/offer', { exact: true })).toBeVisible();
    await expect(page.getByText('Only Jane Smith and workspace admins can change it.')).toBeVisible();
    // The main link card and the default badge still describe only my own forms.
    await expect(page.getByText('Default', { exact: true })).toHaveCount(1);

    await page.getByRole('button', { name: 'More actions for Offer', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Preview', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copy to my forms', exact: true })).toBeVisible();
    for (const hidden of ['Pause form', 'Stop sharing', 'Make default', 'Rename link', 'Share with workspace'])
        await expect(page.getByRole('menuitem', { name: hidden, exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /Delete form/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await healthy(page);
    await page.screenshot({ path: testInfo.outputPath('team-forms.png'), fullPage: true });

    // Opened directly, it explains itself and cannot be saved.
    await page.goto(`/test-fixtures/seller-forms?id=${teammates}`);
    await expect(page.getByRole('note')).toContainText('Jane Smith shared this form with Workspace A.');
    await expect(page.getByRole('button', { name: 'Save form', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Pause form', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete form', exact: true })).toHaveCount(0);
    expect(state.writes).toHaveLength(0);

    // Without Teams, sharing is offered as an upgrade and writes nothing.
    Object.assign(state.access.capabilities.sharing, { available: false, canShare: false, allowance: 0 });
    await page.goto('/test-fixtures/seller-forms');
    await page.getByRole('button', { name: 'More actions for Closing', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /Share with workspace/ })).toContainText('Teams');
    await expect(page.getByText(/is sharing/)).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
});

test('the editor shares, and deletes after confirming', async ({ page }) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=${second}`);
    await page.getByRole('button', { name: 'Share with workspace', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Share form', exact: true }).click();
    await expect(page.getByText('Shared with Workspace A', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete form', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete "Closing"?' }).getByRole('button', { name: 'Delete form', exact: true }).click();
    await expect.poll(() => state.writes.at(-1)).toMatchObject({ method: 'DELETE', body: { revision: 3 } });
});

test('the editor says what to do before a default form can be deleted', async ({ page }) => {
    const state = await mocks(page);
    await page.goto(`/test-fixtures/seller-forms?id=${first}`);
    await expect(page.getByText('This is your default form. Make another form the default first, then you can delete this one.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete form', exact: true })).toBeDisabled();
    expect(state.writes).toHaveLength(0);
});
