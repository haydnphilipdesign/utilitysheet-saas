import { describe, expect, it } from 'vitest';
import {
    QUESTION_REQUEST_CONTEXT_LABELS,
    QUESTION_REQUEST_PACKET_MODE_LABELS,
    labelForQuestionRequestKey,
    toQuestionRequestBreakdown,
    toQuestionRequestSummary,
    type QuestionRequestRow,
} from '@/lib/admin/question-requests';

const row: QuestionRequestRow = {
    id: 'qr_1',
    requested_text: 'Ask whether the home is in an HOA',
    context: 'settings',
    packet_mode: 'simple',
    status: 'new',
    created_at: '2026-09-18T12:00:00.000Z',
    account_id: 'acct_1',
    user_name: 'Sample User',
    user_email: 'sample@example.com',
    is_paid: false,
};

describe('question request admin summary', () => {
    it('coerces Postgres count strings into numbers', () => {
        const summary = toQuestionRequestSummary(
            { total: '12', accounts: '5', last_30d: '4', paid_accounts: '2' },
            [{ key: 'settings', count: '9' }],
            [{ key: 'simple', count: '12' }],
            [row]
        );

        expect(summary.total).toBe(12);
        expect(summary.accounts).toBe(5);
        expect(summary.last30d).toBe(4);
        expect(summary.paidAccounts).toBe(2);
        expect(summary.byContext).toEqual([{ key: 'settings', count: 9 }]);
    });

    it('derives free accounts as the remainder of distinct accounts', () => {
        const summary = toQuestionRequestSummary(
            { total: 10, accounts: 7, last_30d: 3, paid_accounts: 2 },
            [],
            [],
            []
        );

        expect(summary.freeAccounts).toBe(5);
    });

    it('never reports a negative free-account count', () => {
        // The two counts come from separate aggregates, so a paid count larger
        // than the distinct-account count must not render as a negative figure.
        const summary = toQuestionRequestSummary(
            { total: 4, accounts: 1, last_30d: 1, paid_accounts: 3 },
            [],
            [],
            []
        );

        expect(summary.freeAccounts).toBe(0);
    });

    it('defaults missing or malformed aggregate values to zero', () => {
        const summary = toQuestionRequestSummary({}, [], [], []);

        expect(summary).toMatchObject({
            total: 0,
            accounts: 0,
            last30d: 0,
            paidAccounts: 0,
            freeAccounts: 0,
        });
    });

    it('labels an unrecorded packet mode rather than showing a null', () => {
        expect(toQuestionRequestBreakdown([{ key: 'unrecorded', count: 2 }])).toEqual([
            { key: 'unrecorded', count: 2 },
        ]);
        expect(labelForQuestionRequestKey(QUESTION_REQUEST_PACKET_MODE_LABELS, 'unrecorded'))
            .toBe('Not recorded');
    });

    it('humanizes a key with no declared label', () => {
        expect(labelForQuestionRequestKey(QUESTION_REQUEST_CONTEXT_LABELS, 'request_creation'))
            .toBe('Request creation');
        expect(labelForQuestionRequestKey(QUESTION_REQUEST_CONTEXT_LABELS, 'some_future_surface'))
            .toBe('some future surface');
    });

    it('passes submission rows through unchanged', () => {
        const summary = toQuestionRequestSummary({ total: 1, accounts: 1 }, [], [], [row]);
        expect(summary.rows).toEqual([row]);
    });
});
