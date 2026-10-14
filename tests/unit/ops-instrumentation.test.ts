// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    recordEvent: vi.fn(),
    recordSuccess: vi.fn(),
    startJobRun: vi.fn(),
    finishJobRun: vi.fn(),
    retention: vi.fn(),
    createPdf: vi.fn(),
    checkRateLimit: vi.fn(),
    constructEvent: vi.fn(),
    getAccountById: vi.fn(),
    updateAccountSubscription: vi.fn(),
    verify: vi.fn(),
    applyDelivery: vi.fn(),
    applyNotification: vi.fn(),
    recordHandoff: vi.fn(),
    runAlerts: vi.fn(),
    observeAi: vi.fn(),
    getJobStatuses: vi.fn(),
    reconcile: vi.fn(),
    requireAdmin: vi.fn(),
    assertWrites: vi.fn(),
    applyTriage: vi.fn(),
    revalidatePath: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/ops/events', () => ({
    recordOperationalEvent: mocks.recordEvent,
    recordOperationalSuccess: mocks.recordSuccess,
    startJobRun: mocks.startJobRun,
    finishJobRun: mocks.finishJobRun,
    getOpsRetentionDays: () => 90,
    errorNameOf: (error: unknown) => (error instanceof Error ? error.name : 'Error'),
}));
vi.mock('@/lib/telemetry/retention', () => ({ runScheduledRetention: mocks.retention }));
vi.mock('@/lib/pdf/packet-attachment', () => ({ createPacketPdfAttachmentForPublicToken: mocks.createPdf }));
vi.mock('@/lib/packet/packet-data', () => ({ PACKET_LOCKED_MESSAGE: 'locked' }));
vi.mock('@/lib/rate-limit', () => ({
    packetPdfRatelimit: {},
    checkRateLimit: mocks.checkRateLimit,
    getRateLimitHeaders: () => ({}),
    isRateLimitUnavailable: () => false,
}));
vi.mock('@/lib/network/client-ip', () => ({ getClientIp: () => '198.51.100.7' }));
vi.mock('@/lib/stripe/client', () => ({
    stripe: { webhooks: { constructEvent: mocks.constructEvent }, subscriptions: { retrieve: vi.fn() } },
    STRIPE_TEAMS_PRICE_ID: 'price_team',
}));
vi.mock('@/lib/neon/queries', () => ({
    getAccountById: mocks.getAccountById,
    updateAccountSubscription: mocks.updateAccountSubscription,
    getAccountByStripeCustomerId: vi.fn(),
    getOrganizationById: vi.fn(),
    getOrganizationByStripeCustomerId: vi.fn(),
    transferAccountSubscriptionToOrganization: vi.fn(),
    updateOrganizationSubscription: vi.fn(),
}));
vi.mock('@/lib/referrals/referral-credit-service', () => ({ applyEarnedReferralCredits: vi.fn() }));
vi.mock('@/lib/resend', () => ({ getResend: () => ({ webhooks: { verify: mocks.verify } }) }));
vi.mock('@/lib/ops/email-delivery', async (original) => ({
    ...(await original<typeof import('@/lib/ops/email-delivery')>()),
    applyEmailDeliveryEvent: mocks.applyDelivery,
}));
vi.mock('@/lib/neon/queries/handoff-evidence', () => ({
    applyNotificationDeliveryEvent: mocks.applyNotification,
    recordHandoffEvidence: mocks.recordHandoff,
}));
vi.mock('@/lib/ops/alerts', () => ({
    getAlertConfig: () => ({ enabled: false, ai: { sharePct: 50, minRuns: 10, windowHours: 24 } }),
    runAlertEvaluation: mocks.runAlerts,
}));
vi.mock('@/lib/ops/ai-health', () => ({ observeAiHealth: mocks.observeAi }));
vi.mock('@/lib/ops/overview', () => ({ getJobStatuses: mocks.getJobStatuses }));
vi.mock('@/lib/neon/statements', async (original) => ({
    ...(await original<typeof import('@/lib/neon/statements')>()),
    getStatementExecutor: () => ({ run: vi.fn(), transaction: vi.fn() }),
}));
vi.mock('@/lib/activation/reconcile-auth-users', () => ({ reconcileAuthUsers: mocks.reconcile }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/admin', () => ({
    requireAdmin: mocks.requireAdmin,
    assertAdminWritesEnabled: mocks.assertWrites,
    getRequestContext: async () => ({ ipAddress: null, userAgent: null }),
}));
vi.mock('@/lib/ops/triage', async (original) => ({
    ...(await original<typeof import('@/lib/ops/triage')>()),
    applyTriageAction: mocks.applyTriage,
}));

import { GET as pdfGet } from '@/app/api/packet/[token]/pdf/route';
import { POST as billingPost } from '@/app/api/billing/webhook/route';
import { POST as resendPost } from '@/app/api/webhooks/resend/route';
import { GET as monitorGet } from '@/app/api/cron/ops-monitor/route';
import { GET as reconcileCron } from '@/app/api/cron/activation-reconcile/route';
import { updateTriageAdminAction } from '@/app/(admin)/admin/operations/actions';

const pdf = () => pdfGet(new Request('http://localhost/api/packet/secret-public-token/pdf'), { params: Promise.resolve({ token: 'secret-public-token' }) });
const billing = () => billingPost(new Request('http://localhost/api/billing/webhook', {
    method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig' },
}));
const subscriptionEvent = {
    id: 'evt_123', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { account_id: 'acct-1' }, items: { data: [] } } },
};
const resendWebhook = (headers: Record<string, string> = { 'svix-id': 'wh_1', 'svix-timestamp': '1', 'svix-signature': 'v1,sig' }) =>
    resendPost(new Request('http://localhost/api/webhooks/resend', { method: 'POST', body: '{"raw":"body"}', headers }));
const cron = (handler: (request: Request) => Promise<Response>, token = 'cron-secret') =>
    handler(new Request('http://localhost/api/cron/x', { headers: { authorization: `Bearer ${token}` } }));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.observeAi.mockResolvedValue({ health: [], failures: 0, recoveries: 0, status: 'ok' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_resend');
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('OPS_RETENTION_PRUNE_ENABLED', '');
    mocks.retention.mockResolvedValue(null);
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.recordEvent.mockResolvedValue(true);
    mocks.recordSuccess.mockResolvedValue(true);
    mocks.recordHandoff.mockResolvedValue(true);
    mocks.applyNotification.mockResolvedValue({ matched: false });
    mocks.startJobRun.mockImplementation(async (jobName: string) => ({ id: 'run-1', jobName, startedAtMs: 0 }));
    mocks.constructEvent.mockReturnValue(subscriptionEvent);
    mocks.getAccountById.mockResolvedValue({ id: 'acct-1', closure_status: 'active' });
    mocks.requireAdmin.mockResolvedValue({ account: { id: '11111111-1111-4111-8111-111111111111' }, user: {} });
    mocks.assertWrites.mockImplementation(() => undefined);
    mocks.applyTriage.mockResolvedValue({ outcome: 'OK', version: 1 });
});

describe('packet PDF route', () => {
    it('records unexpected generation failures without the capability token', async () => {
        mocks.createPdf.mockResolvedValue({ status: 'failed', error: 'Chromium crashed at /tmp/x' });
        expect((await pdf()).status).toBe(500);
        mocks.createPdf.mockRejectedValue(new TypeError('boom'));
        expect((await pdf()).status).toBe(500);
        expect(mocks.recordEvent).toHaveBeenCalledTimes(2);
        expect(mocks.recordEvent.mock.calls[1][0]).toMatchObject({ category: 'pdf', outcome: 'failure', metadata: { errorName: 'TypeError' } });
        expect(JSON.stringify(mocks.recordEvent.mock.calls)).not.toMatch(/secret-public-token|Chromium/);
    });

    it('keeps expected outcomes out of incident counts', async () => {
        mocks.createPdf.mockResolvedValue({ status: 'skipped', reason: 'not_found' });
        expect((await pdf()).status).toBe(404);
        mocks.createPdf.mockResolvedValue({ status: 'skipped', reason: 'locked' });
        expect((await pdf()).status).toBe(402);
        mocks.checkRateLimit.mockResolvedValueOnce({ success: false });
        expect((await pdf()).status).toBe(429);
        expect(mocks.recordEvent).not.toHaveBeenCalled();
    });

    it('still serves the PDF when the monitoring store is unavailable', async () => {
        mocks.recordSuccess.mockResolvedValue(false);
        mocks.createPdf.mockResolvedValue({
            status: 'attached', attachment: { filename: 'packet.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
        });
        const response = await pdf();
        expect(response.status).toBe(200);
        expect(mocks.recordSuccess).toHaveBeenCalledWith({ category: 'pdf', code: 'generation_failed' });
    });

    const REQUEST_ID = '00000000-0000-4000-8000-0000000000d1';
    const evidence = (overrides: Record<string, unknown>) => ({
        requestId: REQUEST_ID, isDemo: false, packetMode: 'advanced', renderStrategy: 'print_pdf', launchStrategy: 'default',
        outcome: 'rendered', skipReason: null, failureStage: null, errorName: null,
        totalMs: 4200, dataMs: 80, launchMs: 900, renderMs: 3100, bytes: 51234, ...overrides,
    });
    const storedPdf = () => mocks.recordHandoff.mock.calls.map((call) => call[0].pdfRenders[0]);

    it('records execution evidence for a resolved request with its coarse response status', async () => {
        mocks.createPdf.mockResolvedValue({
            status: 'attached', attachment: { filename: '12 Private Rd.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
            evidence: evidence({}),
        });
        expect((await pdf()).status).toBe(200);
        mocks.createPdf.mockResolvedValue({ status: 'skipped', reason: 'locked', evidence: evidence({ outcome: 'skipped', skipReason: 'locked', packetMode: null, renderStrategy: null, launchStrategy: null, bytes: null }) });
        expect((await pdf()).status).toBe(402);
        mocks.createPdf.mockResolvedValue({ status: 'skipped', reason: 'not_submitted', evidence: evidence({ outcome: 'skipped', skipReason: 'not_submitted', isDemo: true }) });
        expect((await pdf()).status).toBe(404);

        expect(storedPdf()).toEqual([
            expect.objectContaining({ requestId: REQUEST_ID, surface: 'download', mode: 'live', outcome: 'rendered', httpStatus: 200, packetMode: 'advanced', renderStrategy: 'print_pdf', launchStrategy: 'default', totalMs: 4200, renderMs: 3100, bytes: 51234 }),
            expect.objectContaining({ outcome: 'skipped', skipReason: 'locked', httpStatus: 402 }),
            expect.objectContaining({ outcome: 'skipped', skipReason: 'not_submitted', httpStatus: 404, mode: 'test' }),
        ]);
        // Expected statuses are evidence, not incidents, and nothing identifying is stored.
        expect(mocks.recordEvent).not.toHaveBeenCalled();
        expect(JSON.stringify(mocks.recordHandoff.mock.calls)).not.toMatch(/secret-public-token|Private Rd|\.pdf/);
    });

    it('stores nothing for an unknown link, a rate-limited request or an unresolved failure', async () => {
        mocks.createPdf.mockResolvedValue({ status: 'skipped', reason: 'not_found', evidence: evidence({ requestId: null, isDemo: null, outcome: 'skipped', skipReason: 'not_found' }) });
        expect((await pdf()).status).toBe(404);
        mocks.checkRateLimit.mockResolvedValueOnce({ success: false });
        expect((await pdf()).status).toBe(429);
        mocks.createPdf.mockResolvedValue({ status: 'failed', error: 'lookup failed', evidence: evidence({ requestId: null, isDemo: null, outcome: 'failed', failureStage: 'data', errorName: 'Error' }) });
        expect((await pdf()).status).toBe(500);
        expect(mocks.recordHandoff).not.toHaveBeenCalled();
        // The data failure is still an incident, named by its stage.
        expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
        expect(mocks.recordEvent.mock.calls[0][0]).toMatchObject({ category: 'pdf', requestId: null, metadata: { reasonCode: 'data_failed' } });
    });

    it('separates browser-launch and render failures and links the incident to the request', async () => {
        mocks.createPdf.mockResolvedValue({ status: 'failed', error: 'Chromium crashed at /tmp/x', evidence: evidence({ outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', launchStrategy: null, renderMs: null, bytes: null }) });
        expect((await pdf()).status).toBe(500);
        mocks.createPdf.mockResolvedValue({ status: 'failed', error: 'Navigation timeout', evidence: evidence({ outcome: 'failed', failureStage: 'render', errorName: 'TimeoutError', bytes: null }) });
        expect((await pdf()).status).toBe(500);

        expect(mocks.recordEvent.mock.calls.map((call) => call[0])).toEqual([
            expect.objectContaining({ requestId: REQUEST_ID, metadata: { reasonCode: 'browser_launch_failed' } }),
            expect.objectContaining({ requestId: REQUEST_ID, metadata: { reasonCode: 'render_failed' } }),
        ]);
        expect(storedPdf()).toEqual([
            expect.objectContaining({ outcome: 'failed', failureStage: 'browser_launch', errorName: 'Error', httpStatus: 500 }),
            expect.objectContaining({ outcome: 'failed', failureStage: 'render', errorName: 'TimeoutError', httpStatus: 500 }),
        ]);
        expect(JSON.stringify([mocks.recordEvent.mock.calls, mocks.recordHandoff.mock.calls])).not.toMatch(/Chromium|Navigation|tmp/);
    });

    it('still serves the PDF when evidence cannot be stored', async () => {
        mocks.recordHandoff.mockResolvedValue(false);
        mocks.createPdf.mockResolvedValue({
            status: 'attached', attachment: { filename: 'packet.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
            evidence: evidence({}),
        });
        expect((await pdf()).status).toBe(200);
    });
});

describe('billing webhook', () => {
    it('does not treat an invalid signature as a billing incident', async () => {
        mocks.constructEvent.mockImplementation(() => { throw new Error('No signatures found'); });
        expect((await billing()).status).toBe(400);
        expect(mocks.recordEvent).not.toHaveBeenCalled();
        expect(mocks.recordSuccess).not.toHaveBeenCalled();
    });

    it('records a verified processing failure by Stripe event identity and stays retryable', async () => {
        mocks.getAccountById.mockResolvedValue(null);
        const response = await billing();
        expect(response.status).toBe(500);
        expect(mocks.recordEvent).toHaveBeenCalledWith({
            category: 'billing_webhook', code: 'processing_failed', outcome: 'failure', severity: 'critical',
            providerEventId: 'evt_123', metadata: { eventType: 'customer.subscription.updated', errorName: 'Error' },
        });
    });

    it('records success for recovery linkage and still acknowledges when monitoring is down', async () => {
        mocks.recordSuccess.mockResolvedValue(false);
        const response = await billing();
        expect(response.status).toBe(200);
        expect(mocks.updateAccountSubscription).toHaveBeenCalled();
        expect(mocks.recordSuccess).toHaveBeenCalledWith(expect.objectContaining({ category: 'billing_webhook', providerEventId: 'evt_123' }));
    });
});

describe('Resend delivery webhook', () => {
    it('is unavailable, not silently healthy, until a signing secret is configured', async () => {
        vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
        expect((await resendWebhook()).status).toBe(503);
        expect(mocks.verify).not.toHaveBeenCalled();
    });

    it('verifies the raw body before reading anything and rejects bad signatures without storing', async () => {
        expect((await resendWebhook({})).status).toBe(400);
        mocks.verify.mockImplementation(() => { throw new Error('bad signature'); });
        expect((await resendWebhook()).status).toBe(400);
        expect(mocks.verify).toHaveBeenCalledWith({
            payload: '{"raw":"body"}', headers: { id: 'wh_1', timestamp: '1', signature: 'v1,sig' }, webhookSecret: 'whsec_resend',
        });
        expect(mocks.applyDelivery).not.toHaveBeenCalled();
    });

    it('applies tracked delivery facts with only the message and webhook identifiers', async () => {
        mocks.verify.mockReturnValue({ type: 'email.bounced', data: { email_id: 'msg_1', to: ['sam@example.com'], subject: 'Reminder' } });
        mocks.applyDelivery.mockResolvedValue({ matched: true });
        const response = await resendWebhook();
        expect(await response.json()).toEqual({ received: true, tracked: true });
        expect(mocks.applyDelivery).toHaveBeenCalledWith({ providerMessageId: 'msg_1', status: 'bounced', webhookMessageId: 'wh_1' });
    });

    it('acknowledges untracked and unmatched events without creating incidents', async () => {
        mocks.verify.mockReturnValue({ type: 'email.opened', data: { email_id: 'msg_1' } });
        expect(await (await resendWebhook()).json()).toEqual({ received: true, tracked: false });
        expect(mocks.applyDelivery).not.toHaveBeenCalled();
        mocks.verify.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_unknown' } });
        mocks.applyDelivery.mockResolvedValue({ matched: false });
        expect(await (await resendWebhook()).json()).toEqual({ received: true, tracked: false });
    });

    it('leaves a matched reminder to its own contract and never asks notification evidence', async () => {
        mocks.verify.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_reminder' } });
        mocks.applyDelivery.mockResolvedValue({ matched: true });
        expect(await (await resendWebhook()).json()).toEqual({ received: true, tracked: true });
        expect(mocks.applyNotification).not.toHaveBeenCalled();
    });

    it('matches completion and invitation evidence for messages reminders did not claim', async () => {
        mocks.verify.mockReturnValue({ type: 'email.bounced', data: { email_id: 'msg_completion', to: ['owner@example.com'], subject: 'Utility Info Submitted' } });
        mocks.applyDelivery.mockResolvedValue({ matched: false });
        mocks.applyNotification.mockResolvedValue({ matched: true });
        expect(await (await resendWebhook()).json()).toEqual({ received: true, tracked: true });
        expect(mocks.applyNotification).toHaveBeenCalledWith({ providerMessageId: 'msg_completion', status: 'bounced', webhookMessageId: 'wh_1' });
    });

    it('acknowledges instead of looping when the notification evidence migration is pending', async () => {
        mocks.verify.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_other' } });
        mocks.applyDelivery.mockResolvedValue({ matched: false });
        mocks.applyNotification.mockRejectedValue(Object.assign(new Error('relation missing'), { code: '42P01' }));
        const response = await resendWebhook();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true, tracked: false });
    });

    it('asks the provider to retry when notification evidence cannot be written', async () => {
        mocks.verify.mockReturnValue({ type: 'email.delivered', data: { email_id: 'msg_other' } });
        mocks.applyDelivery.mockResolvedValue({ matched: false });
        mocks.applyNotification.mockRejectedValue(new Error('connection reset by peer'));
        const response = await resendWebhook();
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('connection');
    });

    it('asks the provider to retry when the durable write fails', async () => {
        mocks.verify.mockReturnValue({ type: 'email.complained', data: { email_id: 'msg_1' } });
        mocks.applyDelivery.mockRejectedValue(Object.assign(new Error('relation missing'), { code: '42P01' }));
        const response = await resendWebhook();
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('relation');
    });
});

describe('scheduled jobs', () => {
    it('records partial and failed reconciliation runs without changing the cron contract', async () => {
        mocks.reconcile.mockResolvedValue({ scanned: 5, eligibleCount: 2, createdCount: 1, skipped: [], failures: [{ reason: 'x' }] });
        const response = await cron(reconcileCron);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, created: 1 });
        expect(mocks.startJobRun).toHaveBeenCalledWith('activation_reconcile');
        expect(mocks.finishJobRun).toHaveBeenCalledWith(expect.anything(), 'partial', { scanned: 5, eligible: 2, created: 1, skipped: 0, failures: 1 });

        mocks.reconcile.mockRejectedValue(new Error('auth provider down'));
        expect((await cron(reconcileCron)).status).toBe(500);
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'failed');
        expect((await cron(reconcileCron, 'wrong')).status).toBe(401);
    });

    it('monitor route requires the cron secret and reports retention only when it ran', async () => {
        expect((await cron(monitorGet, 'wrong')).status).toBe(401);
        expect(mocks.runAlerts).not.toHaveBeenCalled();

        mocks.getJobStatuses.mockResolvedValue([]);
        mocks.runAlerts.mockResolvedValue({ enabled: false, conditionsFiring: ['pdf_failures'], planned: [{ key: 'pdf_failures', kind: 'firing', summary: 's' }], sent: 0, failed: 0, stateWriteFailed: 0 });
        const response = await cron(monitorGet);
        expect(await response.json()).toEqual({
            alertsEnabled: false, conditionsFiring: ['pdf_failures'], notificationsPlanned: [{ key: 'pdf_failures', kind: 'firing' }],
            sent: 0, failed: 0, stateWriteFailed: 0, retention: null, monitoringStatus: 'success', aiCoverage: 'ok',
        });
        expect(mocks.retention).toHaveBeenCalledTimes(1);
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'success', expect.objectContaining({ retentionRan: 0, retentionFailed: 0 }));

        mocks.retention.mockResolvedValue({ status: 'not_due', mode: 'enforce' });
        expect(await (await cron(monitorGet)).json()).toMatchObject({ retention: { status: 'not_due' }, monitoringStatus: 'success' });

        mocks.retention.mockResolvedValue({
            status: 'ran', mode: 'enforce', failed: 0,
            classes: [{ key: 'jobRuns', label: 'Scheduled job runs', kind: 'delete', action: 'enforce', windowDays: 90, affected: 4, oldest: null, failed: false }],
        });
        expect((await (await cron(monitorGet)).json()).retention).toEqual({
            status: 'ran', mode: 'enforce', classes: [{ key: 'jobRuns', action: 'enforce', affected: 4, failed: false }],
        });
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'success', expect.objectContaining({ retentionRan: 1, retentionFailed: 0 }));
    });

    it('monitor marks a failed retention run partial and still evaluates alerts', async () => {
        mocks.getJobStatuses.mockResolvedValue([]);
        mocks.runAlerts.mockResolvedValue({ enabled: true, conditionsFiring: [], planned: [], sent: 0, failed: 0, stateWriteFailed: 0 });
        mocks.retention.mockResolvedValue({ status: 'failed', mode: 'enforce', classes: [], failed: 1 });
        const response = await cron(monitorGet);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ monitoringStatus: 'partial', retention: { status: 'failed' } });
        expect(mocks.runAlerts).toHaveBeenCalled();
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'partial', expect.objectContaining({ retentionFailed: 1 }));
    });

    it('monitor route reports a pending migration instead of an empty result', async () => {
        mocks.getJobStatuses.mockRejectedValue(Object.assign(new Error('missing'), { code: '42P01' }));
        const response = await cron(monitorGet);
        expect(response.status).toBe(503);
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'failed');
    });

    it('marks a failed AI read partial and excludes its own in-progress heartbeat', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
        try {
            mocks.getJobStatuses.mockResolvedValue([]);
            mocks.observeAi.mockResolvedValue({ health: null, failures: 0, recoveries: 0, status: 'unavailable' });
            mocks.runAlerts.mockResolvedValue({ enabled: false, conditionsFiring: [], planned: [], sent: 0, failed: 0, stateWriteFailed: 0 });
            const response = await cron(monitorGet);
            expect(await response.json()).toMatchObject({ monitoringStatus: 'partial', aiCoverage: 'unavailable', sent: 0 });
            expect(mocks.getJobStatuses).toHaveBeenCalledWith(expect.anything(), new Date('2026-10-13T12:00:00Z'), undefined, 'run-1');
            expect(mocks.runAlerts).toHaveBeenCalledWith(expect.objectContaining({ aiHealth: null }));
            expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'partial', expect.objectContaining({ aiUnavailable: 1 }));
        } finally { vi.useRealTimers(); }
    });

    it('marks partial AI writes, accepted alert state-write failure and missing start evidence partial', async () => {
        mocks.getJobStatuses.mockResolvedValue([]);
        mocks.observeAi.mockResolvedValue({ health: [], failures: 0, recoveries: 0, status: 'partial' });
        mocks.runAlerts.mockResolvedValue({ enabled: true, conditionsFiring: [], planned: [], sent: 1, failed: 1, stateWriteFailed: 1 });
        expect(await (await cron(monitorGet)).json()).toMatchObject({ monitoringStatus: 'partial', aiCoverage: 'partial', sent: 1, stateWriteFailed: 1 });
        expect(mocks.finishJobRun).toHaveBeenLastCalledWith(expect.anything(), 'partial', expect.objectContaining({ aiPartial: 1, alertStateWriteFailed: 1 }));
        mocks.observeAi.mockResolvedValue({ health: [], failures: 0, recoveries: 0, status: 'ok' });
        mocks.runAlerts.mockResolvedValue({ enabled: false, conditionsFiring: [], planned: [], sent: 0, failed: 0, stateWriteFailed: 0 });
        mocks.startJobRun.mockResolvedValueOnce({ id: null, jobName: 'ops_monitor', startedAtMs: 0 });
        expect(await (await cron(monitorGet)).json()).toMatchObject({ monitoringStatus: 'partial' });
    });
});

describe('triage action', () => {
    const input = { sourceKey: 'incident:pdf:generation_failed', action: 'snooze', expectedVersion: 2, snoozeDays: 7, note: ' check Tuesday ', reason: 'Waiting on a fix' };

    it('authorizes, validates and derives the kind and snooze time on the server', async () => {
        expect(await updateTriageAdminAction(input)).toEqual({ success: true });
        const call = mocks.applyTriage.mock.calls[0][0];
        expect(call).toMatchObject({ kind: 'service', action: 'snooze', expectedVersion: 2, note: 'check Tuesday', reason: 'Waiting on a fix' });
        expect(call.snoozedUntil.getTime()).toBeGreaterThan(Date.now() + 6.9 * 24 * 60 * 60 * 1000);

        for (const invalid of [
            { ...input, sourceKey: 'accounts; DROP' }, { ...input, action: 'delete' }, { ...input, reason: 'r'.repeat(501) },
            { ...input, snoozeDays: undefined }, { ...input, snoozeDays: 400 }, { ...input, note: 'n'.repeat(1001) },
            { ...input, expectedVersion: -1 }, { ...input, kind: 'service' },
        ]) {
            expect(await updateTriageAdminAction(invalid as never)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
        }
        expect(await updateTriageAdminAction({ ...input, sourceKey: 'unknown_prefix:abc' })).toMatchObject({ success: false, code: 'INVALID_INPUT' });
        expect(mocks.applyTriage).toHaveBeenCalledTimes(1);

        // The reason is optional for triage: a blank one is accepted and passed on as null.
        expect(await updateTriageAdminAction({ ...input, reason: '' })).toEqual({ success: true });
        expect(mocks.applyTriage.mock.calls[1][0]).toMatchObject({ reason: null });
    });

    it('refuses non-admins, disabled writes, stale views and a missing table with clear outcomes', async () => {
        mocks.requireAdmin.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'AdminAuthorizationError' }));
        expect(await updateTriageAdminAction(input)).toMatchObject({ code: 'UNAUTHORIZED' });
        mocks.assertWrites.mockImplementationOnce(() => { throw Object.assign(new Error('off'), { name: 'AdminWriteDisabledError' }); });
        expect(await updateTriageAdminAction(input)).toMatchObject({ code: 'WRITES_DISABLED' });
        expect(mocks.applyTriage).not.toHaveBeenCalled();

        mocks.applyTriage.mockResolvedValueOnce({ outcome: 'STALE', version: null });
        const stale = await updateTriageAdminAction(input);
        expect(stale).toMatchObject({ success: false, code: 'STALE' });
        expect((stale as { error: string }).error).toMatch(/Another operator updated this item/);

        mocks.applyTriage.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' }));
        expect(await updateTriageAdminAction(input)).toMatchObject({ code: 'MIGRATION_PENDING' });
    });
});
