import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Keyboard focus containment for dialogs built on components/ui/dialog.tsx.
 * Uses /onboarding (sample sheet dialog) and the dev-only
 * /test-fixtures/dialogs page. Every /api call is mocked; nothing is
 * submitted or deleted.
 */

type Writes = { feedback: number; deletes: number };

async function mockApis(page: Page): Promise<Writes> {
    const writes: Writes = { feedback: 0, deletes: 0 };
    const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/api/**', (route) => {
        const request = route.request();
        const url = request.url();
        if (url.includes('/api/feedback')) writes.feedback += 1;
        if (request.method() === 'DELETE') writes.deletes += 1;
        if (url.endsWith('/api/account')) {
            return route.fulfill(json({
                account: { id: 'acc_fixture', full_name: 'Fixture User', email: 'fixture@example.com', subscription_status: 'free' },
                activeOrganization: null,
            }));
        }
        if (url.endsWith('/api/branding')) return route.fulfill(json([]));
        if (url.endsWith('/api/intake-link')) {
            return route.fulfill(json({ intakeLink: { slug: 'fixture', url: 'https://example.com/i/fixture', is_active: true } }));
        }
        if (url.endsWith('/api/test-drive')) return route.fulfill(json({ status: 'eligible' }));
        return route.fulfill(json({ error: 'Not mocked' }, 404));
    });
    return writes;
}

type FocusInfo = { zone: 'dialog' | 'guard' | 'document' | 'devtools' | 'background'; name: string };

/** Where focus is relative to the topmost open dialog. */
function focusInfo(page: Page): Promise<FocusInfo> {
    return page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        const top = dialogs[dialogs.length - 1];
        const name = (active?.getAttribute('aria-label') || active?.textContent || active?.tagName || '').trim().slice(0, 40);
        if (!active || active === document.body || active === document.documentElement) return { zone: 'document', name };
        if (active.hasAttribute('data-base-ui-focus-guard')) return { zone: 'guard', name };
        // `next dev` mounts its dev-tools overlay inside a <script> element,
        // which Base UI never hides. It does not exist in production builds.
        if (active.tagName === 'NEXTJS-PORTAL') return { zone: 'devtools', name };
        // Menus opened from inside the dialog portal separately but belong to it.
        if (top?.contains(active) || active.closest('[role="menu"]')) return { zone: 'dialog', name };
        return { zone: 'background', name };
    });
}

/** Press a key the way a person does: wait for focus to settle before continuing. */
async function pressSettled(page: Page, key: string): Promise<FocusInfo> {
    await page.keyboard.press(key);
    let info = await focusInfo(page);
    for (let i = 0; i < 20 && (info.zone === 'guard' || info.zone === 'document' || info.zone === 'devtools'); i++) {
        await page.waitForTimeout(25);
        info = await focusInfo(page);
    }
    return info;
}

/** Tabbable controls of the top dialog, in DOM order. */
function dialogControls(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        const top = dialogs[dialogs.length - 1];
        return Array.from(top.querySelectorAll<HTMLElement>('button, textarea, input, select, a[href], [tabindex]'))
            .filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0)
            .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
    });
}

async function expectCycle(page: Page, key: 'Tab' | 'Shift+Tab') {
    const controls = await dialogControls(page);
    expect(controls.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    // Two full laps prove wrapping in this direction.
    for (let i = 0; i < controls.length * 2 + 1; i++) {
        const info = await pressSettled(page, key);
        expect(info.zone, `${key} #${i + 1} landed on ${info.name}`).toBe('dialog');
        seen.add(info.name);
    }
    for (const control of controls) {
        expect(seen, `${key} never reached "${control}"`).toContain(control);
    }
}

/** Rapid key presses (faster than a frame) must never reach background controls. */
async function expectNoEscapeUnderRapidKeys(page: Page) {
    const escapes: string[] = [];
    for (const key of ['Tab', 'Shift+Tab']) {
        for (let i = 0; i < 25; i++) {
            await page.keyboard.press(key);
            const info = await focusInfo(page);
            if (info.zone === 'background') escapes.push(`${key}#${i + 1}: ${info.name}`);
        }
    }
    expect(escapes).toEqual([]);
    const settled = await pressSettled(page, 'Tab');
    expect(settled.zone).toBe('dialog');
}

async function gotoFixtures(page: Page) {
    await page.goto('/test-fixtures/dialogs');
    await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
}

async function openWithKeyboard(page: Page, opener: Locator) {
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await focusInfo(page)).zone).toBe('dialog');
    return dialog;
}

async function closeWithEscape(page: Page, opener: Locator) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(opener).toBeFocused();
}

async function exerciseDialog(page: Page, opener: Locator, checkInitial: (dialog: Locator) => Promise<void>) {
    for (let round = 0; round < 2; round++) {
        const dialog = await openWithKeyboard(page, opener);
        await checkInitial(dialog);
        await expectCycle(page, 'Tab');
        await expectCycle(page, 'Shift+Tab');
        await expectNoEscapeUnderRapidKeys(page);
        await closeWithEscape(page, opener);
    }
}

test.describe('shared dialog keyboard focus', () => {
    test('sample sheet dialog keeps focus inside and returns it to the opener', async ({ page }) => {
        await mockApis(page);
        await page.goto('/onboarding');
        const opener = page.getByRole('button', { name: 'View sample sheet' });
        await expect(opener).toBeVisible();

        await exerciseDialog(page, opener, async (dialog) => {
            await expect(dialog.getByText(/placeholder branding/)).toBeVisible();
            await expect.poll(async () => (await focusInfo(page)).zone).toBe('dialog');
        });
    });

    test('feedback dialog: initial textarea focus, cycling, typing, no submission', async ({ page }) => {
        const writes = await mockApis(page);
        await gotoFixtures(page);
        const opener = page.getByRole('button', { name: 'Send feedback' });

        await exerciseDialog(page, opener, async (dialog) => {
            const textarea = dialog.getByPlaceholder('Type your message here...');
            await expect(textarea).toBeFocused();
            // Typing (including a multi-line entry) works inside the trap. The
            // dialog keeps its draft between openings, so start clean.
            await page.keyboard.press('ControlOrMeta+A');
            await page.keyboard.press('Delete');
            await page.keyboard.type('Synthetic feedback');
            await page.keyboard.press('Enter');
            await page.keyboard.type('line two');
            await expect(textarea).toHaveValue('Synthetic feedback\nline two');
            await expect(dialog.getByRole('button', { name: 'Send Feedback' })).toBeEnabled();
        });
        expect(writes.feedback).toBe(0);
    });

    test('delete confirmation dialog: cycling, Escape, and focus return without deleting', async ({ page }) => {
        const writes = await mockApis(page);
        await gotoFixtures(page);
        const opener = page.getByRole('button', { name: 'Delete fixture request' });

        await exerciseDialog(page, opener, async (dialog) => {
            await expect(dialog.getByRole('heading', { name: 'Delete this request?' })).toBeVisible();
            await expect(dialog.getByRole('button', { name: 'Delete request' })).toBeVisible();
        });
        expect(writes.deletes).toBe(0);
    });

    test('nested menu inside a dialog stays keyboard operable and returns focus to the dialog', async ({ page }) => {
        await mockApis(page);
        await gotoFixtures(page);
        const opener = page.getByRole('button', { name: 'Open menu dialog' });

        for (let round = 0; round < 2; round++) {
            const dialog = await openWithKeyboard(page, opener);
            const menuTrigger = dialog.getByRole('button', { name: 'Pick utility' });
            await menuTrigger.focus();
            await page.keyboard.press('Enter');
            const menu = page.getByRole('menu');
            await expect(menu).toBeVisible();
            await expect.poll(async () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="menu"]')))).toBe(true);

            // Escape closes only the menu; focus goes back to its trigger in the dialog.
            await page.keyboard.press('Escape');
            await expect(menu).toBeHidden();
            await expect(dialog).toBeVisible();
            await expect(menuTrigger).toBeFocused();

            // Choose an item with the keyboard.
            await page.keyboard.press('Enter');
            await expect(menu).toBeVisible();
            await page.getByRole('menuitem', { name: 'Water' }).focus();
            await page.keyboard.press('Enter');
            await expect(menu).toBeHidden();
            await expect(dialog.getByText('Selected: Water')).toBeVisible();
            await expect.poll(async () => (await focusInfo(page)).zone).toBe('dialog');

            await expectCycle(page, 'Tab');
            await expectNoEscapeUnderRapidKeys(page);
            await closeWithEscape(page, opener);
        }
    });

    test('outside click still closes a dialog and the page is interactive afterwards', async ({ page }) => {
        await mockApis(page);
        await gotoFixtures(page);
        const opener = page.getByRole('button', { name: 'Open menu dialog' });
        await opener.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect.poll(() => page.locator('[inert]').count()).toBeGreaterThan(0);

        await page.mouse.click(5, 5);
        await expect(page.getByRole('dialog')).toBeHidden();
        // Background inert state is fully released.
        await expect.poll(() => page.locator('[inert]').count()).toBe(0);
        const input = page.getByRole('textbox', { name: 'Background input' });
        await input.click();
        await page.keyboard.type('ok');
        await expect(input).toHaveValue('ok');
    });
});
