import { describe, expect, it } from 'vitest';
import { slugifyIntakeSlug, validateIntakeSlug } from '@/lib/neon/queries/intake-links';

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
