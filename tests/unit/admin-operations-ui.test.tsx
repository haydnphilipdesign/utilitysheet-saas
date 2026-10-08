import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    updateStatus: vi.fn(),
    updateSeller: vi.fn(),
    preview: vi.fn(),
    send: vi.fn(),
    resolve: vi.fn(),
    triage: vi.fn(),
    snapshot: vi.fn(),
    triageRecords: vi.fn(),
    requireAdmin: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/app/(admin)/admin/requests/actions', () => ({
    updateRequestStatusAdminAction: mocks.updateStatus,
    updateRequestSellerAdminAction: mocks.updateSeller,
    getSellerReminderPreviewAdminAction: mocks.preview,
    sendSellerReminderAdminAction: mocks.send,
    resolveSellerReminderAdminAction: mocks.resolve,
}));
vi.mock('@/app/(admin)/admin/operations/actions', () => ({ updateTriageAdminAction: mocks.triage }));
vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/ops/alerts', () => ({ getAlertConfig: () => ({ enabled: false }) }));
vi.mock('@/lib/ops/events', () => ({ getOpsRetentionDays: () => 90 }));
vi.mock('@/lib/ops/overview', async (original) => ({
    ...(await original<typeof import('@/lib/ops/overview')>()),
    getOperationsSnapshot: mocks.snapshot,
}));
vi.mock('@/lib/ops/triage', async (original) => ({
    ...(await original<typeof import('@/lib/ops/triage')>()),
    getTriageRecords: mocks.triageRecords,
}));

import OperationsPage from '@/app/(admin)/admin/operations/page';
import { RequestAdminActions } from '@/components/admin/RequestAdminActions';
import { TriageControls } from '@/components/admin/TriageControls';

const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const baseRequest = {
    id: REQUEST_ID, status: 'sent' as const, property_address: '1 Open St', seller_name: 'Sam Seller',
    seller_email: 'sam@example.com', seller_phone: null, seller_token: 'tok', public_token: 'pub',
    is_metered: false, is_deleted: false,
};
const eligiblePreview = {
    eligible: true, ineligibleReason: null, recipient: 'sam@example.com', from: 'UtilitySheet <noreply@utilitysheet.com>',
    replyTo: 'agent@example.com', subject: 'Reminder: 1 Open St', html: '<html><body>Exact body</body></html>',
    fingerprint: 'f'.repeat(64), lastSentAt: null, cooldownSecondsRemaining: 0, unresolved: null, recent: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.preview.mockResolvedValue({ success: true, preview: eligiblePreview });
    mocks.send.mockResolvedValue({ success: true, state: 'accepted', alreadyAccepted: false, message: 'Accepted' });
    mocks.updateStatus.mockResolvedValue({ success: true });
    mocks.updateSeller.mockResolvedValue({ success: true });
    mocks.triage.mockResolvedValue({ success: true });
    mocks.requireAdmin.mockResolvedValue({});
    mocks.triageRecords.mockResolvedValue(new Map());
});

describe('RequestAdminActions', () => {
    it('offers only valid corrections and never Submitted for an unmetered request', async () => {
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /correct status/i }));

        const select = await screen.findByLabelText(/new status/i);
        expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['Draft', 'In progress']);
        expect(screen.getByText(/does not record a submission, change usage metering/i)).toBeInTheDocument();

        const dialog = screen.getByRole('dialog');
        const confirm = within(dialog).getByRole('button', { name: /^correct status$/i });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/reason for status correction/i), { target: { value: 'Customer sent it by mistake' } });
        fireEvent.click(confirm);

        await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith({
            requestId: REQUEST_ID, status: 'draft', expectedStatus: 'sent', reason: 'Customer sent it by mistake',
        }));
    });

    it('explains why a metered submitted request cannot be reopened and offers no selector', async () => {
        render(<RequestAdminActions request={{ ...baseRequest, status: 'submitted', is_metered: true }} />);
        fireEvent.click(screen.getByRole('button', { name: /correct status/i }));
        expect(await screen.findByText(/cannot be reopened here/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/new status/i)).not.toBeInTheDocument();
    });

    it('disables every write control for a deleted request', () => {
        render(<RequestAdminActions request={{ ...baseRequest, is_deleted: true }} />);
        for (const name of [/correct status/i, /edit seller info/i, /send seller reminder/i]) {
            expect(screen.getByRole('button', { name })).toBeDisabled();
        }
        expect(screen.getByText(/this request was deleted/i)).toBeInTheDocument();
    });

    it('sends the seller edit with the values the operator was shown', async () => {
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /edit seller info/i }));
        fireEvent.change(await screen.findByLabelText('Seller email'), { target: { value: 'samantha@example.com' } });
        fireEvent.change(screen.getByLabelText(/reason for seller contact edit/i), { target: { value: 'Typo in the address' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(mocks.updateSeller).toHaveBeenCalledWith({
            requestId: REQUEST_ID,
            seller: { sellerName: 'Sam Seller', sellerEmail: 'samantha@example.com', sellerPhone: '' },
            expected: { sellerName: 'Sam Seller', sellerEmail: 'sam@example.com', sellerPhone: null },
            reason: 'Typo in the address',
        }));
    });

    it('shows the exact message and requires reason plus confirmation before sending', async () => {
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /send seller reminder/i }));

        expect(await screen.findByText('Reminder: 1 Open St')).toBeInTheDocument();
        expect(screen.getByText('agent@example.com')).toBeInTheDocument();
        const frame = screen.getByTitle(/exact reminder email preview/i);
        expect(frame).toHaveAttribute('sandbox', '');
        expect(frame.getAttribute('srcdoc')).toContain('Exact body');

        const send = screen.getByRole('button', { name: /send email/i });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/reason for sending or settling/i), { target: { value: 'Seller asked for the link' } });
        expect(send).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(send).toBeEnabled();
        fireEvent.click(send);

        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
        expect(mocks.send.mock.calls[0][0]).toMatchObject({
            requestId: REQUEST_ID, reason: 'Seller asked for the link', confirmed: true, expectedFingerprint: 'f'.repeat(64),
        });
        expect(mocks.send.mock.calls[0][0].operationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('has no override during the cooldown or for an ineligible request', async () => {
        mocks.preview.mockResolvedValueOnce({ success: true, preview: { ...eligiblePreview, lastSentAt: '2026-10-05T12:00:00Z', cooldownSecondsRemaining: 300 } });
        const { unmount } = render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /send seller reminder/i }));
        expect(await screen.findByText(/another can be sent in about 5 minutes/i)).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send email/i })).toBeDisabled();
        unmount();

        mocks.preview.mockResolvedValueOnce({
            success: true,
            preview: { ...eligiblePreview, eligible: false, ineligibleReason: 'The seller already submitted this request.', html: null, fingerprint: null },
        });
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /send seller reminder/i }));
        expect(await screen.findByText(/already submitted this request/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send email/i })).toBeDisabled();
    });

    it('retries an unresolved operation with its original identity instead of starting a new one', async () => {
        const unresolvedId = '44444444-4444-4444-8444-444444444444';
        mocks.preview.mockResolvedValue({
            success: true,
            preview: { ...eligiblePreview, unresolved: { id: unresolvedId, state: 'unknown', createdAt: '2026-10-05T12:00:00Z', failureCode: 'provider_request_failed', canRetry: true } },
        });
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /send seller reminder/i }));

        expect(await screen.findByText(/an earlier reminder from/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/reason for sending or settling/i), { target: { value: 'Retrying after timeout' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /retry this reminder/i }));
        await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ operationId: unresolvedId })));
    });

    it('keeps the dialog and operation open when the provider accepted but recording failed', async () => {
        mocks.send.mockResolvedValueOnce({ success: true, state: 'accepted_unrecorded', message: 'Accepted, but recording it failed. Retry this one.' });
        render(<RequestAdminActions request={baseRequest} />);
        fireEvent.click(screen.getByRole('button', { name: /send seller reminder/i }));
        await screen.findByText('Reminder: 1 Open St');
        fireEvent.change(screen.getByLabelText(/reason for sending or settling/i), { target: { value: 'Seller asked for the link' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /send email/i }));

        expect(await screen.findByRole('status')).toHaveTextContent(/recording it failed/i);
        const first = mocks.send.mock.calls[0][0].operationId;
        expect(mocks.refresh).not.toHaveBeenCalled();
        const retry = screen.getByRole('button', { name: /retry this reminder/i });
        await waitFor(() => expect(retry).toBeEnabled());
        fireEvent.click(retry);
        await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
        expect(mocks.send.mock.calls[1][0].operationId).toBe(first);
        await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    });
});

describe('TriageControls', () => {
    const item = {
        sourceKey: 'incident:pdf:generation_failed', state: 'open' as const, returned: null, version: 3,
        note: '<b>plain</b> text note', snoozedUntil: null, updatedByEmail: 'admin@example.com', stateChangedAt: '2026-10-01T00:00:00Z',
    };

    it('renders the note as plain text and submits a snooze with its reason and the version it saw', async () => {
        const { container } = render(<TriageControls item={item} resolveHint="Resolving does not mean recovery." />);
        expect(screen.getByText('<b>plain</b> text note')).toBeInTheDocument();
        expect(container.querySelector('b')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));
        const submit = screen.getAllByRole('button', { name: 'Snooze' }).at(-1)!;
        expect(submit).toBeEnabled();
        expect(screen.getByPlaceholderText(/do not paste passwords, tokens or seller answers/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/reason to snooze this item/i), { target: { value: 'Fix ships Tuesday' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '14' } });
        fireEvent.click(submit);

        await waitFor(() => expect(mocks.triage).toHaveBeenCalledWith({
            sourceKey: item.sourceKey, action: 'snooze', expectedVersion: 3, snoozeDays: 14, reason: 'Fix ships Tuesday',
        }));
        await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    });

    it('submits without a reason, because triage reasons are optional', async () => {
        render(<TriageControls item={item} />);

        fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' }).at(-1)!);

        await waitFor(() => expect(mocks.triage).toHaveBeenCalledWith({
            sourceKey: item.sourceKey, action: 'acknowledge', expectedVersion: 3,
        }));
    });

    it('explains returned items, limits actions by state and refreshes after a stale write', async () => {
        mocks.triage.mockResolvedValueOnce({ success: false, code: 'STALE', error: 'Another operator updated this item.' });
        render(<TriageControls item={{ ...item, state: 'open', returned: 'recurred' }} resolveHint="Resolving does not mean recovery." />);
        expect(screen.getByText(/happened again after it was resolved/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
        expect(screen.getByText('Resolving does not mean recovery.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/reason to resolve this item/i), { target: { value: 'Handled' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Resolve' }).at(-1)!);
        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Another operator updated this item.'));
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it('is read-only with an explanation when writes are unavailable', () => {
        render(<TriageControls item={{ ...item, state: 'resolved' }} disabledReason="Admin writes are disabled." />);
        expect(screen.getByText('Admin writes are disabled.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

describe('Operations page', () => {
    const ok = <T,>(data: T) => ({ status: 'ok' as const, data });
    const emptyReminders = { windowDays: 30, accepted: 0, delivered: 0, delayed: 0, bounced: 0, complained: 0, deliveryFailed: 0, deliveryUnknown: 0, notSent: 0, unresolved: [] };
    const emptyFollowUp = { inactiveRequests: { total: 0, items: [] }, accountsNotStarted: { total: 0, items: [] } };
    const now = new Date().toISOString();
    const page = async (params: Record<string, string> = {}) => render(await OperationsPage({ searchParams: Promise.resolve(params) }));

    it('says monitoring is not installed instead of showing zero incidents', async () => {
        mocks.snapshot.mockResolvedValue({
            generatedAt: now, incidents: { status: 'not_installed' }, jobs: { status: 'not_installed' },
            reminders: { status: 'not_installed' }, followUp: ok(emptyFollowUp),
        });
        await page();
        expect(screen.getByText(/failure monitoring is not installed yet/i)).toBeInTheDocument();
        expect(screen.getAllByText(/not the same as having no problems/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/no open service issues/i)).not.toBeInTheDocument();
    });

    it('distinguishes no observations yet from a genuinely quiet service', async () => {
        const base = { generatedAt: now, jobs: ok([]), reminders: ok(emptyReminders), followUp: ok(emptyFollowUp) };
        mocks.snapshot.mockResolvedValue({ ...base, incidents: ok({ incidents: [], firstObservationAt: null, lastObservationAt: null, truncated: false }) });
        const first = await page();
        expect(screen.getByText(/has not recorded any observation yet/i)).toBeInTheDocument();
        expect(screen.queryByText(/no open service issues/i)).not.toBeInTheDocument();
        first.unmount();

        mocks.snapshot.mockResolvedValue({ ...base, incidents: ok({ incidents: [], firstObservationAt: now, lastObservationAt: now, truncated: false }) });
        await page();
        expect(screen.getByText(/no open service issues/i)).toBeInTheDocument();
    });

    it('shows service issues apart from follow-up, with recovery stated separately from triage', async () => {
        const incident = {
            sourceKey: 'incident:pdf:generation_failed', fingerprint: 'pdf:generation_failed', category: 'pdf', code: 'generation_failed',
            severity: 'warning', firstOccurredAt: now, lastOccurredAt: now, occurrences: 4, unrecovered: 2, lastSuccessAt: null, latestRequestId: REQUEST_ID,
        };
        mocks.snapshot.mockResolvedValue({
            generatedAt: now,
            incidents: ok({ incidents: [incident], firstObservationAt: now, lastObservationAt: now, truncated: false }),
            jobs: ok([
                { jobName: 'activation_reconcile', health: 'ok', lastStartedAt: now, lastStatus: 'success', lastDurationMs: 1200, lastSuccessAt: now, firstObservedAt: now },
                { jobName: 'activation_reengagement', health: 'not_observed', lastStartedAt: null, lastStatus: null, lastDurationMs: null, lastSuccessAt: null, firstObservedAt: null },
                { jobName: 'account_closure_retry', health: 'overdue', lastStartedAt: now, lastStatus: 'failed', lastDurationMs: 5, lastSuccessAt: null, firstObservedAt: now },
            ]),
            reminders: ok({ ...emptyReminders, accepted: 3, deliveryUnknown: 3 }),
            followUp: ok({
                inactiveRequests: { total: 12, items: [{ sourceKey: `request_inactive:${REQUEST_ID}`, kind: 'request_inactive', label: '1 Open St', detail: 'Sent, no seller activity recorded since', href: `/admin/requests/${REQUEST_ID}`, lastOccurredAt: now }] },
                accountsNotStarted: { total: 5, items: [] },
            }),
        });
        mocks.triageRecords.mockResolvedValue(new Map([[`request_inactive:${REQUEST_ID}`, {
            sourceKey: `request_inactive:${REQUEST_ID}`, state: 'resolved', snoozedUntil: null, note: null, version: 1, updatedByEmail: null,
            stateChangedAt: new Date(Date.now() + 1000).toISOString(),
        }]]));

        await page();
        const service = screen.getByRole('region', { name: /service issues/i });
        expect(within(service).getByText(/sheet pdf generation failed unexpectedly/i)).toBeInTheDocument();
        expect(within(service).getByText(/2 with no later success observed/i)).toBeInTheDocument();
        expect(within(service).getByText(/account closure retry: no success in over 26 hours/i)).toBeInTheDocument();
        expect(within(service).getByRole('link', { name: /most recent affected request/i })).toHaveAttribute('href', `/admin/requests/${REQUEST_ID}`);
        expect(within(service).queryByText('1 Open St')).not.toBeInTheDocument();

        // Unobserved jobs are never called overdue; unscheduled weekly summary is not monitored.
        expect(screen.getByText('No runs observed yet')).toBeInTheDocument();
        expect(screen.getByText(/weekly summary email has no configured schedule/i)).toBeInTheDocument();

        // Raw backlog totals are shown regardless of the dismissed candidate.
        const followUp = screen.getByRole('region', { name: /customer follow-up/i });
        expect(within(followUp).getByRole('link', { name: '12 open requests' })).toHaveAttribute('href', '/admin/requests?activity=stale7d');
        expect(within(followUp).getByText(/every candidate on this page is snoozed or dismissed/i)).toBeInTheDocument();
        expect(within(followUp).getByText(/inactivity alone is not an incident/i)).toBeInTheDocument();
    });
});
