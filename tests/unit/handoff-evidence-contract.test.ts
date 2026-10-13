// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    buildNotificationEvidence,
    classifySend,
    pdfFailureReasonCode,
    pdfObservationFromEvidence,
    type PdfRenderEvidence,
    type SettledSend,
} from '@/lib/telemetry/handoff-evidence';

const OPERATION = '00000000-0000-4000-8000-0000000000e1';
const REQUEST = '00000000-0000-4000-8000-0000000000d1';

const rendered: PdfRenderEvidence = {
    requestId: REQUEST, isDemo: false, packetMode: 'simple', renderStrategy: 'print_pdf', launchStrategy: 'default',
    outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
    totalMs: 4100.4, dataMs: 60, launchMs: 800, renderMs: 3200, bytes: 48000,
};
const ok = (value: Record<string, unknown>): SettledSend => ({ status: 'fulfilled', value: { success: true, ...value } });
const refused = (value: Record<string, unknown>): SettledSend => ({ status: 'fulfilled', value: { success: false, ...value } });

describe('classifySend', () => {
    it('treats provider acceptance as accepted and keeps only a bounded message id', () => {
        expect(classifySend(ok({ messageId: 'msg_1' }))).toEqual({ sendOutcome: 'accepted', providerMessageId: 'msg_1', failureCode: null });
        expect(classifySend(ok({}))).toEqual({ sendOutcome: 'accepted', providerMessageId: null, failureCode: null });
        expect(classifySend(ok({ messageId: 'x'.repeat(201) })).providerMessageId).toBeNull();
    });

    it('reads a returned refusal as failed and never stores its message text', () => {
        expect(classifySend(refused({ error: 'Invalid `to` field: sam@example.com', errorCode: 'validation_error' })))
            .toEqual({ sendOutcome: 'failed', providerMessageId: null, failureCode: 'validation_error' });
        // A code that is not identifier-like is replaced, not stored.
        expect(classifySend(refused({ error: 'x', errorCode: 'bad address: sam@example.com' })).failureCode).toBe('provider_rejected');
        expect(classifySend(refused({ error: 'x' })).failureCode).toBe('provider_rejected');
    });

    it('keeps "no provider response" apart from a confirmed failure', () => {
        expect(classifySend(refused({ threw: true, error: 'fetch failed' })))
            .toEqual({ sendOutcome: 'unknown', providerMessageId: null, failureCode: 'threw' });
        expect(classifySend({ status: 'rejected', reason: new Error('socket hang up') }))
            .toEqual({ sendOutcome: 'unknown', providerMessageId: null, failureCode: 'threw' });
        // A missing provider key cannot have sent anything.
        expect(classifySend(refused({ threw: true, error: 'RESEND_API_KEY environment variable is not set' })))
            .toEqual({ sendOutcome: 'failed', providerMessageId: null, failureCode: 'not_configured' });
    });
});

describe('buildNotificationEvidence', () => {
    const build = (sends: SettledSend[], overrides: Record<string, unknown> = {}) => buildNotificationEvidence({
        operationId: OPERATION, requestId: REQUEST, purpose: 'completion_notification', mode: 'live', sends, ...overrides,
    });

    it('records one slot per recipient in order, including a partial send', () => {
        const evidence = build([
            ok({ messageId: 'msg_a', attachmentStatus: 'attached', pdfEvidence: rendered }),
            refused({ error: 'rejected', errorCode: 'rate_limit_exceeded', attachmentStatus: 'disabled' }),
            { status: 'rejected', reason: new Error('boom') },
        ]);
        expect(evidence.notifications).toEqual([
            expect.objectContaining({ recipientSlot: 0, intendedRecipients: 3, sendOutcome: 'accepted', providerMessageId: 'msg_a', attachmentStatus: 'attached' }),
            expect.objectContaining({ recipientSlot: 1, intendedRecipients: 3, sendOutcome: 'failed', failureCode: 'rate_limit_exceeded', attachmentStatus: 'disabled' }),
            expect.objectContaining({ recipientSlot: 2, intendedRecipients: 3, sendOutcome: 'unknown', failureCode: 'threw', attachmentStatus: 'not_applicable' }),
        ]);
        expect(evidence.notifications.every((row) => row.operationId === OPERATION && row.requestId === REQUEST && row.mode === 'live')).toBe(true);
        expect(evidence.pdfRenders).toEqual([
            expect.objectContaining({ surface: 'completion_attachment', operationId: OPERATION, recipientSlot: 0, outcome: 'rendered', totalMs: 4100, bytes: 48000, httpStatus: null }),
        ]);
    });

    it('keeps an attachment failure with an accepted email as two separate facts', () => {
        const failedPdf: PdfRenderEvidence = { ...rendered, outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', bytes: null, renderMs: null };
        const evidence = build([ok({ messageId: 'msg_a', attachmentStatus: 'failed', pdfEvidence: failedPdf })]);
        expect(evidence.notifications[0]).toMatchObject({ sendOutcome: 'accepted', attachmentStatus: 'failed' });
        expect(evidence.pdfRenders[0]).toMatchObject({ outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error' });
    });

    it('makes an attempt with nobody eligible visible as one row', () => {
        expect(build([])).toEqual({
            notifications: [expect.objectContaining({ recipientSlot: 0, intendedRecipients: 0, sendOutcome: 'no_recipients', attachmentStatus: 'not_applicable' })],
            pdfRenders: [],
        });
    });

    it('carries no address, name, link or message text', () => {
        const evidence = build([
            ok({ messageId: 'msg_a', attachmentStatus: 'attached', pdfEvidence: rendered, to: 'owner@example.com', subject: 'Utility Info Submitted for 12 Private Rd' }),
            refused({ error: 'Invalid recipient owner2@example.com at https://app.example/s/secret-token' }),
        ]);
        expect(JSON.stringify(evidence)).not.toMatch(/example\.com|Private Rd|secret-token|Invalid recipient/);
    });

    it('stores nothing for an identifier that is not an internal request id', () => {
        expect(build([ok({ messageId: 'msg_a' })], { requestId: 'secret-seller-token' })).toEqual({ notifications: [], pdfRenders: [] });
        expect(build([ok({ messageId: 'msg_a' })], { operationId: 'not-a-uuid' })).toEqual({ notifications: [], pdfRenders: [] });
    });

    it('bounds the number of recipient slots', () => {
        const evidence = build(Array.from({ length: 130 }, () => ok({ messageId: 'm' })));
        expect(evidence.notifications).toHaveLength(100);
        expect(evidence.notifications[99]).toMatchObject({ recipientSlot: 99, intendedRecipients: 100 });
    });
});

describe('pdfObservationFromEvidence', () => {
    it('derives live or test from the resolved request and keeps expected skips', () => {
        expect(pdfObservationFromEvidence({ ...rendered, isDemo: true }, { surface: 'download', httpStatus: 200 })).toMatchObject({ mode: 'test', httpStatus: 200 });
        expect(pdfObservationFromEvidence({ ...rendered, outcome: 'skipped', skipReason: 'locked' }, { surface: 'download', httpStatus: 402 }))
            .toMatchObject({ outcome: 'skipped', skipReason: 'locked', mode: 'live' });
    });

    it('returns nothing when no request was resolved', () => {
        expect(pdfObservationFromEvidence(undefined, { surface: 'download' })).toBeNull();
        expect(pdfObservationFromEvidence({ ...rendered, requestId: null, isDemo: null, outcome: 'skipped', skipReason: 'not_found' }, { surface: 'download' })).toBeNull();
        expect(pdfObservationFromEvidence({ ...rendered, requestId: null, isDemo: null, outcome: 'failed', failureStage: 'data' }, { surface: 'download' })).toBeNull();
    });

    it('drops an error label that is not identifier-like and clamps numbers', () => {
        const row = pdfObservationFromEvidence({ ...rendered, errorName: 'Error: /tmp/secret path', totalMs: -5, bytes: Number.NaN }, { surface: 'download' });
        expect(row).toMatchObject({ errorName: null, totalMs: null, bytes: null });
    });

    it('names the incident reason by failed stage', () => {
        expect(pdfFailureReasonCode({ ...rendered, failureStage: 'page_load' })).toBe('page_load_failed');
        expect(pdfFailureReasonCode(undefined)).toBe('renderer_failed');
    });
});
