import { describe, expect, it } from 'vitest';
import { FEATURED_PRODUCT_UPDATES, mergeFeaturedProductUpdate } from '@/lib/product-updates';

describe('reopen product update', () => {
    it('is the newest featured update and states what reopening does and does not do', () => {
        const update = FEATURED_PRODUCT_UPDATES[0];

        expect(update).toMatchObject({
            id: 'reopen-submitted-request-for-seller',
            category: 'feature',
            is_published: true,
        });
        expect(update.body).toContain('Reopen for Seller');
        expect(update.body).toContain('every plan');
        expect(update.body).toContain('does not count as another submitted sheet');
        expect(update.body).toContain('unavailable while the request is reopened');
        expect(update.body).toContain('Close Without Changes');
    });

    it('sorts ahead of the earlier featured updates', () => {
        expect(mergeFeaturedProductUpdate([])[0].id).toBe('reopen-submitted-request-for-seller');
    });
});
