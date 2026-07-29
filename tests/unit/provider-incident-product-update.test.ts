import { describe, expect, it } from 'vitest';
import { FEATURED_PRODUCT_UPDATES } from '@/lib/product-updates';

describe('provider incident product update', () => {
    it('publishes a factual resolved update without provider or impact overclaims', () => {
        const update = FEATURED_PRODUCT_UPDATES[0];

        expect(update).toMatchObject({
            id: 'provider-resolution-incident-resolved',
            category: 'bugfix',
            is_published: true,
        });
        expect(update.body).toContain('July 24');
        expect(update.body).toContain('July 29');
        expect(update.body).not.toMatch(/Gemini|all affected|no customers/i);
    });
});
