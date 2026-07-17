import { describe, expect, it } from 'vitest';
import { describeSellerProgressEvent } from '@/lib/admin/seller-progress';

describe('seller progress event descriptions', () => {
    it('translates internal event identifiers into factual seller stages', () => {
        expect(describeSellerProgressEvent('seller_opened', null)).toEqual({
            label: 'Opened seller form',
            description: 'The seller loaded the form; no later tracked step is available.',
        });

        expect(describeSellerProgressEvent('suggestions_fetched', { categories: ['electric', 'natural_gas'] }).label)
            .toBe('Reached Electric, Natural Gas');
    });

    it('keeps unknown technical events out of the primary label', () => {
        const result = describeSellerProgressEvent('internal_event_name', null);
        expect(result.label).toBe('Other tracked activity');
        expect(result.label).not.toContain('internal_event_name');
    });
});
