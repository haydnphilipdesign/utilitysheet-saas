import { describe, expect, it } from 'vitest';
import {
    normalizeIntakeUtilityCategories,
    slugifyIntakeSlug,
    validateIntakeSlug,
} from '@/lib/neon/queries/intake-links';

describe('intake link slug helpers', () => {
    it('slugifyIntakeSlug lowercases and dashes', () => {
        expect(slugifyIntakeSlug('John Q. Public')).toBe('john-q-public');
        expect(slugifyIntakeSlug('  123 Main St  ')).toBe('123-main-st');
        expect(slugifyIntakeSlug('A__B')).toBe('a-b');
    });

    it('validateIntakeSlug rejects non-normalized', () => {
        expect(() => validateIntakeSlug('John-Doe')).toThrow(/lowercase/i);
        expect(() => validateIntakeSlug('john_doe')).toThrow(/lowercase/i);
    });

    it('validateIntakeSlug enforces length', () => {
        expect(() => validateIntakeSlug('ab')).toThrow(/between 3 and 60/i);
    });

    it('validateIntakeSlug rejects reserved slugs', () => {
        expect(() => validateIntakeSlug('api')).toThrow(/reserved/i);
        expect(() => validateIntakeSlug('dashboard')).toThrow(/reserved/i);
        expect(() => validateIntakeSlug('login')).toThrow(/reserved/i);
    });
});

describe('intake link utility defaults', () => {
    it('falls back to all canonical categories for missing or unusable legacy data', () => {
        const expected = ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable'];

        expect(normalizeIntakeUtilityCategories(undefined)).toEqual(expected);
        expect(normalizeIntakeUtilityCategories([])).toEqual(expected);
        expect(normalizeIntakeUtilityCategories(['unknown'])).toEqual(expected);
    });

    it('filters unknown values, removes duplicates, and restores canonical order', () => {
        expect(normalizeIntakeUtilityCategories(['water', 'electric', 'water', 'unknown'])).toEqual([
            'electric',
            'water',
        ]);
    });
});
