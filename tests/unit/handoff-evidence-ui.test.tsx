import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HandoffEvidenceCard, RequestHandoffEvidence } from '@/components/admin/HandoffEvidence';
import type { HandoffEvidenceSummary, RequestNotificationEvidence, RequestPdfEvidence } from '@/lib/neon/queries/handoff-evidence';

const purpose = {
    operations: 0, noRecipients: 0, partialOperations: 0, attempted: 0, accepted: 0, failed: 0, unknown: 0, delivered: 0, delayed: 0,
    bounced: 0, complained: 0, deliveryFailed: 0, deliveryUnknown: 0, attachmentAttached: 0, attachmentFailed: 0, attachmentSkipped: 0,
};
const surface = { rendered: 0, failed: 0, skipped: 0, failedByStage: { data: 0, build_html: 0, browser_launch: 0, page_load: 0, render: 0 }, medianMs: null, p95Ms: null, medianBytes: null };
const summary = (overrides: Partial<HandoffEvidenceSummary> = {}): HandoffEvidenceSummary => ({
    windowDays: 30, testOperations: 0, firstObservationAt: null, lastObservationAt: null,
    notifications: { completion_notification: { ...purpose }, request_invitation: { ...purpose } },
    pdf: { completion_attachment: { ...surface }, download: { ...surface } },
    ...overrides,
});
const at = '2026-10-13T15:00:00.000Z';
const notification = (overrides: Partial<RequestNotificationEvidence>): RequestNotificationEvidence => ({
    operationId: '00000000-0000-4000-8000-0000000000e1', purpose: 'completion_notification', mode: 'live', recipientSlot: 0,
    intendedRecipients: 1, sendOutcome: 'accepted', failureCode: null, attachmentStatus: 'attached', deliveryStatus: null,
    deliveryUpdatedAt: null, createdAt: at, ...overrides,
});
const pdf = (overrides: Partial<RequestPdfEvidence>): RequestPdfEvidence => ({
    surface: 'download', outcome: 'rendered', skipReason: null, failureStage: null, packetMode: 'simple', totalMs: 4200, bytes: 51200, createdAt: at, ...overrides,
});

describe('HandoffEvidenceCard', () => {
    it('never shows a failed read or a pending migration as zeros', () => {
        const { rerender } = render(<HandoffEvidenceCard state={{ status: 'error' }} webhookConfigured />);
        expect(screen.getByRole('status')).toHaveTextContent(/could not be loaded just now/i);
        expect(screen.queryByText(/sends attempted/i)).not.toBeInTheDocument();
        rerender(<HandoffEvidenceCard state={{ status: 'not_installed' }} webhookConfigured />);
        expect(screen.getByRole('status')).toHaveTextContent(/database migration has not been applied/i);
    });

    it('says an empty store is not yet evidence that everything worked', () => {
        render(<HandoffEvidenceCard state={{ status: 'ok', data: summary() }} webhookConfigured={false} />);
        expect(screen.getByRole('status')).toHaveTextContent(/nothing has been recorded yet/i);
        expect(screen.getByText(/it is not configured in this environment/i)).toBeInTheDocument();
        expect(screen.getByText(/accepted means the provider took the message, not that it arrived/i)).toBeInTheDocument();
    });

    it('keeps accepted, delivered, unknown and attachment facts apart', () => {
        render(<HandoffEvidenceCard webhookConfigured state={{ status: 'ok', data: summary({
            firstObservationAt: at, lastObservationAt: at,
            notifications: {
                completion_notification: { ...purpose, operations: 6, noRecipients: 1, partialOperations: 2, attempted: 9, accepted: 7, failed: 1, unknown: 1, delivered: 5, deliveryUnknown: 2, attachmentAttached: 4, attachmentFailed: 1 },
                request_invitation: { ...purpose, operations: 3, attempted: 3, accepted: 3, deliveryUnknown: 3 },
            },
        }) }} />);
        const completion = within(screen.getByRole('region', { name: /completion email to the customer/i }));
        expect(completion.getByText('7 of 9')).toBeInTheDocument();
        expect(completion.getByText(/nobody eligible, nothing sent/i)).toBeInTheDocument();
        expect(completion.getByText(/pdf failed, email sent without it/i)).toBeInTheDocument();
        const invitation = within(screen.getByRole('region', { name: /invitation email to the seller/i }));
        expect(invitation.getByText('3 of 3')).toBeInTheDocument();
        // Invitations carry no attachment, so no attachment rows are shown for them.
        expect(invitation.queryByText(/pdf attached/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/not configured in this environment/i)).not.toBeInTheDocument();
    });
});

describe('RequestHandoffEvidence', () => {
    it('lists recipients by number with send, delivery and attachment facts, and PDFs by outcome', () => {
        render(<RequestHandoffEvidence state={{ status: 'ok', data: {
            notifications: [
                notification({ recipientSlot: 0, intendedRecipients: 2, deliveryStatus: 'bounced', deliveryUpdatedAt: at }),
                notification({ recipientSlot: 1, intendedRecipients: 2, sendOutcome: 'failed', failureCode: 'validation_error', attachmentStatus: 'disabled' }),
                notification({ operationId: '00000000-0000-4000-8000-0000000000e2', purpose: 'request_invitation', sendOutcome: 'unknown', failureCode: 'threw', attachmentStatus: 'not_applicable' }),
                notification({ operationId: '00000000-0000-4000-8000-0000000000e3', sendOutcome: 'no_recipients', intendedRecipients: 0, attachmentStatus: 'not_applicable', mode: 'test' }),
            ],
            pdfRenders: [
                pdf({}),
                pdf({ surface: 'completion_attachment', outcome: 'failed', failureStage: 'browser_launch', totalMs: 900, bytes: null }),
                pdf({ outcome: 'skipped', skipReason: 'locked', totalMs: 40, bytes: null, packetMode: null }),
            ],
        } }} />);
        expect(screen.getByText(/completion email to the customer, recipient 1 of 2/i)).toBeInTheDocument();
        expect(screen.getByText(/accepted by provider · bounced .* · pdf attached/i)).toBeInTheDocument();
        expect(screen.getByText(/rejected, not sent · code validation_error · pdf not requested/i)).toBeInTheDocument();
        expect(screen.getByText(/outcome unknown \(may or may not have been sent\) · code threw/i)).toBeInTheDocument();
        expect(screen.getByText(/not attempted: nobody was eligible/i)).toBeInTheDocument();
        expect(screen.getByText(/\(seller test\)/i)).toBeInTheDocument();
        expect(screen.getByText('Produced in 4.2s, 50 KB')).toBeInTheDocument();
        expect(screen.getByText('Failed while starting the browser after 0.9s')).toBeInTheDocument();
        expect(screen.getByText('Not produced: sheet is locked')).toBeInTheDocument();
    });

    it('says an empty history is unknown, and a failed read is not empty', () => {
        const { rerender } = render(<RequestHandoffEvidence state={{ status: 'ok', data: { notifications: [], pdfRenders: [] } }} />);
        expect(screen.getByText(/no email evidence recorded for this request/i)).toBeInTheDocument();
        expect(screen.getByText(/nothing listed means unknown/i)).toBeInTheDocument();
        rerender(<RequestHandoffEvidence state={{ status: 'not_installed' }} />);
        expect(screen.getByRole('status')).toHaveTextContent(/not installed yet/i);
        expect(screen.queryByText(/no email evidence recorded/i)).not.toBeInTheDocument();
    });
});
