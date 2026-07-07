import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlTagMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/neon/db', () => ({
    sql: Object.assign(sqlTagMock, {
        transaction: vi.fn(),
    }),
    generateToken: () => 'test-token',
    isDbConfigured: () => true,
}));

import { updateBrandProfile } from '@/lib/neon/queries/brand-profiles';

function lastCall(): { text: string; values: unknown[] } {
    const call = sqlTagMock.mock.calls.at(-1) as [TemplateStringsArray, ...unknown[]];
    const [strings, ...values] = call;
    // Reconstruct the query with $n placeholders so field assertions are
    // position-independent.
    let text = '';
    strings.forEach((part, index) => {
        text += part;
        if (index < values.length) text += `$${index + 1}`;
    });
    return { text, values };
}

/** Find the (provided flag, value) parameter pair for one SET clause. */
function fieldParams(text: string, values: unknown[], column: string, cast = '::text') {
    const clause = new RegExp(`${column} = CASE WHEN \\$(\\d+) THEN \\$(\\d+)${cast.replaceAll(':', '\\:')} ELSE ${column} END`);
    const match = clause.exec(text);
    expect(match, `SET clause for ${column} not found`).toBeTruthy();
    const [, flagIndex, valueIndex] = match as RegExpExecArray;
    return {
        provided: values[Number(flagIndex) - 1],
        value: values[Number(valueIndex) - 1],
    };
}

describe('updateBrandProfile explicit update semantics', () => {
    beforeEach(() => {
        sqlTagMock.mockReset();
        sqlTagMock.mockResolvedValue([{ id: 'profile_1' }]);
    });

    it('no longer uses COALESCE, which could not distinguish "unchanged" from "clear"', async () => {
        await updateBrandProfile('profile_1', { name: 'Acme' });

        const { text } = lastCall();
        expect(text).not.toContain('COALESCE');
        expect(text).toContain('CASE WHEN');
    });

    it('leaves omitted fields unchanged', async () => {
        await updateBrandProfile('profile_1', { name: 'Acme' });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'name')).toEqual({ provided: true, value: 'Acme' });
        expect(fieldParams(text, values, 'logo_url').provided).toBe(false);
        expect(fieldParams(text, values, 'buyer_next_steps', '::jsonb').provided).toBe(false);
        expect(fieldParams(text, values, 'welcome_message').provided).toBe(false);
        expect(fieldParams(text, values, 'show_powered_by', '::boolean').provided).toBe(false);
    });

    it('clears the stored logo when logo_url is explicitly null (remove logo)', async () => {
        await updateBrandProfile('profile_1', { logo_url: null });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'logo_url')).toEqual({ provided: true, value: null });
        expect(fieldParams(text, values, 'name').provided).toBe(false);
    });

    it('clears custom buyer steps when buyer_next_steps is explicitly null (reset to defaults)', async () => {
        await updateBrandProfile('profile_1', { buyer_next_steps: null });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'buyer_next_steps', '::jsonb')).toEqual({ provided: true, value: null });
    });

    it('stores a provided custom buyer steps list as JSON', async () => {
        await updateBrandProfile('profile_1', { buyer_next_steps: ['Step A', 'Step B'] });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'buyer_next_steps', '::jsonb')).toEqual({
            provided: true,
            value: JSON.stringify(['Step A', 'Step B']),
        });
    });

    it('clears optional text fields when explicitly null', async () => {
        await updateBrandProfile('profile_1', {
            contact_website: null,
            disclaimer_text: null,
            next_steps_title: null,
            welcome_message: null,
        });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'contact_website')).toEqual({ provided: true, value: null });
        expect(fieldParams(text, values, 'disclaimer_text')).toEqual({ provided: true, value: null });
        expect(fieldParams(text, values, 'next_steps_title')).toEqual({ provided: true, value: null });
        expect(fieldParams(text, values, 'welcome_message')).toEqual({ provided: true, value: null });
    });

    it('resets message templates to defaults by storing an empty object', async () => {
        await updateBrandProfile('profile_1', { message_templates: {} });

        const { text, values } = lastCall();
        expect(fieldParams(text, values, 'message_templates', '::jsonb')).toEqual({
            provided: true,
            value: '{}',
        });
    });

    it('unsets other defaults in the same scope before marking this profile default', async () => {
        await updateBrandProfile('profile_1', { is_default: true, accountId: 'acct_1' });

        expect(sqlTagMock).toHaveBeenCalledTimes(2);
        const firstCall = sqlTagMock.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
        const firstText = Array.from(firstCall[0]).join(' ');
        expect(firstText).toContain('SET is_default = FALSE');
    });
});
