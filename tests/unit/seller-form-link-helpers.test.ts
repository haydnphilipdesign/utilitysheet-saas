import { describe, expect, it } from 'vitest';
import { isValidLinkSuffix, sellerFormLinkPath, suggestLinkSuffix, type SellerFormLinkScope } from '@/lib/seller-forms/links';

const scope: SellerFormLinkScope = {
    rootFormId: 'base', baseSlug: 'jane', baseRevision: 1,
    baseFormName: 'Original', baseIsActive: true,
    suffixes: { other: 'closing' }, reserved: [],
};
describe('seller form public link helpers', () => {
    it('keeps the base bare and uses the namespace ending for another form', () => {
        expect(sellerFormLinkPath({ id: 'base', slug: 'jane' }, scope)).toBe('/i/jane');
        expect(sellerFormLinkPath({ id: 'other', slug: 'old-flat' }, scope)).toBe('/i/jane/closing');
        expect(sellerFormLinkPath({ id: 'other', slug: 'old-flat' }, null)).toBe('/i/old-flat');
    });
    it.each(['Closing Info', 'a', '协会', '---', 'x'.repeat(80)])('suggests a valid reviewable ending for %s', name => {
        const first = suggestLinkSuffix(name, []);
        const second = suggestLinkSuffix(name, [first]);
        expect(isValidLinkSuffix(first)).toBe(true);
        expect(isValidLinkSuffix(second)).toBe(true);
        expect(first).not.toBe(second);
    });
    it('keeps suggestions valid after many historical aliases', () => {
        const stem = 'x'.repeat(56);
        const taken = [stem, ...Array.from({ length: 1100 }, (_, i) => `${stem}-${i + 2}`)];
        const suggested = suggestLinkSuffix('x'.repeat(80), taken);
        expect(isValidLinkSuffix(suggested)).toBe(true);
        expect(taken).not.toContain(suggested);
    });
});
