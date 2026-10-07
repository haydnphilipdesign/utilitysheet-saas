import { describe, expect, it } from 'vitest';
import {
    customSellerText,
    defaultSellerHeading,
    defaultSellerIntro,
} from '@/lib/seller-forms/intro-copy';

describe('seller link first-screen wording', () => {
    it('names the Branding Profile when there is one', () => {
        expect(defaultSellerHeading('Agent Brand')).toBe('Agent Brand needs a few utility details');
        expect(defaultSellerIntro('Agent Brand')).toBe('Agent Brand is helping with the sale of your home and sent you this link to collect utility information for the buyer.');
        expect(defaultSellerHeading(null)).toBe('Share your home’s utility details');
        expect(defaultSellerIntro(undefined)).toBe('The team helping with the sale of your home sent you this link to collect utility information for the buyer.');
    });
    it('stores nothing for empty or unchanged text so the default keeps following the profile name', () => {
        const fallback = defaultSellerHeading('Agent Brand');
        expect(customSellerText(null, fallback)).toBeNull();
        expect(customSellerText('   ', fallback)).toBeNull();
        expect(customSellerText(` ${fallback} `, fallback)).toBeNull();
        expect(customSellerText(' Welcome ', fallback)).toBe('Welcome');
    });
});
