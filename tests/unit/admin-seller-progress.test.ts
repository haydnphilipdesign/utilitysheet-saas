import { describe, expect, it } from 'vitest';
import { describeSellerProgressEvent, requestTimelineEventLabel } from '@/lib/admin/seller-progress';

describe('seller progress event descriptions', () => {
    it('translates internal event identifiers into factual seller stages', () => {
        expect(describeSellerProgressEvent('seller_opened', null)).toEqual({
            label: 'Opened seller form',
            description: 'The seller loaded the form; no later tracked step is available.',
        });

        expect(describeSellerProgressEvent('suggestions_fetched', { categories: ['electric', 'natural_gas'] }).label)
            .toBe('Reached Electric, Natural Gas');
    });

    it('names a coordinator reopen and a reopen closed without changes', () => {
        const reopened = describeSellerProgressEvent('request_reopened', { actor: 'agent', edit_version: 1 });
        expect(reopened.label).toBe('Reopened for seller');
        expect(reopened.description).toContain('coordinator reopened');

        const closed = describeSellerProgressEvent('request_reopen_cancelled', null);
        expect(closed.label).toBe('Reopen closed without changes');
        expect(closed.description).toContain('restoring the submitted sheet');

        expect(requestTimelineEventLabel('request_reopened')).toBe(reopened.label);
        expect(requestTimelineEventLabel('request_reopen_cancelled')).toBe(closed.label);
    });

    it('has no timeline label for events that are shown by their raw type', () => {
        expect(requestTimelineEventLabel('seller_opened')).toBeNull();
        expect(requestTimelineEventLabel('toString')).toBeNull();
    });

    it('keeps unknown technical events out of the primary label', () => {
        const result = describeSellerProgressEvent('internal_event_name', null);
        expect(result.label).toBe('Other tracked activity');
        expect(result.label).not.toContain('internal_event_name');
    });
});
