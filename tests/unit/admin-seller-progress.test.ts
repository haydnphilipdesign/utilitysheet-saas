import { describe, expect, it } from 'vitest';
import { describeSellerFailure, describeSellerProgressEvent, describeSellerStep, requestTimelineEventLabel } from '@/lib/admin/seller-progress';

describe('seller progress event descriptions', () => {
    it('translates internal event identifiers into factual seller stages', () => {
        expect(describeSellerProgressEvent('seller_opened', null)).toEqual({
            label: 'Seller form requested',
            description: 'The seller endpoint was requested; no browser view or later step is confirmed.',
        });

        expect(describeSellerProgressEvent('suggestions_fetched', { categories: ['electric', 'natural_gas'] }).label)
            .toBe('Suggestions served for Electric, Natural Gas');
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

    it('describes browser-reported observations as advisory and ignores values outside the contract', () => {
        expect(describeSellerProgressEvent('seller_step_viewed', { step: 'utility', category: 'electric' }).label).toBe('Viewed Electric provider');
        expect(describeSellerProgressEvent('seller_step_viewed', { step: 'review' })).toMatchObject({
            label: 'Viewed Review', description: expect.stringContaining('Advisory'),
        });
        expect(describeSellerProgressEvent('seller_step_completed', { step: 'home_basics' }).label).toBe('Continued past Home Basics');
        expect(describeSellerProgressEvent('seller_submission_failed', { error_code: 'rate_limited' }).label).toBe('Submission failed: too many attempts');
        expect(describeSellerProgressEvent('seller_submission_attempted', null).description).toContain('recorded separately by the server');
        expect(describeSellerProgressEvent('seller_suggestions_rendered', null).label).toBe('Provider list shown');
        expect(describeSellerProgressEvent('seller_suggestions_failed', null).label).toBe('Provider list failed to load');

        expect(describeSellerProgressEvent('seller_step_viewed', { step: '12 Sentinel Street' }).label).toBe('Viewed a form step');
        expect(describeSellerProgressEvent('seller_submission_failed', { error_code: 'sentinel raw error' }).label).toBe('Submission failed');
        expect(describeSellerStep('toString', null)).toBeNull();
        expect(describeSellerStep('utility', null)).toBe('a provider step');
        expect(describeSellerFailure('constructor')).toBeNull();
    });
});
