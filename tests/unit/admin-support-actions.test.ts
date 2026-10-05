// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { AdminAuthorizationError, AdminWriteDisabledError } = vi.hoisted(() => {
    class AdminAuthorizationError extends Error {
        constructor(message = 'Admin access required') { super(message); this.name = 'AdminAuthorizationError'; }
    }
    class AdminWriteDisabledError extends Error {
        constructor(message = 'Admin writes are disabled') { super(message); this.name = 'AdminWriteDisabledError'; }
    }
    return { AdminAuthorizationError, AdminWriteDisabledError };
});

const mocks = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    assertAdminWritesEnabled: vi.fn(),
    getRequestContext: vi.fn(),
    getUserById: vi.fn(),
    revalidatePath: vi.fn(),
    changeAccountRole: vi.fn(),
    changeAccountPlan: vi.fn(),
    correctRequestStatus: vi.fn(),
    updateRequestSellerContact: vi.fn(),
    createProductUpdateDraft: vi.fn(),
    publishProductUpdateAtomic: vi.fn(),
    deleteProductUpdateAtomic: vi.fn(),
    insertAdminAudit: vi.fn(),
    reconcileAuthUsers: vi.fn(),
    prepareSellerReminder: vi.fn(),
    executeSellerReminder: vi.fn(),
    getRequestById: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('@/lib/admin', () => ({
    AdminAuthorizationError,
    AdminWriteDisabledError,
    requireAdmin: mocks.requireAdmin,
    assertAdminWritesEnabled: mocks.assertAdminWritesEnabled,
    getRequestContext: mocks.getRequestContext,
    getUserById: mocks.getUserById,
    assertAdminActionReason: vi.fn(),
    createAuditLogWithContext: vi.fn(),
}));
vi.mock('@/lib/neon/queries/admin-writes', () => ({
    changeAccountRole: mocks.changeAccountRole,
    changeAccountPlan: mocks.changeAccountPlan,
    correctRequestStatus: mocks.correctRequestStatus,
    updateRequestSellerContact: mocks.updateRequestSellerContact,
    createProductUpdateDraft: mocks.createProductUpdateDraft,
    publishProductUpdateAtomic: mocks.publishProductUpdateAtomic,
    deleteProductUpdateAtomic: mocks.deleteProductUpdateAtomic,
    insertAdminAudit: mocks.insertAdminAudit,
}));
vi.mock('@/lib/neon/queries', () => ({ getRequestById: mocks.getRequestById }));
vi.mock('@/lib/neon/queries/reminder-operations', () => ({
    REMINDER_COOLDOWN_SECONDS: 600,
    REMINDER_RETRY_WINDOW_SECONDS: 82800,
    REMINDER_UNKNOWN_BLOCK_SECONDS: 86400,
    finalizeReminderAccepted: vi.fn(),
    getReminderHistory: vi.fn(),
    getReminderOperation: vi.fn(),
    resolveReminderNotSent: vi.fn(),
}));
vi.mock('@/lib/reminders/seller-reminder', () => ({
    REMINDER_INELIGIBLE_MESSAGES: { REQUEST_SUBMITTED: 'already submitted', NOT_FOUND: 'Request not found' },
    prepareSellerReminder: mocks.prepareSellerReminder,
    executeSellerReminder: mocks.executeSellerReminder,
}));
vi.mock('@/lib/activation/reconcile-auth-users', () => ({ reconcileAuthUsers: mocks.reconcileAuthUsers }));

import { banUserAction, unbanUserAction, updateUserPlanAction, updateUserRoleAction } from '@/app/(admin)/admin/users/actions';
import {
    sendSellerReminderAdminAction,
    updateRequestSellerAdminAction,
    updateRequestStatusAdminAction,
} from '@/app/(admin)/admin/requests/actions';
import {
    createProductUpdateAdminAction,
    deleteProductUpdateAdminAction,
    publishProductUpdateAdminAction,
} from '@/app/(admin)/admin/updates/actions';
import { POST as reconcilePost } from '@/app/api/admin/activation/reconcile/route';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
const OPERATION = '44444444-4444-4444-8444-444444444444';
const reason = 'Support ticket 4821';
const update = {
    id: REQUEST, title: 'Faster packet handoff', body: 'Details', category: 'feature', is_published: false,
    published_at: '2026-07-17T12:00:00.000Z', created_by: ADMIN, created_at: '2026-07-17T12:00:00.000Z', updated_at: '2026-07-17T12:00:00.000Z',
};
const actor = { adminId: ADMIN, ipAddress: '203.0.113.5', userAgent: 'vitest' };

const writeMocks = () => [
    mocks.changeAccountRole, mocks.changeAccountPlan, mocks.correctRequestStatus, mocks.updateRequestSellerContact,
    mocks.createProductUpdateDraft, mocks.publishProductUpdateAtomic, mocks.deleteProductUpdateAtomic,
    mocks.insertAdminAudit, mocks.reconcileAuthUsers, mocks.executeSellerReminder,
];

const reminderInput = { requestId: REQUEST, operationId: OPERATION, reason, confirmed: true, expectedFingerprint: 'a'.repeat(64) };
const reconcileRequest = (body: unknown) => new Request('http://localhost/api/admin/activation/reconcile', {
    method: 'POST', body: JSON.stringify(body),
});
const reconcileBody = { limit: 200, scanAll: true, reason, confirmed: true, reviewedEligibleCount: 2 };

/** Every Admin write entry point with otherwise valid input. */
const entryPoints: Array<[string, () => Promise<{ success?: boolean; code?: string; error?: string }>]> = [
    ['role change', () => updateUserRoleAction({ userId: TARGET, role: 'user', expectedRole: 'admin', reason })],
    ['ban', () => banUserAction({ userId: TARGET, expectedRole: 'user', reason })],
    ['unban', () => unbanUserAction({ userId: TARGET, expectedRole: 'banned', reason })],
    ['entitlement override', () => updateUserPlanAction({ userId: TARGET, plan: 'pro', expectedPlan: 'free', reason })],
    ['status correction', () => updateRequestStatusAdminAction({ requestId: REQUEST, status: 'draft', expectedStatus: 'sent', reason })],
    ['seller edit', () => updateRequestSellerAdminAction({ requestId: REQUEST, seller: { sellerEmail: 'a@example.com' }, expected: {}, reason })],
    ['seller reminder', () => sendSellerReminderAdminAction(reminderInput)],
    ['update draft', () => createProductUpdateAdminAction({ title: 'Title', body: 'Body text', category: 'feature', reason })],
    ['update publish', () => publishProductUpdateAdminAction(REQUEST, { reason, confirmed: true })],
    ['update delete', () => deleteProductUpdateAdminAction(REQUEST, { reason, confirmed: true })],
    ['manual reconciliation', async () => {
        const response = await reconcilePost(reconcileRequest(reconcileBody));
        return { success: response.ok, ...(await response.json()) };
    }],
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.requireAdmin.mockResolvedValue({ account: { id: ADMIN, email: 'admin@example.com' }, user: { id: 'auth' } });
    mocks.assertAdminWritesEnabled.mockImplementation(() => undefined);
    mocks.getRequestContext.mockResolvedValue({ ipAddress: actor.ipAddress, userAgent: actor.userAgent });
    mocks.changeAccountRole.mockResolvedValue({ outcome: 'OK', previousRole: 'admin' });
    mocks.changeAccountPlan.mockResolvedValue({ outcome: 'OK', previousPlan: 'free' });
    mocks.correctRequestStatus.mockResolvedValue({ outcome: 'OK', previousStatus: 'sent' });
    mocks.updateRequestSellerContact.mockResolvedValue({ outcome: 'OK' });
    mocks.createProductUpdateDraft.mockResolvedValue({ outcome: 'OK', update });
    mocks.publishProductUpdateAtomic.mockResolvedValue({ outcome: 'OK', update: { ...update, is_published: true } });
    mocks.deleteProductUpdateAtomic.mockResolvedValue({ outcome: 'OK', update });
    mocks.insertAdminAudit.mockResolvedValue('audit-1');
    mocks.reconcileAuthUsers.mockResolvedValue({
        scanned: 10, existingAccountCount: 8, missingCount: 2, eligibleCount: 2, createdCount: 2,
        skipped: [{ id: 'x', primaryEmail: 'hidden@example.com' }], failures: [], dryRun: false, nextCursor: null,
    });
    mocks.getRequestById.mockResolvedValue({ id: REQUEST, account_id: TARGET });
    mocks.getUserById.mockResolvedValue({ id: TARGET, role: 'user', closure_status: 'active', full_name: 'Owner' });
    mocks.prepareSellerReminder.mockResolvedValue({ ok: true, prepared: { fingerprint: 'a'.repeat(64), request: { id: REQUEST }, email: {} } });
    mocks.executeSellerReminder.mockResolvedValue({ status: 'accepted', operationId: OPERATION, alreadyAccepted: false });
});

describe('every Admin write entry point', () => {
    it.each(entryPoints)('%s: refuses a non-admin caller before any write', async (_name, call) => {
        mocks.requireAdmin.mockRejectedValue(new AdminAuthorizationError());
        expect(await call()).toMatchObject({ success: false, code: 'UNAUTHORIZED', error: 'Admin access required' });
        for (const write of writeMocks()) expect(write).not.toHaveBeenCalled();
    });

    it.each(entryPoints)('%s: honours ADMIN_WRITES_DISABLED before any write', async (_name, call) => {
        mocks.assertAdminWritesEnabled.mockImplementation(() => { throw new AdminWriteDisabledError(); });
        expect(await call()).toMatchObject({
            success: false, code: 'WRITES_DISABLED', error: 'Admin writes are disabled via ADMIN_WRITES_DISABLED=true',
        });
        for (const write of writeMocks()) expect(write).not.toHaveBeenCalled();
    });

    it.each(entryPoints)('%s: succeeds with valid input', async (_name, call) => {
        expect((await call()).success).toBe(true);
    });
});

describe('runtime input validation', () => {
    it('rejects malformed identifiers, enums, reasons and confirmations without writing', async () => {
        const invalid = [
            await updateUserRoleAction({ userId: 'not-a-uuid', role: 'user', expectedRole: 'admin', reason }),
            await updateUserRoleAction({ userId: TARGET, role: 'superuser', expectedRole: 'admin', reason }),
            await banUserAction({ userId: TARGET, expectedRole: 'user', reason: ' x ' }),
            await updateUserPlanAction({ userId: TARGET, plan: 'canceled', expectedPlan: 'free', reason }),
            await updateUserPlanAction({ userId: TARGET, plan: 'pro', expectedPlan: 'free', reason: 'r'.repeat(501) }),
            await updateRequestStatusAdminAction({ requestId: REQUEST, status: 'archived', expectedStatus: 'sent', reason }),
            await updateRequestSellerAdminAction({ requestId: REQUEST, seller: { sellerEmail: 'not-an-email' }, expected: {}, reason }),
            await updateRequestSellerAdminAction({ requestId: REQUEST, seller: { sellerName: 'n'.repeat(121) }, expected: {}, reason }),
            await sendSellerReminderAdminAction({ ...reminderInput, confirmed: false }),
            await sendSellerReminderAdminAction({ ...reminderInput, expectedFingerprint: 'short' }),
            await createProductUpdateAdminAction({ title: 'T', body: 'Body text', category: 'feature', reason }),
            await createProductUpdateAdminAction({ title: 'Title', body: 'Body text', category: 'rumour', reason }),
            await publishProductUpdateAdminAction(REQUEST, { reason, confirmed: false }),
            await deleteProductUpdateAdminAction('1; DROP TABLE', { reason, confirmed: true }),
            // Extra properties cannot smuggle server-owned fields through.
            await updateUserRoleAction({ userId: TARGET, role: 'user', expectedRole: 'admin', reason, adminId: TARGET } as never),
        ];
        for (const result of invalid) expect(result).toMatchObject({ success: false, code: 'INVALID_INPUT' });
        for (const write of writeMocks()) expect(write).not.toHaveBeenCalled();
    });

    it('lets an operator replace a malformed stored seller email', async () => {
        const result = await updateRequestSellerAdminAction({
            requestId: REQUEST,
            seller: { sellerEmail: 'sam@example.com' },
            expected: { sellerEmail: 'sam at example dot com' },
            reason,
        });
        expect(result).toEqual({ success: true });
        expect(mocks.updateRequestSellerContact).toHaveBeenCalledWith(expect.objectContaining({
            expected: { sellerName: null, sellerEmail: 'sam at example dot com', sellerPhone: null },
        }));
    });

    it('normalizes seller contact input and passes the operator-seen values as the expected state', async () => {
        await updateRequestSellerAdminAction({
            requestId: REQUEST,
            seller: { sellerName: '  Sam Seller ', sellerEmail: ' sam@example.com ', sellerPhone: '' },
            expected: { sellerName: null, sellerEmail: 'old@example.com', sellerPhone: undefined },
            reason: `  ${reason}  `,
        });
        expect(mocks.updateRequestSellerContact).toHaveBeenCalledWith({
            actor, reason, requestId: REQUEST,
            seller: { sellerName: 'Sam Seller', sellerEmail: 'sam@example.com', sellerPhone: null },
            expected: { sellerName: null, sellerEmail: 'old@example.com', sellerPhone: null },
        });
    });
});

describe('truthful outcomes', () => {
    it('explains policy blocks, stale edits and no-ops with stable codes', async () => {
        mocks.changeAccountRole.mockResolvedValueOnce({ outcome: 'LAST_ADMIN_PROTECTED' });
        expect(await updateUserRoleAction({ userId: TARGET, role: 'user', expectedRole: 'admin', reason }))
            .toEqual({ success: false, code: 'LAST_ADMIN_PROTECTED', error: 'Cannot remove admin access from the last admin account.' });

        mocks.changeAccountRole.mockResolvedValueOnce({ outcome: 'SELF_BLOCKED' });
        expect(await banUserAction({ userId: ADMIN, expectedRole: 'admin', reason }))
            .toMatchObject({ code: 'SELF_BAN_BLOCKED', error: 'You cannot ban your own account.' });

        mocks.changeAccountPlan.mockResolvedValueOnce({ outcome: 'ORG_TEAM_MANAGED_PLAN' });
        expect(await updateUserPlanAction({ userId: TARGET, plan: 'pro', expectedPlan: 'free', reason }))
            .toMatchObject({ code: 'ORG_TEAM_MANAGED_PLAN' });

        mocks.correctRequestStatus.mockResolvedValueOnce({ outcome: 'STALE' });
        const stale = await updateRequestStatusAdminAction({ requestId: REQUEST, status: 'draft', expectedStatus: 'sent', reason });
        expect(stale).toMatchObject({ success: false, code: 'STALE' });
        expect((stale as { error: string }).error).toMatch(/changed after you opened it.*Refresh/);

        mocks.correctRequestStatus.mockResolvedValueOnce({ outcome: 'SUBMISSION_REQUIRES_SELLER' });
        expect(await updateRequestStatusAdminAction({ requestId: REQUEST, status: 'submitted', expectedStatus: 'sent', reason }))
            .toMatchObject({ code: 'SUBMISSION_REQUIRES_SELLER' });

        mocks.updateRequestSellerContact.mockResolvedValueOnce({ outcome: 'NOT_FOUND' });
        expect(await updateRequestSellerAdminAction({ requestId: REQUEST, seller: {}, expected: {}, reason }))
            .toMatchObject({ code: 'NOT_FOUND', error: 'Request not found' });

        expect(await unbanUserAction({ userId: TARGET, expectedRole: 'user', reason })).toMatchObject({ code: 'NO_OP_UNBAN' });
    });

    it('never returns a raw database or provider exception', async () => {
        const raw = new Error('duplicate key value violates unique constraint "accounts_email" DETAIL: (email)=(private@example.com)');
        mocks.changeAccountRole.mockRejectedValueOnce(raw);
        const result = await updateUserRoleAction({ userId: TARGET, role: 'user', expectedRole: 'admin', reason });
        expect(result).toMatchObject({ success: false, code: 'INTERNAL' });
        const failure = result as { error: string; correlationId: string };
        expect(failure.error).not.toContain('private@example.com');
        expect(failure.error).toContain(failure.correlationId.slice(0, 8));
        expect(failure.error).toMatch(/nothing was saved/i);
    });

    it('reports a committed Product Update as successful even when the cache refresh fails', async () => {
        mocks.revalidatePath.mockImplementation(() => { throw new Error('revalidation unavailable'); });
        expect(await createProductUpdateAdminAction({ title: 'Title', body: 'Body text', category: 'feature', reason }))
            .toEqual({ success: true, update });
    });

    it('treats repeat publication as a no-op and repeat deletion as not found', async () => {
        mocks.publishProductUpdateAtomic.mockResolvedValueOnce({ outcome: 'ALREADY_PUBLISHED', update: { ...update, is_published: true } });
        expect(await publishProductUpdateAdminAction(REQUEST, { reason, confirmed: true }))
            .toMatchObject({ success: true, alreadyPublished: true });
        mocks.deleteProductUpdateAtomic.mockResolvedValueOnce({ outcome: 'NOT_FOUND', update: null });
        expect(await deleteProductUpdateAdminAction(REQUEST, { reason, confirmed: true }))
            .toMatchObject({ success: false, code: 'NOT_FOUND' });
    });

    it('distinguishes reminder outcomes and refuses a stale preview before contacting the provider', async () => {
        mocks.prepareSellerReminder.mockResolvedValueOnce({ ok: true, prepared: { fingerprint: 'b'.repeat(64) } });
        expect(await sendSellerReminderAdminAction(reminderInput)).toMatchObject({ success: false, code: 'STALE_PREVIEW' });
        expect(mocks.executeSellerReminder).not.toHaveBeenCalled();

        mocks.prepareSellerReminder.mockResolvedValueOnce({ ok: false, code: 'REQUEST_SUBMITTED' });
        expect(await sendSellerReminderAdminAction(reminderInput)).toMatchObject({ success: false, code: 'REQUEST_SUBMITTED' });

        const outcomes: Array<[unknown, object]> = [
            [{ status: 'accepted', alreadyAccepted: true }, { success: true, state: 'accepted', alreadyAccepted: true }],
            [{ status: 'accepted_unrecorded' }, { success: true, state: 'accepted_unrecorded' }],
            [{ status: 'failed', code: 'validation_error' }, { success: false, code: 'REMINDER_REJECTED' }],
            [{ status: 'unknown', code: 'provider_request_failed' }, { success: false, code: 'REMINDER_OUTCOME_UNKNOWN' }],
            [{ status: 'blocked', code: 'COOLDOWN' }, { success: false, code: 'COOLDOWN' }],
            [{ status: 'blocked', code: 'UNRESOLVED' }, { success: false, code: 'UNRESOLVED' }],
            [{ status: 'blocked', code: 'IN_FLIGHT' }, { success: false, code: 'IN_FLIGHT' }],
        ];
        for (const [result, expected] of outcomes) {
            mocks.executeSellerReminder.mockResolvedValueOnce(result);
            expect(await sendSellerReminderAdminAction(reminderInput)).toMatchObject(expected);
        }

        mocks.executeSellerReminder.mockRejectedValueOnce(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
        const pending = await sendSellerReminderAdminAction(reminderInput);
        expect(pending).toMatchObject({ success: false, code: 'MIGRATION_PENDING' });
        expect((pending as { error: string }).error).toMatch(/No reminder was sent/);
    });
});

describe('manual reconciliation', () => {
    it('requires a reason and explicit confirmation of the reviewed scope', async () => {
        for (const body of [
            { ...reconcileBody, reason: '' },
            { ...reconcileBody, confirmed: false },
            { limit: 200, scanAll: true, reason, confirmed: true },
            { ...reconcileBody, limit: 5000 },
        ]) {
            const response = await reconcilePost(reconcileRequest(body));
            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' });
        }
        expect(mocks.insertAdminAudit).not.toHaveBeenCalled();
        expect(mocks.reconcileAuthUsers).not.toHaveBeenCalled();
    });

    it('records the attempt before execution and a count-only outcome afterward', async () => {
        const order: string[] = [];
        mocks.insertAdminAudit.mockImplementation(async ({ action }: { action: string }) => { order.push(action); return 'audit'; });
        mocks.reconcileAuthUsers.mockImplementation(async () => {
            order.push('execute');
            return { scanned: 10, eligibleCount: 2, createdCount: 1, skipped: [{ primaryEmail: 'hidden@example.com' }], failures: [{ reason: 'x' }] };
        });

        const response = await reconcilePost(reconcileRequest(reconcileBody));
        expect(response.status).toBe(200);
        expect(order).toEqual(['auth_reconciliation_started', 'execute', 'auth_reconciliation_finished']);

        const [started, finished] = mocks.insertAdminAudit.mock.calls.map((call) => call[0]);
        expect(started.metadata).toMatchObject({ reason, scope: { limit: 200, scanAll: true, reviewedEligibleCount: 2 } });
        expect(finished.metadata).toMatchObject({
            attemptId: started.metadata.attemptId, outcome: 'partial',
            summary: { scanned: 10, eligible: 2, created: 1, skipped: 1, failures: 1 },
        });
        expect(JSON.stringify(mocks.insertAdminAudit.mock.calls)).not.toContain('hidden@example.com');
    });

    it('does not execute when the attempt cannot be audited', async () => {
        mocks.insertAdminAudit.mockRejectedValueOnce(new Error('connection refused to db.internal:5432'));
        const response = await reconcilePost(reconcileRequest(reconcileBody));
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).not.toContain('db.internal');
        expect(mocks.reconcileAuthUsers).not.toHaveBeenCalled();
    });

    it('records an unknown outcome when execution throws part way through', async () => {
        mocks.reconcileAuthUsers.mockRejectedValueOnce(new Error('auth provider 502 raw body'));
        const response = await reconcilePost(reconcileRequest(reconcileBody));
        const body = await response.json();
        expect(response.status).toBe(500);
        expect(body).toMatchObject({ code: 'RECONCILIATION_OUTCOME_UNKNOWN' });
        expect(JSON.stringify(body)).not.toContain('raw body');
        expect(mocks.insertAdminAudit.mock.calls[1][0].metadata).toMatchObject({ outcome: 'unknown', summary: null });
    });

    it('reports created accounts truthfully when only the outcome audit fails', async () => {
        mocks.insertAdminAudit.mockResolvedValueOnce('audit').mockRejectedValueOnce(new Error('audit down'));
        const response = await reconcilePost(reconcileRequest(reconcileBody));
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ createdCount: 2, outcome: 'completed', outcomeRecorded: false });
    });
});
